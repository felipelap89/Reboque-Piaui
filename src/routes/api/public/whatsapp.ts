import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calculateRouteDistance } from "@/lib/distance-core";

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function twiml(message: string, mediaUrl?: string) {
  const safe = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const media = mediaUrl ? `<Media>${safe(mediaUrl)}</Media>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${safe(message)}</Body>${media}</Message></Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function digits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function phoneMatches(a: string, b: string) {
  const da = digits(a), db = digits(b);
  if (!da || !db) return false;
  return da.endsWith(db.slice(-8)) || db.endsWith(da.slice(-8));
}

async function downloadMediaAsBase64(mediaUrl: string): Promise<{ b64: string; mime: string }> {
  // mediaUrl looks like: https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/{MSID}/Media/{MID}
  // route through gateway by stripping the /2010-04-01/Accounts/{SID} prefix
  const m = mediaUrl.match(/\/2010-04-01\/Accounts\/[^/]+(\/.*)$/);
  const path = m ? m[1] : mediaUrl.replace(/^https?:\/\/[^/]+/, "");
  const url = `${TWILIO_GATEWAY}${path}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": process.env.TWILIO_API_KEY!,
    },
  });
  if (!res.ok) throw new Error(`media download ${res.status}: ${await res.text()}`);
  const mime = res.headers.get("content-type") ?? "audio/ogg";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return { b64: btoa(bin), mime };
}

async function transcribeAudio(b64: string, mime: string): Promise<string> {
  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcreva exatamente o áudio em português, sem comentários." },
            { type: "input_audio", input_audio: { data: b64, format: mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "ogg" } },
          ],
        },
      ],
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`transcribe ${res.status}: ${JSON.stringify(json)}`);
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

const TIPOS_SERVICO = ["Guincho urbano", "Guincho viagem", "Mecânica", "Chaveiro", "Bateria", "Pane seca", "Outros"] as const;
const TIPOS_DESPESA = ["Combustível", "Alimentação", "Pedágio", "Oficina", "Peças", "Manutenção", "Funcionários", "Internet", "Energia", "Outros"] as const;
const PAGAMENTOS = ["Pix", "Dinheiro", "Cartão", "Transferência"] as const;

type Parsed =
  | { kind: "servico"; cliente: string; tipo: string; valor: number; km?: number; origem?: string; destino?: string; pagamento?: string; obs?: string; motorista?: string; caminhao?: string; placa?: string; veiculoModelo?: string; veiculoAno?: string }
  | { kind: "despesa"; tipo: string; valor: number; responsavel?: string; obs?: string }
  | { kind: "ajuda" }
  | { kind: "indefinido"; motivo: string };

async function parseIntent(text: string): Promise<Parsed> {
  const tools = [
    {
      type: "function",
      function: {
        name: "registrar",
        description: "Registra um serviço, uma despesa, ou retorna ajuda/indefinido.",
        parameters: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["servico", "despesa", "ajuda", "indefinido"] },
            cliente: { type: "string" },
            tipo: { type: "string" },
            valor: { type: "number" },
            km: { type: "number" },
            origem: { type: "string" },
            destino: { type: "string" },
            pagamento: { type: "string", enum: [...PAGAMENTOS] },
            motorista: { type: "string", description: "Nome do motorista designado para o serviço, se mencionado" },
            caminhao: { type: "string", description: "Nome/modelo/placa do caminhão (guincho da empresa) que fará o atendimento, se mencionado. Ex.: 'caminhão Águia', 'guincho HTT-1234'" },
            placa: { type: "string", description: "Placa do veículo do cliente (ABC1D23 ou ABC1234)" },
            veiculoModelo: { type: "string", description: "Modelo do veículo do cliente, ex.: Gol, Onix, Corolla" },
            veiculoAno: { type: "string", description: "Ano do veículo do cliente, ex.: 2018" },
            responsavel: { type: "string" },
            obs: { type: "string" },
            motivo: { type: "string" },
          },
          required: ["kind"],
        },
      },
    },
  ];

  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      tools,
      tool_choice: { type: "function", function: { name: "registrar" } },
      messages: [
        {
          role: "system",
          content:
            `Você interpreta mensagens em português de motoristas de guincho/mecânica e classifica como SERVIÇO ou DESPESA, extraindo campos. ` +
            `Se a mensagem for "ajuda"/"help"/"menu", use kind=ajuda. Se ambígua, use kind=indefinido com motivo. Valores numéricos sem "R$". ` +
            `O campo "tipo" para SERVIÇO deve ser EXATAMENTE um destes: ${TIPOS_SERVICO.join(", ")}. ` +
            `O campo "tipo" para DESPESA deve ser EXATAMENTE um destes: ${TIPOS_DESPESA.join(", ")}. ` +
            `O campo "pagamento" deve ser EXATAMENTE um destes: ${PAGAMENTOS.join(", ")}. ` +
          `Se a mensagem mencionar quem fará o serviço (ex.: "manda pra Vanessa", "Juliana vai pegar", "motorista João"), extraia o nome em "motorista". ` +
            `Se mencionar qual caminhão/guincho da empresa será usado (ex.: 'caminhão Águia', 'guincho HTT-1234', 'no Iveco'), extraia em "caminhao". ` +
            `Se mencionar dados do carro do cliente (placa, modelo, ano), extraia em "placa", "veiculoModelo", "veiculoAno".`,
        },
        { role: "user", content: text },
      ],
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`parse ${res.status}: ${JSON.stringify(json)}`);
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return { kind: "indefinido", motivo: "Não entendi" };
  try {
    const args = JSON.parse(call.function.arguments);
    return args as Parsed;
  } catch {
    return { kind: "indefinido", motivo: "Falha ao interpretar" };
  }
}

function normalizeTipoServico(t?: string): string {
  if (!t) return "Outros";
  const found = TIPOS_SERVICO.find((x) => x.toLowerCase() === t.toLowerCase());
  return found ?? "Outros";
}
function normalizeTipoDespesa(t?: string): string {
  if (!t) return "Outros";
  const found = TIPOS_DESPESA.find((x) => x.toLowerCase() === t.toLowerCase());
  return found ?? "Outros";
}
function normalizePagamento(p?: string): string | null {
  if (!p) return null;
  const found = PAGAMENTOS.find((x) => x.toLowerCase() === p.toLowerCase());
  return found ?? null;
}

async function handle(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const from = String(form.get("From") ?? "");
    const body = String(form.get("Body") ?? "").trim();
    const numMedia = parseInt(String(form.get("NumMedia") ?? "0"), 10);

    // 1. Identify caller by phone — driver OR authorized user (profile.pode_abrir_chamado)
    const phone = from.replace(/^whatsapp:/, "");
    const [{ data: motoristas }, { data: profsAutorizados }, { data: veiculosFrota }] = await Promise.all([
      supabaseAdmin.from("motoristas").select("id, nome, telefone, ativo, comissao_pct, comissao_valor"),
      supabaseAdmin.from("profiles").select("user_id, nome, telefone, pode_abrir_chamado"),
      supabaseAdmin.from("veiculos").select("id, modelo, placa, marca"),
    ]);
    const motorista = (motoristas ?? []).find((m: any) => m.ativo && phoneMatches(m.telefone ?? "", phone));
    const autorizado = (profsAutorizados ?? []).find((p: any) => p.pode_abrir_chamado && phoneMatches(p.telefone ?? "", phone));
    const callerNome = autorizado?.nome ?? "";
    if (!autorizado) {
      if (motorista) {
        // Driver flow: allow finalizing a call by replying with the OS number
        let driverText = body;
        if (numMedia > 0) {
          const mediaUrl = String(form.get("MediaUrl0") ?? "");
          const mediaType = String(form.get("MediaContentType0") ?? "");
          if (mediaType.startsWith("audio")) {
            try {
              const { b64, mime } = await downloadMediaAsBase64(mediaUrl);
              driverText = `${body ? body + " " : ""}${await transcribeAudio(b64, mime)}`.trim();
            } catch (e: any) {
              return twiml(`⚠️ Não consegui ler o áudio: ${e.message}`);
            }
          }
        }
        const lower = driverText.toLowerCase();
        const isFinalize = /\b(finaliz|conclu|encerr|terminei|finalizei|pronto|feito)/i.test(lower);
        const osMatch = driverText.match(/OS-[\d-]+/i);

        if (isFinalize || osMatch) {
          // Find candidate service: by OS number or last open service for this driver
          let svc: any = null;
          if (osMatch) {
            const numero = osMatch[0].toUpperCase();
            const { data } = await supabaseAdmin
              .from("servicos").select("id, numero, cliente, status, motorista_id, comissao_valor")
              .eq("numero", numero).maybeSingle();
            svc = data;
          } else {
            const { data } = await supabaseAdmin
              .from("servicos").select("id, numero, cliente, status, motorista_id, comissao_valor")
              .eq("motorista_id", motorista.id)
              .in("status", ["Pendente", "Em andamento"])
              .order("created_at", { ascending: false })
              .limit(1).maybeSingle();
            svc = data;
          }
          if (!svc) return twiml(`🤔 Não encontrei chamado para finalizar. Responda com o número da OS, ex.: "finalizar OS-20260510-1430-00012".`);
          if (svc.motorista_id !== motorista.id) return twiml(`❌ A OS ${svc.numero} não está atribuída a você.`);
          if (svc.status === "Finalizado") return twiml(`ℹ️ A OS ${svc.numero} já está finalizada.`);
          if (svc.status === "Cancelado") return twiml(`❌ A OS ${svc.numero} foi cancelada.`);

          const { error } = await supabaseAdmin.from("servicos").update({ status: "Finalizado" }).eq("id", svc.id);
          if (error) return twiml(`❌ Erro ao finalizar ${svc.numero}: ${error.message}`);

          // Notify managers (WhatsApp) — best effort
          try {
            const { notifyManagersServiceFinalizedDirect } = await import("@/lib/notify-manager.functions");
            const r = await notifyManagersServiceFinalizedDirect(svc.id);
            console.log("[whatsapp] notify manager finalize:", r);
          } catch (e) {
            console.error("[whatsapp] notify manager finalize", e);
          }

          const com = Number(svc.comissao_valor ?? 0);
          const comStr = com.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          return twiml(`✅ OS ${svc.numero} (${svc.cliente}) finalizada!\n💵 Sua comissão: ${comStr} foi lançada como pendente.`);
        }

        return twiml(`👋 Olá ${motorista.nome}! Para encerrar um chamado, responda com:\n*finalizar OS-AAAAMMDD-HHMM-NNNNN*\nou apenas *concluído* para finalizar o último chamado em aberto. 🚚`);
      }
      return twiml(`❌ Número ${phone} não está autorizado a abrir chamados. Solicite ao administrador.`);
    }

    // 2. Get text (from body or audio transcription)
    let text = body;
    if (numMedia > 0) {
      const mediaUrl = String(form.get("MediaUrl0") ?? "");
      const mediaType = String(form.get("MediaContentType0") ?? "");
      if (mediaType.startsWith("audio")) {
        try {
          const { b64, mime } = await downloadMediaAsBase64(mediaUrl);
          const transcript = await transcribeAudio(b64, mime);
          text = `${body ? body + " " : ""}${transcript}`.trim();
        } catch (e: any) {
          return twiml(`⚠️ Não consegui ler o áudio: ${e.message}`);
        }
      }
    }
    if (!text) return twiml("Envie texto ou áudio descrevendo o serviço/despesa. Digite *ajuda* para ver exemplos.");

    // 3. Parse intent
    const parsed = await parseIntent(text);

    if (parsed.kind === "ajuda") {
      return twiml(
        "🛠️ *Reboque Piauí*\n\n" +
          "Envie texto ou áudio. Exemplos:\n\n" +
          "• _Guincho do João, Teresina pra Timon, R$250, 35km, dinheiro_\n" +
          "• _Mecânica Maria, troca de óleo, R$180, pix_\n" +
          "• _Despesa combustível R$200_\n" +
          "• _Despesa manutenção R$450, troca de pneu_"
      );
    }
    if (parsed.kind === "indefinido") {
      return twiml(`🤔 ${parsed.motivo}. Tente algo como: "Guincho do João, R$250, dinheiro" ou digite *ajuda*.`);
    }

    if (parsed.kind === "servico") {
      const cliNome = parsed.cliente?.trim() || "Cliente WhatsApp";
      const tipo = normalizeTipoServico(parsed.tipo);
      const pagamento = normalizePagamento(parsed.pagamento);
      const { data: existingCli } = await supabaseAdmin
        .from("clientes").select("id").ilike("nome", cliNome).maybeSingle();
      if (!existingCli) {
        await supabaseAdmin.from("clientes").insert({ nome: cliNome, telefone: phone });
      }

      // Resolve motorista by name (fuzzy match against active drivers)
      let motoristaId: string | null = null;
      let motoristaNome: string | null = null;
      let motoristaComissaoPct = 0;
      let motoristaComissaoValor = 0;
      const motNomeRaw = parsed.motorista?.trim();
      if (motNomeRaw) {
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
        const target = norm(motNomeRaw);
        const ativos = (motoristas ?? []).filter((m: any) => m.ativo);
        const match =
          ativos.find((m: any) => norm(m.nome) === target) ??
          ativos.find((m: any) => norm(m.nome).includes(target) || target.includes(norm(m.nome))) ??
          ativos.find((m: any) => target.split(/\s+/).some((tok) => tok.length >= 3 && norm(m.nome).includes(tok)));
        if (match) {
          motoristaId = match.id;
          motoristaNome = match.nome;
          motoristaComissaoPct = Number(match.comissao_pct ?? 0);
          motoristaComissaoValor = Number(match.comissao_valor ?? 0);
        }
      }

      // Resolve caminhão (frota) by name/placa fuzzy match
      let veiculoFrotaId: string | null = null;
      let veiculoFrotaLabel: string | null = null;
      const camRaw = parsed.caminhao?.trim();
      if (camRaw) {
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");
        const target = norm(camRaw);
        const list = veiculosFrota ?? [];
        const match =
          list.find((v: any) => norm(v.placa ?? "") === target) ??
          list.find((v: any) => norm(v.modelo ?? "") === target) ??
          list.find((v: any) => target && (norm(v.placa ?? "").includes(target) || target.includes(norm(v.placa ?? "")))) ??
          list.find((v: any) => target && (norm(v.modelo ?? "").includes(target) || target.includes(norm(v.modelo ?? "")))) ??
          list.find((v: any) => target && norm((v.marca ?? "") + (v.modelo ?? "")).includes(target));
        if (match) {
          veiculoFrotaId = match.id;
          veiculoFrotaLabel = `${match.modelo}${match.placa ? ` (${match.placa})` : ""}`;
        }
      }
      const valorSvc = Number(parsed.valor ?? 0);
      // Comissão: valor fixo do motorista tem prioridade; senão usa percentual
      const comissaoValor = motoristaComissaoValor > 0
        ? motoristaComissaoValor
        : (valorSvc * motoristaComissaoPct) / 100;

      let km = parsed.km ?? 0;
      if (!km && parsed.origem && parsed.destino && process.env.ORS_API_KEY) {
        try {
          const route = await calculateRouteDistance(parsed.origem, parsed.destino, process.env.ORS_API_KEY);
          km = route.km;
        } catch (e) {
          console.error("[whatsapp] distancia", e);
        }
      }

      // Pick first active account as default Pix destination
      const { data: contaAtiva } = await supabaseAdmin
        .from("contas").select("id").eq("ativa", true).limit(1).maybeSingle();

      const { data: novoSvc, error } = await supabaseAdmin.from("servicos").insert({
        cliente: cliNome,
        telefone: phone,
        tipo,
        valor: valorSvc,
        km,
        origem: parsed.origem ?? null,
        destino: parsed.destino ?? null,
        pagamento,
        obs: parsed.obs ?? `Via WhatsApp por ${callerNome}`,
        motorista_id: motoristaId,
        veiculo_id: veiculoFrotaId,
        comissao_pct: motoristaComissaoPct,
        comissao_valor: comissaoValor,
        conta_id: contaAtiva?.id ?? null,
        status: motoristaId ? "Pendente" : "Finalizado",
        via: "whatsapp",
        placa: parsed.placa ?? null,
        veiculo_modelo: parsed.veiculoModelo ?? null,
        veiculo_ano: parsed.veiculoAno ?? null,
      }).select("id, numero").single();
      if (error) return twiml(`❌ Erro ao salvar serviço: ${error.message}`);

      // Notify driver
      let notifyMsg = "";
      if (motoristaId && novoSvc?.id) {
        try {
          const { notifyDriverNewService } = await import("@/lib/notify-driver.functions");
          const r: any = await notifyDriverNewService({ data: { servicoId: novoSvc.id } });
          notifyMsg = r?.ok ? `📨 Motorista notificado: ${motoristaNome}` : `⚠️ Não notifiquei ${motoristaNome}: ${r?.reason ?? "erro"}`;
        } catch (e: any) {
          notifyMsg = `⚠️ Falha ao notificar ${motoristaNome}: ${e?.message ?? "erro"}`;
        }
      } else if (motNomeRaw && !motoristaId) {
        notifyMsg = `⚠️ Motorista "${motNomeRaw}" não encontrado no cadastro`;
      }
      let camMsg = "";
      if (veiculoFrotaLabel) camMsg = `🚚 Guincho: ${veiculoFrotaLabel}`;
      else if (camRaw && !veiculoFrotaId) camMsg = `⚠️ Caminhão "${camRaw}" não encontrado no cadastro`;
      // Generate OS PDF for the manager to forward to the client
      let osUrl: string | undefined;
      try {
        const { generateOsPdf } = await import("@/lib/os-pdf.server");
        osUrl = await generateOsPdf(novoSvc!.id);
      } catch (e: any) {
        console.error("[whatsapp] OS PDF error", e);
      }

      const headerLine = `📄 OS ${novoSvc?.numero ?? ""} — ${cliNome}`.trim();
      const extras = [notifyMsg, camMsg].filter(Boolean).join("\n");
      const body = osUrl
        ? `${headerLine}\nEncaminhe este PDF ao cliente.${extras ? `\n${extras}` : ""}`
        : `✅ Serviço registrado\n${headerLine}${extras ? `\n${extras}` : ""}\n⚠️ Não foi possível gerar a OS em PDF.`;

      return twiml(body, osUrl);
    }

    if (parsed.kind === "despesa") {
      const tipo = normalizeTipoDespesa(parsed.tipo);
      const { error } = await supabaseAdmin.from("despesas").insert({
        tipo,
        valor: parsed.valor ?? 0,
        responsavel: parsed.responsavel ?? callerNome,
        obs: parsed.obs ?? `Via WhatsApp por ${callerNome}`,
        via: "whatsapp",
      });
      if (error) return twiml(`❌ Erro ao salvar despesa: ${error.message}`);
      return twiml(
        `✅ Despesa registrada\n` +
          `📂 ${tipo}\n` +
          `💰 R$ ${(parsed.valor ?? 0).toFixed(2)}\n` +
          `👤 ${parsed.responsavel ?? callerNome}`
      );
    }

    return twiml("Não consegui processar. Digite *ajuda*.");
  } catch (e: any) {
    console.error("[whatsapp] erro", e);
    return twiml(`⚠️ Erro interno: ${e?.message ?? "desconhecido"}`);
  }
}

export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      GET: () => new Response("WhatsApp webhook ativo. Configure este URL no Twilio (POST).", { status: 200 }),
    },
  },
});
