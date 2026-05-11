import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, brl, useDB, type Driver, type Expense } from "@/lib/data";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { rangeFromPreset, inRange, type DateRange } from "@/lib/date-range";
import { HandCoins, Printer, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyManagersCommissionClosed } from "@/lib/notify-manager.functions";
import { rangeLabel } from "@/lib/date-range";

export const Route = createFileRoute("/comissoes")({
  head: () => ({ meta: [{ title: "Comissões — Reboque Piauí" }] }),
  component: Page,
});

const RESPONSAVEL_FIXO = "Francisco Chagas";

function Page() {
  const data = useDB();
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("month"));
  const [selected, setSelected] = useState<Driver | null>(null);

  const motoristas = data.drivers;

  const stats = useMemo(() => {
    return motoristas.map((d) => {
      const comissoes = data.expenses.filter(
        (e) => e.tipo === "Comissão" && e.motoristaId === d.id && inRange(e.data, range),
      );
      const servicosFin = data.services.filter(
        (s) => s.motoristaId === d.id && s.status === "Finalizado" && inRange(s.data, range),
      );
      const fat = servicosFin.reduce((a, s) => a + s.valor, 0);
      const total = comissoes.reduce((a, e) => a + e.valor, 0);
      const pago = comissoes.filter((e) => e.pago).reduce((a, e) => a + e.valor, 0);
      const pendente = comissoes.filter((e) => !e.pago).reduce((a, e) => a + e.valor, 0);
      return { driver: d, chamados: servicosFin.length, fat, total, pago, pendente };
    });
  }, [motoristas, data.expenses, data.services, range]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comissões"
        description="Fechamento por motorista no período selecionado."
      />

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Motorista</TableHead>
              <TableHead className="text-right">Chamados</TableHead>
              <TableHead className="text-right">Faturado</TableHead>
              <TableHead className="text-right">Comissão total</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Pendente</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((s) => (
              <TableRow key={s.driver.id} className="border-border">
                <TableCell>
                  <div className="font-medium">{s.driver.nome}</div>
                  <div className="text-xs text-muted-foreground">{s.driver.telefone}</div>
                </TableCell>
                <TableCell className="text-right">{s.chamados}</TableCell>
                <TableCell className="text-right">{brl(s.fat)}</TableCell>
                <TableCell className="text-right">{brl(s.total)}</TableCell>
                <TableCell className="text-right text-success">{brl(s.pago)}</TableCell>
                <TableCell className={`text-right font-semibold ${s.pendente > 0 ? "text-warning" : "text-muted-foreground"}`}>
                  {brl(s.pendente)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" className="gap-1" onClick={() => setSelected(s.driver)} disabled={s.total === 0}>
                    <HandCoins className="h-3.5 w-3.5" /> Fechar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {stats.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Nenhum motorista cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <DriverClosingDialog
          driver={selected}
          range={range}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function DriverClosingDialog({ driver, range, onClose }: { driver: Driver; range: DateRange; onClose: () => void }) {
  const data = useDB();
  const comissoes = useMemo(
    () =>
      data.expenses
        .filter((e) => e.tipo === "Comissão" && e.motoristaId === driver.id && inRange(e.data, range))
        .sort((a, b) => +new Date(a.data) - +new Date(b.data)),
    [data.expenses, driver.id, range],
  );

  const pendentes = comissoes.filter((e) => !e.pago);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(pendentes.map((e) => e.id)));
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const totalSel = pendentes.filter((e) => picked.has(e.id)).reduce((a, e) => a + e.valor, 0);

  const servicoOf = (servicoId: string | null | undefined) =>
    servicoId ? data.services.find((s) => s.id === servicoId) : undefined;

  const notifyClosed = useServerFn(notifyManagersCommissionClosed);

  const pagarSelecionados = async () => {
    if (picked.size === 0) return toast.error("Selecione ao menos um chamado.");
    setSaving(true);
    try {
      const ids = Array.from(picked);
      await Promise.all(ids.map((id) => api.markExpensePaid(id, true)));
      toast.success(`Comissões pagas: ${brl(totalSel)}`);
      notifyClosed({ data: {
        motoristaId: driver.id,
        qtd: ids.length,
        total: totalSel,
        periodo: rangeLabel(range),
        obs: obs || undefined,
      } }).catch(() => {});
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao pagar comissões");
    } finally {
      setSaving(false);
    }
  };

  const imprimirRecibo = (apenasSelecionados: boolean) => {
    const lista: Expense[] = apenasSelecionados
      ? pendentes.filter((e) => picked.has(e.id))
      : comissoes.filter((e) => e.pago);
    if (lista.length === 0) {
      return toast.error(apenasSelecionados ? "Nada selecionado." : "Nenhuma comissão paga no período.");
    }
    const total = lista.reduce((a, e) => a + e.valor, 0);
    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) return toast.error("Permita pop-ups para imprimir o recibo");
    const hoje = new Date().toLocaleDateString("pt-BR");
    const periodo = `${new Date(range.from!).toLocaleDateString("pt-BR")} a ${new Date(range.to!).toLocaleDateString("pt-BR")}`;
    const linhas = lista
      .map((e) => {
        const sv = servicoOf(e.servicoId);
        const dt = new Date(e.data).toLocaleDateString("pt-BR");
        const cli = sv?.cliente ?? "—";
        const trecho = sv ? `${sv.origem ?? ""} → ${sv.destino ?? ""}` : (e.obs ?? "");
        const km = sv ? `${Number(sv.km ?? 0).toFixed(1)} km` : "";
        return `<tr><td>${dt}</td><td>${cli}</td><td>${trecho}</td><td style="text-align:right">${km}</td><td style="text-align:right"><strong>${brl(e.valor)}</strong></td></tr>`;
      })
      .join("");

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recibo de Comissão — ${driver.nome}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:32px;max-width:820px;margin:0 auto}
  h1{margin:0 0 4px;font-size:22px;text-align:center;letter-spacing:1px}
  .sub{text-align:center;color:#555;font-size:12px;margin-bottom:24px;text-transform:uppercase;letter-spacing:2px}
  .box{border:2px solid #111;padding:20px;border-radius:8px}
  .row{margin:6px 0;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}
  th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f5f5f5;text-transform:uppercase;font-size:11px;letter-spacing:1px}
  .total{font-size:24px;font-weight:bold;text-align:center;padding:12px;border:2px dashed #111;margin:16px 0;border-radius:8px}
  .text{font-size:13px;line-height:1.7;text-align:justify;margin:18px 0}
  .sign{margin-top:60px;display:flex;justify-content:space-between;gap:40px}
  .sign div{flex:1;text-align:center}
  .sign hr{border:none;border-top:1px solid #111;margin-bottom:6px}
  .sign small{font-size:11px;color:#555;display:block;text-transform:uppercase;letter-spacing:1px}
  .footer{margin-top:24px;text-align:center;color:#777;font-size:11px}
  @media print{body{padding:0}}
</style></head><body>
  <h1>RECIBO DE COMISSÃO</h1>
  <div class="sub">Reboque Piauí · Fechamento</div>
  <div class="box">
    <div class="row"><strong>Motorista:</strong> ${driver.nome}</div>
    <div class="row"><strong>Período:</strong> ${periodo}</div>
    <div class="row"><strong>Data do recibo:</strong> ${hoje}</div>
    ${obs ? `<div class="row"><strong>Observação:</strong> ${obs}</div>` : ""}

    <table>
      <thead><tr><th>Data</th><th>Cliente</th><th>Trecho</th><th style="text-align:right">KM</th><th style="text-align:right">Comissão</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>

    <div class="total">${brl(total)}</div>

    <div class="text">
      Eu, <strong>${driver.nome}</strong>, declaro ter recebido de <strong>${RESPONSAVEL_FIXO}</strong>
      a importância de <strong>${brl(total)}</strong>, referente às comissões dos chamados listados acima,
      no período de ${periodo}.
    </div>

    <div class="sign">
      <div><hr><small>${driver.nome}</small><small>(Recebedor)</small></div>
      <div><hr><small>${RESPONSAVEL_FIXO}</small><small>(Responsável)</small></div>
    </div>
  </div>
  <div class="footer">Documento gerado eletronicamente — Reboque Piauí</div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-3xl">
        <DialogHeader>
          <DialogTitle>Fechamento — {driver.nome}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <Stat label="Pendentes" value={brl(pendentes.reduce((a, e) => a + e.valor, 0))} tone="warning" />
          <Stat label="Selecionado" value={brl(totalSel)} tone="primary" />
          <Stat label="Já pago no período" value={brl(comissoes.filter((e) => e.pago).reduce((a, e) => a + e.valor, 0))} tone="success" />
        </div>

        <div className="max-h-[360px] overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10"></TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente / chamado</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comissoes.map((e) => {
                const sv = servicoOf(e.servicoId);
                const isPend = !e.pago;
                return (
                  <TableRow key={e.id} className="border-border">
                    <TableCell>
                      {isPend ? (
                        <Checkbox checked={picked.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                    </TableCell>
                    <TableCell>{new Date(e.data).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <div>{sv?.cliente ?? e.obs ?? "—"}</div>
                      {sv && (
                        <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                          {sv.origem} → {sv.destino}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{sv ? `${Number(sv.km).toFixed(1)}` : "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{brl(e.valor)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] border ${e.pago ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/40"}`}>
                        {e.pago ? "Pago" : "Pendente"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              {comissoes.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sem comissões no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Observação (opcional)</Label>
          <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Fechamento de novembro/2025" />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button variant="outline" className="gap-1" onClick={() => imprimirRecibo(true)}>
            <Printer className="h-4 w-4" /> Recibo selecionados
          </Button>
          <Button className="gap-1" onClick={pagarSelecionados} disabled={saving || picked.size === 0}>
            <HandCoins className="h-4 w-4" /> Pagar selecionados ({brl(totalSel)})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "warning" | "success" | "primary" }) {
  const cls =
    tone === "warning"
      ? "border-warning/40 bg-warning/5 text-warning"
      : tone === "success"
        ? "border-success/30 bg-success/5 text-success"
        : "border-primary/30 bg-primary/5 text-primary";
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
