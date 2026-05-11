import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, brl, useDB, type Client } from "@/lib/data";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Reboque Piauí" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const data = useDB();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [form, setForm] = useState<Partial<Client>>({});

  const totalCliente = (nome: string) => data.services
    .filter(s => s.cliente === nome && s.status === "Finalizado")
    .reduce((a,s)=>a+s.valor, 0);

  const openNew = () => { setEditing(null); setForm({}); setOpen(true); };
  const openEdit = (c: Client) => { setEditing(c); setForm(c); setOpen(true); };

  const submit = async () => {
    if (!form.nome || !form.telefone) return toast.error("Nome e telefone são obrigatórios.");
    try {
      if (editing) {
        await api.updateClient(editing.id, {
          nome: form.nome!, telefone: form.telefone!,
          documento: form.documento || "", endereco: form.endereco || "", obs: form.obs ?? null,
        });
        toast.success("Cliente atualizado");
      } else {
        await api.addClient({ nome: form.nome!, telefone: form.telefone!, documento: form.documento || "", endereco: form.endereco || "", obs: form.obs ?? null });
        toast.success("Cliente cadastrado");
      }
      setForm({}); setEditing(null); setOpen(false);
    } catch (e: any) { toast.error(e.message ?? "Erro ao salvar"); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await api.deleteClient(toDelete.id); toast.success("Cliente removido"); }
    catch (e: any) { toast.error(e.message ?? "Erro ao remover"); }
    finally { setToDelete(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" description="Cadastro completo e histórico de gastos por cliente."
        actions={<Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" />Novo cliente</Button>}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({}); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Nome *"><Input value={form.nome||""} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} /></F>
            <F label="Telefone *"><Input value={form.telefone||""} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))} /></F>
            <F label="CPF/CNPJ"><Input value={form.documento||""} onChange={e=>setForm(f=>({...f,documento:e.target.value}))} /></F>
            <F label="Endereço"><Input value={form.endereco||""} onChange={e=>setForm(f=>({...f,endereco:e.target.value}))} /></F>
            <div className="sm:col-span-2"><F label="Observações"><Textarea value={form.obs||""} onChange={e=>setForm(f=>({...f,obs:e.target.value}))} rows={2} /></F></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={()=>setOpen(false)}>Cancelar</Button><Button onClick={submit}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow className="border-border hover:bg-transparent">
            <TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead className="hidden md:table-cell">Documento</TableHead><TableHead className="hidden md:table-cell">Endereço</TableHead><TableHead>Serviços</TableHead><TableHead className="text-right">Total gasto</TableHead><TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.clients.map(c => {
              const qtd = data.services.filter(s => s.cliente === c.nome).length;
              return (
                <TableRow key={c.id} className="border-border">
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.telefone}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{c.documento}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{c.endereco}</TableCell>
                  <TableCell>{qtd}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{brl(totalCliente(c.nome))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setToDelete(c)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>}
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
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
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
