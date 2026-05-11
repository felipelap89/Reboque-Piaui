import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { brl, useDB } from "@/lib/data";
import { Wallet, TrendingDown, TrendingUp, Banknote, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { rangeFromPreset, inRange, type DateRange } from "@/lib/date-range";

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Reboque Piauí" }] }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { services, expenses, accounts, drivers } = useDB();
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("month"));
  const [contaFilter, setContaFilter] = useState<string>("all");

  const accById = useMemo(() => new Map(accounts.map(a => [a.id, a.nome])), [accounts]);

  const fServices = useMemo(
    () => services
      .filter(s => inRange(s.data, range))
      .filter(s => contaFilter === "all" ? true : contaFilter === "none" ? !s.contaId : s.contaId === contaFilter),
    [services, range, contaFilter]
  );
  // Apenas despesas pagas saem do caixa (comissões pendentes ficam de fora)
  const fExpenses = useMemo(() => expenses.filter(e => inRange(e.data, range) && e.pago), [expenses, range]);

  const entradas = fServices.filter(s => s.status === "Finalizado");
  const totalEntradas = entradas.reduce((a,s)=>a+s.valor,0);
  const totalSaidas = fExpenses.reduce((a,e)=>a+e.valor,0);
  const lucro = totalEntradas - totalSaidas;

  // Resumo por conta (apenas Finalizados, dentro do período — ignora filtro de conta)
  const porConta = useMemo(() => {
    const periodFinalizados = services
      .filter(s => inRange(s.data, range))
      .filter(s => s.status === "Finalizado");
    const map = new Map<string, { nome: string; total: number; count: number }>();
    for (const s of periodFinalizados) {
      const key = s.contaId ?? "__none__";
      const nome = s.contaId ? (accById.get(s.contaId) ?? "Conta removida") : "Sem conta";
      const cur = map.get(key) ?? { nome, total: 0, count: 0 };
      cur.total += s.valor; cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a,b) => b.total - a.total);
  }, [services, range, accById]);

  const monthly = useMemo(() => {
    const map = new Map<string, { mes: string; entradas: number; saidas: number }>();
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1);
      map.set(fmt(d), { mes: fmt(d), entradas: 0, saidas: 0 });
    }
    entradas.forEach(s => { const k = fmt(new Date(s.data)); const m = map.get(k); if (m) m.entradas += s.valor; });
    fExpenses.forEach(e => { const k = fmt(new Date(e.data)); const m = map.get(k); if (m) m.saidas += e.valor; });
    return Array.from(map.values());
  }, [entradas, fExpenses]);

  const drvById = useMemo(() => new Map(drivers.map(d => [d.id, d.nome])), [drivers]);

  const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c] as string));

  const gerarFechamento = () => {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return toast.error("Permita pop-ups para gerar o relatório");

    const periodo = `${new Date(range.from!).toLocaleDateString("pt-BR")} a ${new Date(range.to!).toLocaleDateString("pt-BR")}`;
    const hoje = new Date().toLocaleString("pt-BR");

    // Todos os serviços do período (filtrado por conta também)
    const allServ = fServices.slice().sort((a,b) => +new Date(a.data) - +new Date(b.data));
    const finalizados = allServ.filter(s => s.status === "Finalizado");
    const cancelados = allServ.filter(s => s.status === "Cancelado");
    const pendentes = allServ.filter(s => s.status === "Pendente" || s.status === "Em andamento");

    const despPagas = fExpenses.slice().sort((a,b) => +new Date(a.data) - +new Date(b.data));
    const despPendPeriodo = expenses.filter(e => inRange(e.data, range) && !e.pago);

    // Por categoria
    const porCategoria = new Map<string, { total: number; qtd: number }>();
    despPagas.forEach(e => {
      const c = porCategoria.get(e.tipo) ?? { total: 0, qtd: 0 };
      c.total += e.valor; c.qtd += 1; porCategoria.set(e.tipo, c);
    });
    // Por forma de pagamento (entradas)
    const porPagamento = new Map<string, { total: number; qtd: number }>();
    finalizados.forEach(s => {
      const c = porPagamento.get(s.pagamento ?? "—") ?? { total: 0, qtd: 0 };
      c.total += s.valor; c.qtd += 1; porPagamento.set(s.pagamento ?? "—", c);
    });
    // Por tipo de serviço
    const porTipo = new Map<string, { total: number; qtd: number; km: number }>();
    finalizados.forEach(s => {
      const c = porTipo.get(s.tipo) ?? { total: 0, qtd: 0, km: 0 };
      c.total += s.valor; c.qtd += 1; c.km += Number(s.km ?? 0); porTipo.set(s.tipo, c);
    });
    // Por motorista
    const porMotorista = new Map<string, { nome: string; qtd: number; faturado: number; comissao: number }>();
    finalizados.forEach(s => {
      const key = s.motoristaId ?? "__none__";
      const nome = s.motoristaId ? (drvById.get(s.motoristaId) ?? "—") : "Sem motorista";
      const c = porMotorista.get(key) ?? { nome, qtd: 0, faturado: 0, comissao: 0 };
      c.qtd += 1; c.faturado += s.valor; c.comissao += Number(s.comissaoValor ?? 0);
      porMotorista.set(key, c);
    });

    const totalKm = finalizados.reduce((a,s) => a + Number(s.km ?? 0), 0);
    const totalComissaoPaga = despPagas.filter(e => e.tipo === "Comissão").reduce((a,e) => a + e.valor, 0);
    const totalComissaoPendente = despPendPeriodo.filter(e => e.tipo === "Comissão").reduce((a,e) => a + e.valor, 0);

    const ticketMedio = finalizados.length ? totalEntradas / finalizados.length : 0;

    const linhasEntradas = finalizados.map(s => `<tr>
      <td>${new Date(s.data).toLocaleDateString("pt-BR")}</td>
      <td>${esc(s.cliente)}</td>
      <td>${esc(s.tipo)}</td>
      <td>${esc(s.origem ?? "")} → ${esc(s.destino ?? "")}</td>
      <td style="text-align:right">${Number(s.km ?? 0).toFixed(1)}</td>
      <td>${esc(s.pagamento)}</td>
      <td>${esc(s.contaId ? (accById.get(s.contaId) ?? "—") : "—")}</td>
      <td>${esc(s.motoristaId ? (drvById.get(s.motoristaId) ?? "—") : "—")}</td>
      <td style="text-align:right">${brl(Number(s.comissaoValor ?? 0))}</td>
      <td style="text-align:right"><strong>${brl(s.valor)}</strong></td>
    </tr>`).join("");

    const linhasSaidas = despPagas.map(e => `<tr>
      <td>${new Date(e.data).toLocaleDateString("pt-BR")}</td>
      <td>${esc(e.tipo)}</td>
      <td>${esc(e.responsavel ?? "")}</td>
      <td>${esc(e.motoristaId ? (drvById.get(e.motoristaId) ?? "") : "")}</td>
      <td>${esc(e.obs ?? "")}</td>
      <td>${e.dataPagamento ? new Date(e.dataPagamento).toLocaleDateString("pt-BR") : "—"}</td>
      <td style="text-align:right"><strong>${brl(e.valor)}</strong></td>
    </tr>`).join("");

    const linhasPendentes = despPendPeriodo.map(e => `<tr>
      <td>${new Date(e.data).toLocaleDateString("pt-BR")}</td>
      <td>${esc(e.tipo)}</td>
      <td>${esc(e.responsavel ?? "")}</td>
      <td>${esc(e.obs ?? "")}</td>
      <td style="text-align:right">${brl(e.valor)}</td>
    </tr>`).join("");

    const rowsCat = Array.from(porCategoria.entries()).sort((a,b) => b[1].total - a[1].total)
      .map(([k,v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${v.qtd}</td><td style="text-align:right"><strong>${brl(v.total)}</strong></td></tr>`).join("");
    const rowsPag = Array.from(porPagamento.entries()).sort((a,b) => b[1].total - a[1].total)
      .map(([k,v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${v.qtd}</td><td style="text-align:right"><strong>${brl(v.total)}</strong></td></tr>`).join("");
    const rowsTipo = Array.from(porTipo.entries()).sort((a,b) => b[1].total - a[1].total)
      .map(([k,v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${v.qtd}</td><td style="text-align:right">${v.km.toFixed(1)} km</td><td style="text-align:right"><strong>${brl(v.total)}</strong></td></tr>`).join("");
    const rowsMot = Array.from(porMotorista.values()).sort((a,b) => b.faturado - a.faturado)
      .map(v => `<tr><td>${esc(v.nome)}</td><td style="text-align:right">${v.qtd}</td><td style="text-align:right">${brl(v.faturado)}</td><td style="text-align:right">${brl(v.comissao)}</td></tr>`).join("");
    const rowsConta = porConta
      .map(c => `<tr><td>${esc(c.nome)}</td><td style="text-align:right">${c.count}</td><td style="text-align:right"><strong>${brl(c.total)}</strong></td></tr>`).join("");

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Fechamento Financeiro — ${periodo}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:24px;max-width:900px;margin:0 auto;font-size:12px}
  h1{margin:0 0 4px;font-size:22px;text-align:center;letter-spacing:1px}
  h2{font-size:14px;margin:24px 0 8px;padding-bottom:4px;border-bottom:2px solid #111;text-transform:uppercase;letter-spacing:1px}
  .sub{text-align:center;color:#555;font-size:11px;margin-bottom:16px;text-transform:uppercase;letter-spacing:2px}
  .meta{text-align:center;font-size:11px;color:#666;margin-bottom:12px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
  .kpi{border:1px solid #ccc;border-radius:6px;padding:10px;text-align:center}
  .kpi .l{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px}
  .kpi .v{font-size:15px;font-weight:bold;margin-top:4px}
  .kpi.ok .v{color:#0a7d2c} .kpi.bad .v{color:#b00020}
  table{width:100%;border-collapse:collapse;margin:6px 0;font-size:11px}
  th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top}
  th{background:#f5f5f5;text-transform:uppercase;font-size:10px;letter-spacing:1px}
  tfoot td{border-top:2px solid #111;font-weight:bold;background:#fafafa}
  .summary{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .total-final{font-size:18px;font-weight:bold;text-align:center;padding:12px;border:2px dashed #111;margin:16px 0;border-radius:8px}
  .footer{margin-top:24px;text-align:center;color:#777;font-size:10px}
  @media print{body{padding:0} h2{page-break-after:avoid} table{page-break-inside:auto} tr{page-break-inside:avoid}}
</style></head><body>
  <h1>FECHAMENTO FINANCEIRO</h1>
  <div class="sub">Reboque Piauí</div>
  <div class="meta">Período: <strong>${periodo}</strong> · Emitido em ${hoje}${contaFilter !== "all" ? ` · Conta: ${esc(contaFilter === "none" ? "Sem conta" : (accById.get(contaFilter) ?? "—"))}` : ""}</div>

  <div class="kpis">
    <div class="kpi ok"><div class="l">Entradas</div><div class="v">${brl(totalEntradas)}</div></div>
    <div class="kpi bad"><div class="l">Saídas</div><div class="v">${brl(totalSaidas)}</div></div>
    <div class="kpi ${lucro>=0?'ok':'bad'}"><div class="l">Lucro líquido</div><div class="v">${brl(lucro)}</div></div>
    <div class="kpi"><div class="l">Chamados finalizados</div><div class="v">${finalizados.length}</div></div>
    <div class="kpi"><div class="l">Ticket médio</div><div class="v">${brl(ticketMedio)}</div></div>
    <div class="kpi"><div class="l">KM rodados</div><div class="v">${totalKm.toFixed(1)}</div></div>
    <div class="kpi"><div class="l">Cancelados</div><div class="v">${cancelados.length}</div></div>
    <div class="kpi"><div class="l">Em aberto</div><div class="v">${pendentes.length}</div></div>
  </div>

  <h2>Resumo por conta de recebimento</h2>
  <table><thead><tr><th>Conta</th><th style="text-align:right">Qtd</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rowsConta || `<tr><td colspan="3" style="text-align:center;color:#999">Nenhum recebimento.</td></tr>`}</tbody>
    <tfoot><tr><td>Total</td><td style="text-align:right">${finalizados.length}</td><td style="text-align:right">${brl(totalEntradas)}</td></tr></tfoot>
  </table>

  <h2>Resumo por forma de pagamento</h2>
  <table><thead><tr><th>Forma</th><th style="text-align:right">Qtd</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rowsPag || `<tr><td colspan="3" style="text-align:center;color:#999">—</td></tr>`}</tbody></table>

  <h2>Resumo por tipo de serviço</h2>
  <table><thead><tr><th>Tipo</th><th style="text-align:right">Qtd</th><th style="text-align:right">KM</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rowsTipo || `<tr><td colspan="4" style="text-align:center;color:#999">—</td></tr>`}</tbody></table>

  <h2>Resumo por motorista</h2>
  <table><thead><tr><th>Motorista</th><th style="text-align:right">Chamados</th><th style="text-align:right">Faturado</th><th style="text-align:right">Comissão</th></tr></thead>
    <tbody>${rowsMot || `<tr><td colspan="4" style="text-align:center;color:#999">—</td></tr>`}</tbody></table>

  <h2>Recebimentos detalhados (${finalizados.length})</h2>
  <table><thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Trecho</th><th style="text-align:right">KM</th><th>Pagto</th><th>Conta</th><th>Motorista</th><th style="text-align:right">Comissão</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${linhasEntradas || `<tr><td colspan="10" style="text-align:center;color:#999">Nenhum recebimento no período.</td></tr>`}</tbody>
    <tfoot><tr><td colspan="9">Total recebido</td><td style="text-align:right">${brl(totalEntradas)}</td></tr></tfoot>
  </table>

  <h2>Despesas pagas detalhadas (${despPagas.length})</h2>
  <table><thead><tr><th>Data</th><th>Categoria</th><th>Responsável</th><th>Motorista</th><th>Observação</th><th>Pagto em</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${linhasSaidas || `<tr><td colspan="7" style="text-align:center;color:#999">Nenhuma saída no período.</td></tr>`}</tbody>
    <tfoot><tr><td colspan="6">Total pago</td><td style="text-align:right">${brl(totalSaidas)}</td></tr></tfoot>
  </table>

  <h2>Despesas por categoria</h2>
  <table><thead><tr><th>Categoria</th><th style="text-align:right">Qtd</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rowsCat || `<tr><td colspan="3" style="text-align:center;color:#999">—</td></tr>`}</tbody></table>

  <h2>Pendências do período (${despPendPeriodo.length})</h2>
  <table><thead><tr><th>Data</th><th>Categoria</th><th>Responsável</th><th>Observação</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${linhasPendentes || `<tr><td colspan="5" style="text-align:center;color:#999">Sem pendências.</td></tr>`}</tbody>
    <tfoot><tr><td colspan="4">Total pendente</td><td style="text-align:right">${brl(despPendPeriodo.reduce((a,e)=>a+e.valor,0))}</td></tr></tfoot>
  </table>

  <h2>Comissões</h2>
  <table>
    <tr><td>Comissões pagas no período</td><td style="text-align:right"><strong>${brl(totalComissaoPaga)}</strong></td></tr>
    <tr><td>Comissões pendentes (lançadas no período)</td><td style="text-align:right"><strong>${brl(totalComissaoPendente)}</strong></td></tr>
  </table>

  <div class="total-final">RESULTADO LÍQUIDO DO PERÍODO: ${brl(lucro)}</div>

  <div class="footer">Documento gerado eletronicamente — Reboque Piauí · Para salvar em PDF, escolha "Salvar como PDF" no diálogo de impressão.</div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Controle financeiro" description="Entradas, saídas, lucro e fluxo de caixa." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <DateRangeFilter value={range} onChange={setRange} />
        <Select value={contaFilter} onValueChange={setContaFilter}>
          <SelectTrigger className="w-full sm:w-64 bg-card"><SelectValue placeholder="Conta de pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            <SelectItem value="none">Sem conta</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={gerarFechamento} className="sm:ml-auto gap-2">
          <FileText className="h-4 w-4" /> Fechamento (PDF)
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total entradas" value={brl(totalEntradas)} icon={TrendingUp} tone="success" />
        <StatCard label="Total saídas" value={brl(totalSaidas)} icon={TrendingDown} tone="danger" />
        <StatCard label="Lucro líquido" value={brl(lucro)} icon={Wallet} tone={lucro>=0?"success":"danger"} />
        <StatCard label="Lucro bruto" value={brl(totalEntradas)} icon={Banknote} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold mb-4">Recebimentos por conta — período</h3>
        {porConta.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento finalizado no período.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {porConta.map(c => (
              <div key={c.id} className="rounded-xl border border-border bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">{c.nome}</div>
                <div className="mt-1 text-xl font-semibold text-success">{brl(c.total)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{c.count} {c.count === 1 ? "atendimento" : "atendimentos"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold mb-4">Fluxo de caixa — 6 meses</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => brl(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="entradas" name="Entradas" fill="var(--chart-2)" radius={[8,8,0,0]} />
              <Bar dataKey="saidas" name="Saídas" fill="var(--chart-4)" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Tabs defaultValue="entradas">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
          <TabsTrigger value="saidas">Saídas</TabsTrigger>
        </TabsList>
        <TabsContent value="entradas" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow className="border-border hover:bg-transparent">
                <TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Pagamento</TableHead><TableHead>Conta</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {entradas.map(s => (
                  <TableRow key={s.id} className="border-border">
                    <TableCell>{new Date(s.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{s.cliente}</TableCell>
                    <TableCell>{s.tipo}</TableCell>
                    <TableCell>{s.pagamento}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.contaId ? (accById.get(s.contaId) ?? "—") : "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-success">{brl(s.valor)}</TableCell>
                  </TableRow>
                ))}
                {entradas.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem entradas no filtro selecionado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="saidas" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader><TableRow className="border-border hover:bg-transparent">
                <TableHead>Data</TableHead><TableHead>Categoria</TableHead><TableHead>Responsável</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {fExpenses.map(e => (
                  <TableRow key={e.id} className="border-border">
                    <TableCell>{new Date(e.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{e.tipo}</TableCell>
                    <TableCell>{e.responsavel}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{brl(e.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
