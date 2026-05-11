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
function brl(n: number) {
  return Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const notifyDriverMonthlyCommission = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY não configurada");

    const { data: svc, error: e1 } = await supabaseAdmin
      .from("servicos").select("id, numero, cliente, motorista_id, comissao_valor, status").eq("id", data.servicoId).single();
    if (e1 || !svc) throw new Error(`Serviço não encontrado: ${e1?.message}`);
    if (!svc.motorista_id) return { ok: false, reason: "Sem motorista" };

    const { data: motorista } = await supabaseAdmin
      .from("motoristas").select("nome, telefone").eq("id", svc.motorista_id).single();
    if (!motorista?.telefone) return { ok: false, reason: "Motorista sem telefone" };
    const to = toWhatsappNumber(motorista.telefone);
    if (!to) return { ok: false, reason: "Telefone inválido" };

    // Soma de comissões do mês corrente para esse motorista
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const fim = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data: despesas } = await supabaseAdmin
      .from("despesas")
      .select("valor, pago")
      .eq("motorista_id", svc.motorista_id)
      .eq("tipo", "Comissão")
      .gte("data", inicio)
      .lt("data", fim);

    const total = (despesas ?? []).reduce((s, d: any) => s + Number(d.valor ?? 0), 0);
    const pendente = (despesas ?? []).filter((d: any) => d.pago === false).reduce((s, d: any) => s + Number(d.valor ?? 0), 0);

    const mesNome = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const body = [
      `✅ *Chamado finalizado* ${(svc as any).numero ?? ""} — ${svc.cliente}`.replace(/  +/g, " "),
      `💵 Comissão deste chamado: ${brl(Number(svc.comissao_valor ?? 0))}`,
      ``,
      `📊 *Resumo do mês (${mesNome})*`,
      `• Total acumulado: ${brl(total)}`,
      `• A receber (pendente): ${brl(pendente)}`,
    ].join("\n");

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
    return { ok: true, sid: json.sid, total, pendente };
  });
