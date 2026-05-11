import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

function digitsOnly(s: string) { return (s ?? "").replace(/\D/g, ""); }
function toWhatsappNumber(raw: string) {
  let d = digitsOnly(raw);
  if (!d) return null;
  if (d.length <= 11) d = "55" + d;
  return `whatsapp:+${d}`;
}
function brl(n: number) {
  return Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function sendTwilio(to: string, body: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY!;
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY!;
  const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
  const params = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body });
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
  return json.sid as string;
}

async function getManagers() {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("nome, telefone, receber_notificacoes")
    .eq("receber_notificacoes", true);
  return (data ?? []).filter((p: any) => p.telefone && digitsOnly(p.telefone).length >= 8);
}

export async function notifyManagersServiceFinalizedDirect(servicoId: string) {
  if (!process.env.LOVABLE_API_KEY || !process.env.TWILIO_API_KEY) {
    return { ok: false, reason: "Twilio/Lovable API key não configurada" };
  }
  const { data: svc } = await supabaseAdmin
    .from("servicos").select("*").eq("id", servicoId).single();
  if (!svc) return { ok: false, reason: "Serviço não encontrado" };

  const { data: motorista } = svc.motorista_id
    ? await supabaseAdmin.from("motoristas").select("nome").eq("id", svc.motorista_id).single()
    : { data: null as any };

  const managers = await getManagers();
  if (managers.length === 0) return { ok: false, reason: "Nenhum gestor com notificação ativa" };

  const lines = [
    `✅ *Chamado finalizado* ${svc.numero ?? ""}`.trim(),
    `👤 Cliente: ${svc.cliente}`,
    motorista?.nome ? `🚚 Motorista: ${motorista.nome}` : null,
    `🛠️ ${svc.tipo}${Number(svc.km ?? 0) > 0 ? ` • ${Number(svc.km).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : ""}`,
    `💰 ${brl(Number(svc.valor ?? 0))}${svc.pagamento ? ` (${svc.pagamento})` : ""}`,
    Number(svc.comissao_valor ?? 0) > 0 ? `💵 Comissão: ${brl(Number(svc.comissao_valor))}` : null,
    svc.origem || svc.destino ? `📍 ${svc.origem ?? "?"} → ${svc.destino ?? "?"}` : null,
  ].filter(Boolean);
  const body = lines.join("\n");

  const sids: string[] = [];
  const errors: string[] = [];
  for (const m of managers) {
    const to = toWhatsappNumber(m.telefone!);
    if (!to) continue;
    try { sids.push(await sendTwilio(to, body)); }
    catch (e: any) { errors.push(`${m.nome}: ${e?.message ?? "erro"}`); }
  }
  return { ok: sids.length > 0, sent: sids.length, errors };
}

export const notifyManagersServiceFinalized = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ servicoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => notifyManagersServiceFinalizedDirect(data.servicoId));

async function broadcast(body: string) {
  if (!process.env.LOVABLE_API_KEY || !process.env.TWILIO_API_KEY) {
    return { ok: false, reason: "Twilio/Lovable API key não configurada" };
  }
  const managers = await getManagers();
  if (managers.length === 0) return { ok: false, reason: "Nenhum gestor com notificação ativa" };
  const sids: string[] = [];
  const errors: string[] = [];
  for (const m of managers) {
    const to = toWhatsappNumber(m.telefone!);
    if (!to) continue;
    try { sids.push(await sendTwilio(to, body)); }
    catch (e: any) { errors.push(`${m.nome}: ${e?.message ?? "erro"}`); }
  }
  return { ok: sids.length > 0, sent: sids.length, errors };
}

export const notifyManagersExpenseCreated = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ despesaId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: e } = await supabaseAdmin.from("despesas").select("*").eq("id", data.despesaId).single();
    if (!e) return { ok: false, reason: "Despesa não encontrada" };
    let beneficiario = e.responsavel ?? "";
    if (e.motorista_id) {
      const { data: m } = await supabaseAdmin.from("motoristas").select("nome").eq("id", e.motorista_id).single();
      if (m?.nome) beneficiario = m.nome;
    }
    const lines = [
      `📥 *Nova despesa lançada*`,
      `🏷️ ${e.tipo} • ${brl(Number(e.valor ?? 0))}`,
      beneficiario ? `👤 ${e.motorista_id ? "Motorista" : "Responsável"}: ${beneficiario}` : null,
      e.obs ? `📝 ${e.obs}` : null,
      `Status: ${e.pago ? "✅ Paga (saiu do caixa)" : "⏳ Pendente"}`,
    ].filter(Boolean);
    return broadcast(lines.join("\n"));
  });

export const notifyManagersExpensePaid = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ despesaId: z.string().uuid(), pago: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { data: e } = await supabaseAdmin.from("despesas").select("*").eq("id", data.despesaId).single();
    if (!e) return { ok: false, reason: "Despesa não encontrada" };
    let beneficiario = e.responsavel ?? "";
    if (e.motorista_id) {
      const { data: m } = await supabaseAdmin.from("motoristas").select("nome").eq("id", e.motorista_id).single();
      if (m?.nome) beneficiario = m.nome;
    }
    const lines = [
      data.pago ? `✅ *Despesa paga* (saiu do caixa)` : `↩️ *Despesa estornada* (voltou para pendente)`,
      `🏷️ ${e.tipo} • ${brl(Number(e.valor ?? 0))}`,
      beneficiario ? `👤 ${e.motorista_id ? "Motorista" : "Responsável"}: ${beneficiario}` : null,
      e.obs ? `📝 ${e.obs}` : null,
    ].filter(Boolean);
    return broadcast(lines.join("\n"));
  });

export const notifyManagersCommissionClosed = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    motoristaId: z.string().uuid(),
    qtd: z.number().int().min(1),
    total: z.number().min(0),
    periodo: z.string().optional(),
    obs: z.string().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { data: m } = await supabaseAdmin.from("motoristas").select("nome").eq("id", data.motoristaId).single();
    const lines = [
      `💵 *Fechamento de comissão*`,
      `👤 Motorista: ${m?.nome ?? "—"}`,
      data.periodo ? `📅 Período: ${data.periodo}` : null,
      `🧾 ${data.qtd} chamados • ${brl(data.total)}`,
      data.obs ? `📝 ${data.obs}` : null,
    ].filter(Boolean);
    return broadcast(lines.join("\n"));
  });

function startOfTodayFortaleza(): Date {
  // America/Fortaleza = UTC-3 (sem horário de verão)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const fort = new Date(utc - 3 * 60 * 60 * 1000);
  fort.setHours(0, 0, 0, 0);
  // converter de volta para timestamp UTC equivalente ao 00:00 em Fortaleza
  return new Date(fort.getTime() + 3 * 60 * 60 * 1000);
}

export const sendDailySummaryToManagers = createServerFn({ method: "POST" })
  .handler(async () => {
    if (!process.env.LOVABLE_API_KEY || !process.env.TWILIO_API_KEY) {
      return { ok: false, reason: "Twilio/Lovable API key não configurada" };
    }
    const inicio = startOfTodayFortaleza();
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

    const [{ data: servicos }, { data: despesas }] = await Promise.all([
      supabaseAdmin.from("servicos").select("status, valor, comissao_valor, motorista_id")
        .gte("data", inicio.toISOString()).lt("data", fim.toISOString()),
      supabaseAdmin.from("despesas").select("valor, pago")
        .gte("data", inicio.toISOString()).lt("data", fim.toISOString()),
    ]);

    const svcs = servicos ?? [];
    const finalizados = svcs.filter((s: any) => s.status === "Finalizado");
    const pendentes = svcs.filter((s: any) => s.status === "Pendente" || s.status === "Em andamento");
    const cancelados = svcs.filter((s: any) => s.status === "Cancelado");
    const faturamento = finalizados.reduce((s: number, x: any) => s + Number(x.valor ?? 0), 0);
    const comissoes = finalizados.reduce((s: number, x: any) => s + Number(x.comissao_valor ?? 0), 0);
    const desp = despesas ?? [];
    const despPagas = desp.filter((d: any) => d.pago).reduce((s: number, x: any) => s + Number(x.valor ?? 0), 0);
    const despPend = desp.filter((d: any) => !d.pago).reduce((s: number, x: any) => s + Number(x.valor ?? 0), 0);

    // Top motorista
    let topMotorista: { nome: string; qtd: number } | null = null;
    if (finalizados.length > 0) {
      const counts = new Map<string, number>();
      for (const f of finalizados) {
        if (!f.motorista_id) continue;
        counts.set(f.motorista_id, (counts.get(f.motorista_id) ?? 0) + 1);
      }
      if (counts.size > 0) {
        const [topId, qtd] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        const { data: mot } = await supabaseAdmin.from("motoristas").select("nome").eq("id", topId).single();
        if (mot) topMotorista = { nome: mot.nome, qtd };
      }
    }

    const dataStr = new Date(inicio.getTime() + 3 * 60 * 60 * 1000).toLocaleDateString("pt-BR");
    const lines = [
      `📊 *Resumo do dia — ${dataStr}*`,
      `✅ ${finalizados.length} finalizados • ⏳ ${pendentes.length} pendentes • ❌ ${cancelados.length} cancelados`,
      `💰 Faturamento: ${brl(faturamento)}`,
      `💵 Comissões geradas: ${brl(comissoes)}`,
      `📉 Despesas pagas: ${brl(despPagas)}${despPend > 0 ? ` • Pendentes: ${brl(despPend)}` : ""}`,
      topMotorista ? `🏆 Top motorista: ${topMotorista.nome} (${topMotorista.qtd} chamados)` : null,
    ].filter(Boolean);
    const body = lines.join("\n");

    const managers = await getManagers();
    if (managers.length === 0) return { ok: false, reason: "Nenhum gestor com notificação ativa" };

    const sids: string[] = [];
    const errors: string[] = [];
    for (const m of managers) {
      const to = toWhatsappNumber(m.telefone!);
      if (!to) continue;
      try { sids.push(await sendTwilio(to, body)); }
      catch (e: any) { errors.push(`${m.nome}: ${e?.message ?? "erro"}`); }
    }
    return { ok: sids.length > 0, sent: sids.length, errors };
  });
