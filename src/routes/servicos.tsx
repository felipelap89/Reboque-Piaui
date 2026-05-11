import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, brl, useDB, type Service, type ServiceStatus, type ServiceType, type PaymentMethod } from "@/lib/data";
import { notifyDriverNewService } from "@/lib/notify-driver.functions";
import { notifyDriverMonthlyCommission } from "@/lib/notify-commission.functions";
import { notifyManagersServiceFinalized } from "@/lib/notify-manager.functions";
import { calcDistance } from "@/lib/distance.functions";
import { useServerFn } from "@tanstack/react-start";
import { Plus, MoreHorizontal, CheckCircle2, FileText, Share2, Printer, Search, Pencil, Trash2, MessageCircle, Send, Route as RouteIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./index";
import { useAuth } from "@/hooks/use-auth";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { rangeFromPreset, inRange, type DateRange } from "@/lib/date-range";

export const Route = createFileRoute("/servicos")({
  head: () => ({ meta: [{ title: "Chamados — Reboque Piauí" }] }),
  component: ServicosPage,
});

const tipos: ServiceType[] = ["Guincho urbano","Guincho viagem","Mecânica","Chaveiro","Bateria","Pane seca","Outros"];
const pagamentos: PaymentMethod[] = ["Pix","Dinheiro","Cartão","Transferência"];
const statuses: ServiceStatus[] = ["Pendente","Em andamento","Finalizado","Cancelado"];

function ServicosPage() {
  const data = useDB();
  const { isAdmin } = useAuth();
  const notifyFn = useServerFn(notifyDriverNewService);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("all"));

  const filtered = useMemo(() => {
    return data.services
      .filter(s => inRange(s.data, range))
      .filter(s => statusFilter === "all" || s.status === statusFilter)
      .filter(s => !q || `${s.numero} ${s.cliente} ${s.telefone} ${s.tipo} ${s.origem} ${s.destino}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a,b) => +new Date(b.data) - +new Date(a.data));
  }, [data.services, q, statusFilter, range]);

  const notifyCommission = useServerFn(notifyDriverMonthlyCommission);
  const notifyManagers = useServerFn(notifyManagersServiceFinalized);

  const updateStatus = async (id: string, status: ServiceStatus) => {
    try {
      await api.updateServiceStatus(id, status);
      toast.success(`Status atualizado para "${status}"`);
      if (status === "Finalizado") {
        // dispara em paralelo, sem bloquear UI
        notifyCommission({ data: { servicoId: id } })
          .then((r: any) => {
            if (r?.ok) toast.success("Motorista notificado da comissão do mês");
            else if (r?.reason) toast.message(`Comissão não enviada: ${r.reason}`);
          })
          .catch((e: any) => toast.error(`Falha ao notificar comissão: ${e?.message ?? "erro"}`));
        notifyManagers({ data: { servicoId: id } })
          .then((r: any) => {
            if (r?.ok) toast.success(`Gestor(es) notificados (${r.sent})`);
            else if (r?.reason) toast.message(`Gestor: ${r.reason}`);
          })
          .catch((e: any) => toast.error(`Falha ao notificar gestor: ${e?.message ?? "erro"}`));
      }
    }
    catch (e: any) { toast.error(e.message ?? "Erro"); }
  };

  const finalize = (s: Service) => updateStatus(s.id, "Finalizado");

  const shareWhats = (s: Service) => {
    const txt = `Recibo - Reboque Piauí\nCliente: ${s.cliente}\nServiço: ${s.tipo}\nValor: ${brl(s.valor)}\nPagamento: ${s.pagamento}`;
    const phone = s.telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (s: Service) => { setEditing(s); setOpen(true); };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await api.deleteService(toDelete.id); toast.success("Serviço removido"); }
    catch (e: any) { toast.error(e.message ?? "Erro ao remover"); }
    finally { setToDelete(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chamados"
        description="Apenas administradores abrem chamados. O motorista recebe os dados via WhatsApp."
        actions={isAdmin && <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Novo chamado</Button>}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <ServiceDialog key={editing?.id ?? "new"} initial={editing} onClose={() => { setOpen(false); setEditing(null); }} notifyFn={notifyFn} />
      </Dialog>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, cliente, telefone, tipo…" className="pl-8 bg-card" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motorista</TableHead>
              <TableHead className="hidden md:table-cell">Origem → Destino</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Distância</TableHead>
              <TableHead className="hidden sm:table-cell">Pagamento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(s => (
              <TableRow key={s.id} className="border-border">
                <TableCell>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(s.numero); toast.success(`${s.numero} copiado`); }}
                    className="font-mono text-xs font-semibold text-primary hover:underline"
                    title="Copiar número"
                  >
                    {s.numero || "—"}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className="font-medium">{s.cliente}</div>
                    {s.via === "whatsapp" && (
                      <span title="Recebido via WhatsApp" className="inline-flex items-center gap-0.5 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        <MessageCircle className="h-2.5 w-2.5" />WA
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.telefone}</div>
                </TableCell>
                <TableCell>{s.tipo}</TableCell>
                <TableCell className="text-sm">{data.drivers.find(d => d.id === s.motoristaId)?.nome ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{s.origem || "—"} → {s.destino || "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-right text-sm text-muted-foreground">{s.km ? `${s.km} km` : "—"}</TableCell>
                <TableCell className="hidden sm:table-cell">{s.pagamento}</TableCell>
                <TableCell className="text-right font-semibold text-success">{brl(s.valor)}</TableCell>
                <TableCell><StatusBadge status={s.status} /></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isAdmin && <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
                      <DropdownMenuItem onClick={() => finalize(s)}><CheckCircle2 className="mr-2 h-4 w-4" />Concluir chamado</DropdownMenuItem>
                      {isAdmin && s.motoristaId && (
                        <DropdownMenuItem onClick={async () => {
                          try { await notifyFn({ data: { servicoId: s.id } }); toast.success("Reenviado ao motorista"); }
                          catch (e: any) { toast.error(e.message ?? "Erro ao enviar"); }
                        }}><Send className="mr-2 h-4 w-4" />Reenviar ao motorista</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => toast.info("Recibo gerado (mock)")}> <FileText className="mr-2 h-4 w-4" />Gerar recibo</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir OS</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => shareWhats(s)}><Share2 className="mr-2 h-4 w-4" />Compartilhar WhatsApp</DropdownMenuItem>
                      {isAdmin && <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setToDelete(s)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                      </>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">Nenhum chamado encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O serviço de {toDelete?.cliente} será removido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ServiceDialog({ initial, onClose, notifyFn }: { initial: Service | null; onClose: () => void; notifyFn: (opts: { data: { servicoId: string } }) => Promise<any> }) {
  const data = useDB();
  const calcFn = useServerFn(calcDistance);
  const [calcLoading, setCalcLoading] = useState(false);
  const [form, setForm] = useState<Partial<Service>>(initial ?? {
    tipo: "Guincho urbano", pagamento: "Pix", status: "Pendente", km: 0, valor: 0, comissaoValor: 0,
  });
  const set = (k: keyof Service, v: any) => setForm(f => ({ ...f, [k]: v }));

  const calcular = async () => {
    if (!form.origem || !form.destino) { toast.error("Informe origem e destino"); return; }
    setCalcLoading(true);
    try {
      const r = await calcFn({ data: { origem: form.origem, destino: form.destino } });
      setForm(f => ({ ...f, km: r.km }));
      toast.success(`Distância total (base → origem → destino → base): ${r.km} km (~${r.durationMin} min)`);
    } catch (e: any) { toast.error(e.message ?? "Erro ao calcular"); }
    finally { setCalcLoading(false); }
  };

  // Auto-preencher placa/modelo ao escolher veículo
  const onVeiculoChange = (id: string) => {
    const v = data.vehicles.find(x => x.id === id);
    setForm(f => ({ ...f, veiculoId: id, placa: v?.placa ?? f.placa, veiculoModelo: v?.modelo ?? f.veiculoModelo }));
  };

  const submit = async () => {
    if (!form.cliente || !form.telefone) {
      toast.error("Cliente e telefone são obrigatórios."); return;
    }
    if (!form.motoristaId) { toast.error("Selecione o motorista."); return; }
    // Auto-calcular distância se origem/destino preenchidos e km = 0
    let kmFinal = Number(form.km) || 0;
    if (kmFinal === 0 && form.origem && form.destino) {
      try {
        setCalcLoading(true);
        const r = await calcFn({ data: { origem: form.origem, destino: form.destino } });
        kmFinal = r.km;
        setForm(f => ({ ...f, km: r.km }));
        toast.success(`Distância calculada: ${r.km} km`);
      } catch (e: any) {
        toast.error(`Não foi possível calcular distância: ${e.message ?? e}`);
      } finally { setCalcLoading(false); }
    }
    try {
      const payload = {
        cliente: form.cliente!, telefone: form.telefone!,
        origem: form.origem ?? "", destino: form.destino ?? "",
        tipo: (form.tipo as ServiceType) || "Outros",
        valor: Number(form.valor) || 0,
        pagamento: (form.pagamento as PaymentMethod) || "Pix",
        km: kmFinal,
        motoristaId: form.motoristaId ?? null,
        veiculoId: form.veiculoId ?? null,
        status: (form.status as ServiceStatus) || "Pendente",
        data: form.data ?? new Date().toISOString(),
        obs: form.obs ?? null,
        contaId: form.contaId ?? null,
        comissaoValor: Number(form.comissaoValor) || 0,
        placa: form.placa ?? null,
        veiculoModelo: form.veiculoModelo ?? null,
      };
      if (initial) {
        await api.updateService(initial.id, payload);
        toast.success("Chamado atualizado");
      } else {
        const newId = await api.addService(payload);
        toast.success("Chamado aberto");
        try {
          const r = await notifyFn({ data: { servicoId: newId } });
          if (r?.ok) toast.success("Motorista notificado por WhatsApp");
          else toast.warning(`WhatsApp não enviado: ${r?.reason ?? "—"}`);
        } catch (e: any) {
          toast.error(`Falha ao notificar: ${e.message ?? "erro"}`);
        }
      }
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
  };

  const contasAtivas = data.accounts.filter(a => a.ativa || a.id === form.contaId);

  return (
    <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? `Editar chamado ${initial.numero}` : "Novo chamado"}</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente *"><Input value={form.cliente || ""} onChange={e => set("cliente", e.target.value)} /></Field>
        <Field label="Telefone do cliente *"><Input value={form.telefone || ""} onChange={e => set("telefone", e.target.value)} /></Field>
        <Field label="Origem *"><Input value={form.origem || ""} onChange={e => set("origem", e.target.value)} placeholder="Ex: Rua A, 123 - Teresina" /></Field>
        <Field label="Destino *"><Input value={form.destino || ""} onChange={e => set("destino", e.target.value)} placeholder="Ex: Av. B - Timon" /></Field>
        <Field label="Tipo">
          <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Distância (km)">
          <div className="flex gap-2">
            <Input type="number" value={form.km || 0} onChange={e => set("km", e.target.valueAsNumber)} />
            <Button type="button" variant="outline" size="icon" onClick={calcular} disabled={calcLoading} title="Calcular via mapa">
              {calcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RouteIcon className="h-4 w-4" />}
            </Button>
          </div>
        </Field>
        <Field label="Motorista *">
          <Select value={form.motoristaId ?? undefined} onValueChange={v => {
            const drv = data.drivers.find(d => d.id === v);
            setForm(f => ({ ...f, motoristaId: v, comissaoValor: f.comissaoValor || (drv?.comissaoValor ?? 0) }));
          }}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{data.drivers.filter(d => d.ativo || d.id === form.motoristaId).map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Veículo">
          <Select value={form.veiculoId ?? undefined} onValueChange={onVeiculoChange}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>{data.vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.modelo} · {v.placa}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Placa"><Input value={form.placa ?? ""} onChange={e => set("placa", e.target.value)} placeholder="ABC-1D23" /></Field>
        <Field label="Modelo do carro"><Input value={form.veiculoModelo ?? ""} onChange={e => set("veiculoModelo", e.target.value)} placeholder="Ex: Strada" /></Field>
        <Field label="Valor (R$)"><Input type="number" value={form.valor || 0} onChange={e => set("valor", e.target.valueAsNumber)} /></Field>
        <Field label="Forma de pagamento">
          <Select value={form.pagamento} onValueChange={v => set("pagamento", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{pagamentos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Conta de recebimento">
          <Select value={form.contaId ?? undefined} onValueChange={v => set("contaId", v)}>
            <SelectTrigger><SelectValue placeholder={contasAtivas.length ? "Selecionar" : "Nenhuma — cadastre em Contas"} /></SelectTrigger>
            <SelectContent>{contasAtivas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Comissão do motorista (R$)"><Input type="number" step="0.01" value={form.comissaoValor ?? 0} onChange={e => set("comissaoValor", e.target.valueAsNumber)} /></Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2"><Field label="Observações"><Textarea value={form.obs || ""} onChange={e => set("obs", e.target.value)} rows={2} /></Field></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>{initial ? "Salvar alterações" : "Abrir chamado e notificar motorista"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
