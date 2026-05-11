import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, brl, useDB, type Expense, type ExpenseCategory } from "@/lib/data";
import { Plus, Upload, MessageCircle, Printer, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { rangeFromPreset, inRange, type DateRange } from "@/lib/date-range";
import { useServerFn } from "@tanstack/react-start";
import { notifyManagersExpenseCreated, notifyManagersExpensePaid } from "@/lib/notify-manager.functions";

export const Route = createFileRoute("/despesas")({
  head: () => ({ meta: [{ title: "Despesas — Reboque Piauí" }] }),
  component: Page,
});

const cats: ExpenseCategory[] = ["Comissão","Combustível","Alimentação","Pedágio","Oficina","Peças","Manutenção","Funcionários","Internet","Energia","Outros"];
const RESPONSAVEL_FIXO = "Francisco Chagas";

function Page() {
  const data = useDB();
  const notifyCreated = useServerFn(notifyManagersExpenseCreated);
  const notifyPaid = useServerFn(notifyManagersExpensePaid);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Expense>>({ tipo: "Combustível", valor: 0 });
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("all"));
  const [catFilter, setCatFilter] = useState<string>("all");
  const [motoristaFilter, setMotoristaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredExpenses = useMemo(() => data.expenses
    .filter(e => inRange(e.data, range))
    .filter(e => catFilter === "all" || e.tipo === catFilter)
    .filter(e => motoristaFilter === "all" || e.motoristaId === motoristaFilter)
    .filter(e => statusFilter === "all" || (statusFilter === "pago" ? e.pago : !e.pago)),
    [data.expenses, range, catFilter, motoristaFilter, statusFilter]);

  const isComissao = form.tipo === "Comissão";

  const submit = async () => {
    if (!form.valor) return toast.error("Valor obrigatório.");
    if (isComissao && !form.motoristaId) return toast.error("Selecione o motorista.");
    if (!isComissao && !form.responsavel) return toast.error("Responsável obrigatório.");
    try {
      const motoristaNome = isComissao
        ? (data.drivers.find(d => d.id === form.motoristaId)?.nome ?? "")
        : "";
      const id = await api.addExpense({
        tipo: (form.tipo as ExpenseCategory) || "Outros",
        valor: Number(form.valor) || 0,
        responsavel: isComissao ? motoristaNome : form.responsavel!,
        obs: form.obs ?? null,
        motoristaId: isComissao ? (form.motoristaId ?? null) : null,
        pago: true, // despesas lançadas manualmente já saem do caixa
      });
      toast.success("Despesa registrada");
      notifyCreated({ data: { despesaId: id } }).catch(() => {});
      setForm({ tipo: "Combustível", valor: 0 });
      setOpen(false);
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
  };

  const totalPago = filteredExpenses.filter(e => e.pago).reduce((a,e)=>a+e.valor,0);
  const totalPendente = filteredExpenses.filter(e => !e.pago).reduce((a,e)=>a+e.valor,0);

  const togglePago = async (e: Expense) => {
    try {
      const novo = !e.pago;
      await api.markExpensePaid(e.id, novo);
      toast.success(e.pago ? "Marcado como pendente" : "Pagamento registrado — saiu do caixa");
      notifyPaid({ data: { despesaId: e.id, pago: novo } }).catch(() => {});
    } catch (err: any) { toast.error(err.message ?? "Erro"); }
  };

  const imprimirRecibo = (e: Expense) => {
    const motoristaNome = e.motoristaId
      ? (data.drivers.find(d => d.id === e.motoristaId)?.nome ?? e.responsavel)
      : e.responsavel;
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return toast.error("Permita pop-ups para imprimir o recibo");
    const dataFmt = new Date(e.data).toLocaleDateString("pt-BR");
    const valorExt = brl(e.valor);
    const isCom = e.tipo === "Comissão";
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${isCom ? "de Comissão" : ""} — Reboque Piauí</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:32px;max-width:720px;margin:0 auto}
  h1{margin:0 0 4px;font-size:22px;text-align:center;letter-spacing:1px}
  .sub{text-align:center;color:#555;font-size:12px;margin-bottom:24px;text-transform:uppercase;letter-spacing:2px}
  .box{border:2px solid #111;padding:20px;border-radius:8px}
  .row{margin:10px 0;font-size:14px;line-height:1.6}
  .valor{font-size:28px;font-weight:bold;text-align:center;padding:12px;border:2px dashed #111;margin:20px 0;border-radius:8px}
  .text{font-size:14px;line-height:1.8;text-align:justify;margin:24px 0}
  .sign{margin-top:80px;display:flex;justify-content:space-between;gap:40px}
  .sign div{flex:1;text-align:center}
  .sign hr{border:none;border-top:1px solid #111;margin-bottom:6px}
  .sign small{font-size:11px;color:#555;display:block;text-transform:uppercase;letter-spacing:1px}
  .footer{margin-top:30px;text-align:center;color:#777;font-size:11px}
  @media print{body{padding:0}}
</style></head><body>
  <h1>RECIBO ${isCom ? "DE COMISSÃO" : "DE PAGAMENTO"}</h1>
  <div class="sub">Reboque Piauí</div>
  <div class="box">
    <div class="valor">${valorExt}</div>
    <div class="text">
      Eu, <strong>${motoristaNome || "—"}</strong>, declaro ter recebido de <strong>${RESPONSAVEL_FIXO}</strong>
      a importância de <strong>${valorExt}</strong>, referente a <strong>${e.tipo}</strong>${e.obs ? ` (${e.obs})` : ""},
      pago em ${dataFmt}.
    </div>
    <div class="row"><strong>Data:</strong> ${dataFmt}</div>
    <div class="row"><strong>Categoria:</strong> ${e.tipo}</div>
    ${e.obs ? `<div class="row"><strong>Observações:</strong> ${e.obs}</div>` : ""}
    <div class="sign">
      <div><hr><small>${motoristaNome || "Beneficiário"}</small><small>(Recebedor)</small></div>
      <div><hr><small>${RESPONSAVEL_FIXO}</small><small>(Responsável)</small></div>
    </div>
  </div>
  <div class="footer">Documento gerado eletronicamente — Reboque Piauí</div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Despesas" description={`Pago: ${brl(totalPago)} · Pendente: ${brl(totalPendente)}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Nova despesa</Button></DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Categoria">
                  <Select value={form.tipo} onValueChange={v=>setForm(f=>({...f,tipo:v as ExpenseCategory, motoristaId: v==="Comissão" ? f.motoristaId : null }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{cats.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Valor (R$)"><Input type="number" step="0.01" value={form.valor||0} onChange={e=>setForm(f=>({...f,valor:e.target.valueAsNumber}))} /></F>
                {isComissao ? (
                  <F label="Motorista *">
                    <Select value={form.motoristaId ?? undefined} onValueChange={v=>{
                      const drv = data.drivers.find(d=>d.id===v);
                      setForm(f=>({ ...f, motoristaId: v, valor: f.valor || (drv?.comissaoValor ?? 0) }));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>{data.drivers.filter(d=>d.ativo || d.id===form.motoristaId).map(d=><SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </F>
                ) : (
                  <F label="Responsável *"><Input value={form.responsavel||""} onChange={e=>setForm(f=>({...f,responsavel:e.target.value}))} /></F>
                )}
                <F label="Comprovante">
                  <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary text-xs text-muted-foreground hover:bg-accent">
                    <Upload className="h-4 w-4" /> Upload de imagem
                    <input type="file" accept="image/*" className="hidden" onChange={()=>toast.info("Upload disponível com Lovable Cloud")} />
                  </label>
                </F>
                <div className="sm:col-span-2"><F label="Observações"><Textarea value={form.obs||""} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} placeholder={isComissao ? "Ex: Comissão dos chamados de outubro" : ""} /></F></div>
              </div>
              <DialogFooter><Button variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-full sm:w-56 bg-card"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {cats.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={motoristaFilter} onValueChange={setMotoristaFilter}>
          <SelectTrigger className="w-full sm:w-56 bg-card"><SelectValue placeholder="Motorista" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motoristas</SelectItem>
            {data.drivers.map(d=><SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pagas e pendentes</SelectItem>
            <SelectItem value="pendente">Apenas pendentes</SelectItem>
            <SelectItem value="pago">Apenas pagas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow className="border-border hover:bg-transparent">
            <TableHead>Data</TableHead><TableHead>Categoria</TableHead><TableHead>Beneficiário</TableHead><TableHead>Status</TableHead><TableHead>Observações</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filteredExpenses.map(e => {
              const motoristaNome = e.motoristaId ? (data.drivers.find(d=>d.id===e.motoristaId)?.nome ?? e.responsavel) : e.responsavel;
              return (
                <TableRow key={e.id} className="border-border">
                  <TableCell>{new Date(e.data).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{e.tipo}</span>
                      {e.tipo === "Comissão" && (
                        <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Comissão</span>
                      )}
                      {e.via === "whatsapp" && (
                        <span title="Recebido via WhatsApp" className="inline-flex items-center gap-0.5 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                          <MessageCircle className="h-2.5 w-2.5" />WA
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{motoristaNome}</TableCell>
                  <TableCell>
                    {e.pago ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" />Pago
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                        <Clock className="h-3 w-3" />Pendente
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{e.obs}</TableCell>
                  <TableCell className={`text-right font-semibold ${e.pago ? "text-destructive" : "text-muted-foreground"}`}>{brl(e.valor)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant={e.pago ? "ghost" : "default"}
                        size="sm"
                        className="h-8"
                        title={e.pago ? "Marcar como pendente" : "Marcar como pago (sai do caixa)"}
                        onClick={() => togglePago(e)}
                      >
                        {e.pago ? "Estornar" : "Pagar"}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir recibo" onClick={() => imprimirRecibo(e)} disabled={!e.pago && e.tipo === "Comissão"}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredExpenses.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhuma despesa encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
