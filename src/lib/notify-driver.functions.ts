import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

const inputSchema = z.object({ servicoId: z.string().uuid() });

function digitsOnly(s: string) { return (s ?? "").replace(/\D/g, ""); }
function toWhatsappNumber(raw: string) {
  let d = digitsOnly(raw);
  if (!d) return null;
  if (d.length <= 11) d = "55" + d;
  return `whatsapp:+${d}`;
}

export const notifyDriverNewService = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886"; // sandbox default
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY não configurada (conecte Twilio)");

    const { data: svc, error: e1 } = await supabaseAdmin
      .from("servicos").select("*").eq("id", data.servicoId).single();
    if (e1 || !svc) throw new Error(`Serviço não encontrado: ${e1?.message}`);

    if (!svc.motorista_id) return { ok: false, reason: "Sem motorista atribuído" };

    const [{ data: motorista }, { data: conta }] = await Promise.all([
      supabaseAdmin.from("motoristas").select("nome, telefone").eq("id", svc.motorista_id).single(),
      svc.conta_id
        ? supabaseAdmin.from("contas").select("nome, pix_key, qr_path").eq("id", svc.conta_id).single()
        : Promise.resolve({ data: null as any }),
    ]);
    if (!motorista?.telefone) return { ok: false, reason: "Motorista sem telefone" };

    const to = toWhatsappNumber(motorista.telefone);
    if (!to) return { ok: false, reason: "Telefone inválido" };

    const valor = Number(svc.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const comissaoVal = Number(svc.comissao_valor ?? 0);
    const comissaoStr = comissaoVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const lines = [
      `🚨 *Novo chamado* ${svc.numero ?? ""} — Reboque Piauí`.trim(),
      `👤 Cliente: ${svc.cliente}`,
      svc.telefone ? `📞 ${svc.telefone}` : null,
      `🛠️ Serviço: ${svc.tipo}`,
      svc.origem || svc.destino ? `📍 ${svc.origem ?? "?"} → ${svc.destino ?? "?"}` : null,
      Number(svc.km ?? 0) > 0 ? `📏 Distância total: ${Number(svc.km).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km (base → origem → destino → base)` : null,
      svc.veiculo_modelo || svc.placa ? `🚗 ${svc.veiculo_modelo ?? ""}${svc.placa ? ` (${svc.placa})` : ""}`.trim() : null,
      `💰 Valor: ${valor} (${svc.pagamento ?? "—"})`,
      `💵 Sua comissão: ${comissaoStr}`,
      conta?.nome ? `🏦 Conta: ${conta.nome}` : null,
      conta?.pix_key ? `🔑 Pix: ${conta.pix_key}` : null,
      svc.obs ? `📝 ${svc.obs}` : null,
    ].filter(Boolean);

    const body = lines.join("\n");
    const qrUrl = conta?.qr_path
      ? supabaseAdmin.storage.from("contas-qr").getPublicUrl(conta.qr_path).data.publicUrl
      : null;

    const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
    if (qrUrl) params.append("MediaUrl", qrUrl);

    const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const json: any = await res.json();
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${JSON.stringify(json)}`);
    return { ok: true, sid: json.sid };
  });
