import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, brl, useDB, type Driver } from "@/lib/data";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/motoristas")({
  head: () => ({ meta: [{ title: "Motoristas — Reboque Piauí" }] }),
  component: Page,
});

const empty: Partial<Driver> = { ativo: true, comissaoPct: 0, comissaoValor: 50, categoria: "D" };

function Page() {
  const data = useDB();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [toDelete, setToDelete] = useState<Driver | null>(null);
  const [form, setForm] = useState<Partial<Driver>>(empty);

  const finalizados = (id: string) => data.services.filter(s => s.motoristaId === id && s.status === "Finalizado");
  const totalFat = (id: string) => finalizados(id).reduce((a,s)=>a+s.valor,0);
  const totalComissao = (id: string) => finalizados(id).reduce((a,s)=>a+(Number(s.comissaoValor)||0),0);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (d: Driver) => { setEditing(d); setForm(d); setOpen(true); };

  const submit = async () => {
    if (!form.nome || !form.cnh) return toast.error("Nome e CNH obrigatórios.");
    const payload = {
      nome: form.nome!, telefone: form.telefone || "", cnh: form.cnh!,
      categoria: form.categoria || "D", ativo: !!form.ativo,
      comissaoPct: Number(form.comissaoPct) || 0,
      comissaoValor: Number(form.comissaoValor) || 0,
    };
    try {
      if (editing) { await api.updateDriver(editing.id, payload); toast.success("Motorista atualizado"); }
      else { await api.addDriver(payload); toast.success("Motorista cadastrado"); }
      setForm(empty); setEditing(null); setOpen(false);
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await api.deleteDriver(toDelete.id); toast.success("Motorista removido"); }
    catch (e: any) { toast.error(e.message ?? "Erro ao remover"); }
    finally { setToDelete(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Motoristas" description="Equipe operacional, comissões e histórico."
        actions={<Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Novo motorista</Button>}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editing ? "Editar motorista" : "Novo motorista"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Nome *"><Input value={form.nome||""} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} /></F>
            <F label="Telefone"><Input value={form.telefone||""} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))} /></F>
            <F label="CNH *"><Input value={form.cnh||""} onChange={e=>setForm(f=>({...f,cnh:e.target.value}))} /></F>
            <F label="Categoria"><Input value={form.categoria||""} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} /></F>
            <F label="Comissão padrão (R$ por chamado)"><Input type="number" step="0.01" value={form.comissaoValor||0} onChange={e=>setForm(f=>({...f,comissaoValor:e.target.valueAsNumber}))} /></F>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label className="text-sm">Ativo</Label>
              <Switch checked={!!form.ativo} onCheckedChange={v=>setForm(f=>({...f,ativo:v}))} />
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow className="border-border hover:bg-transparent">
            <TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>CNH</TableHead><TableHead>Cat.</TableHead><TableHead className="text-right">Comissão padrão</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Faturado</TableHead><TableHead className="text-right">Comissão acumulada</TableHead><TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.drivers.map(d => {
              const fat = totalFat(d.id);
              const com = totalComissao(d.id);
              return (
                <TableRow key={d.id} className="border-border">
                  <TableCell className="font-medium">{d.nome}</TableCell>
                  <TableCell>{d.telefone}</TableCell>
                  <TableCell className="text-muted-foreground">{d.cnh}</TableCell>
                  <TableCell>{d.categoria}</TableCell>
                  <TableCell className="text-right">{brl(d.comissaoValor)}</TableCell>
                  <TableCell><span className={`rounded-full px-2 py-0.5 text-[10px] border ${d.ativo?"bg-success/10 text-success border-success/30":"bg-muted text-muted-foreground border-border"}`}>{d.ativo?"Ativo":"Inativo"}</span></TableCell>
                  <TableCell className="text-right font-semibold">{brl(fat)}</TableCell>
                  <TableCell className="text-right text-success">{brl(com)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setToDelete(d)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motorista?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. {toDelete?.nome} será removido.</AlertDialogDescription>
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

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
