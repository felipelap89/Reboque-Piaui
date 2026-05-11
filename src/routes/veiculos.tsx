import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, useDB, type Vehicle } from "@/lib/data";
import { Plus, Wrench, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/veiculos")({
  head: () => ({ meta: [{ title: "Veículos — Reboque Piauí" }] }),
  component: Page,
});

const empty: Partial<Vehicle> = { km: 0, consumoMedio: 5, proximaManutencaoKm: 0 };

function Page() {
  const data = useDB();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Partial<Vehicle>>(empty);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setForm(v); setOpen(true); };

  const submit = async () => {
    if (!form.modelo || !form.placa) return toast.error("Modelo e placa obrigatórios.");
    try {
      const payload = {
        modelo: form.modelo!,
        placa: form.placa!,
        km: Number(form.km) || 0,
        consumoMedio: Number(form.consumoMedio) || 0,
        proximaManutencaoKm: Number(form.proximaManutencaoKm) || 0,
        marca: form.marca ?? null,
        cor: form.cor ?? null,
      };
      if (editing) {
        await api.updateVehicle(editing.id, payload);
        toast.success("Veículo atualizado");
      } else {
        await api.addVehicle(payload);
        toast.success("Veículo cadastrado");
      }
      setForm(empty); setEditing(null); setOpen(false);
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteVehicle(deleteId);
      toast.success("Veículo removido");
    } catch (e: any) { toast.error(e.message ?? "Erro ao remover"); }
    finally { setDeleteId(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Veículos" description="Frota, manutenção e consumo."
        actions={
          <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Novo veículo</Button>
        }
      />

      <Dialog open={open} onOpenChange={(v)=>{ setOpen(v); if(!v){ setEditing(null); setForm(empty);} }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editing ? "Editar veículo" : "Novo veículo"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Modelo *"><Input value={form.modelo||""} onChange={e=>setForm(f=>({...f,modelo:e.target.value}))} /></F>
            <F label="Placa *"><Input value={form.placa||""} onChange={e=>setForm(f=>({...f,placa:e.target.value}))} /></F>
            <F label="Marca"><Input value={form.marca||""} onChange={e=>setForm(f=>({...f,marca:e.target.value}))} /></F>
            <F label="Cor"><Input value={form.cor||""} onChange={e=>setForm(f=>({...f,cor:e.target.value}))} /></F>
            <F label="Quilometragem"><Input type="number" value={form.km||0} onChange={e=>setForm(f=>({...f,km:e.target.valueAsNumber}))} /></F>
            <F label="Consumo médio (km/L)"><Input type="number" value={form.consumoMedio||0} onChange={e=>setForm(f=>({...f,consumoMedio:e.target.valueAsNumber}))} /></F>
            <F label="Próx. manutenção (km)"><Input type="number" value={form.proximaManutencaoKm||0} onChange={e=>setForm(f=>({...f,proximaManutencaoKm:e.target.valueAsNumber}))} /></F>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>{editing ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v)=>{ if(!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover veículo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.vehicles.map(v => {
          const usados = data.services.filter(s => s.veiculoId === v.id);
          const km = usados.reduce((a,s)=>a+s.km, 0);
          const restante = v.proximaManutencaoKm - v.km;
          const alerta = restante < 1000;
          return (
            <div key={v.id} className="rounded-2xl border border-border bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-elegant)]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{v.placa}</div>
                  <div className="mt-1 font-display text-lg font-semibold">{v.modelo}</div>
                  {(v.marca || v.cor) && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[v.marca, v.cor].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Wrench className={`h-5 w-5 ${alerta?"text-warning":"text-muted-foreground"}`} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=>openEdit(v)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={()=>setDeleteId(v.id)} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">KM atual</dt><dd className="font-medium">{v.km.toLocaleString("pt-BR")}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Consumo</dt><dd className="font-medium">{v.consumoMedio} km/L</dd></div>
                <div><dt className="text-xs text-muted-foreground">Próx. manutenção</dt><dd className={`font-medium ${alerta?"text-warning":""}`}>{v.proximaManutencaoKm.toLocaleString("pt-BR")} km</dd></div>
                <div><dt className="text-xs text-muted-foreground">Serviços</dt><dd className="font-medium">{usados.length}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">KM rodado em serviços</dt><dd className="font-medium">{km.toLocaleString("pt-BR")} km</dd></div>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow className="border-border hover:bg-transparent">
            <TableHead>Veículo</TableHead><TableHead>Placa</TableHead><TableHead>KM</TableHead><TableHead>Consumo</TableHead><TableHead>Próx. manutenção</TableHead><TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.vehicles.map(v => (
              <TableRow key={v.id} className="border-border">
                <TableCell className="font-medium">{v.modelo}</TableCell>
                <TableCell>{v.placa}</TableCell>
                <TableCell>{v.km.toLocaleString("pt-BR")}</TableCell>
                <TableCell>{v.consumoMedio} km/L</TableCell>
                <TableCell>{v.proximaManutencaoKm.toLocaleString("pt-BR")} km</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={()=>openEdit(v)} aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={()=>setDeleteId(v.id)} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
