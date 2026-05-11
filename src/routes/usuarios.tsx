import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserPlus, ShieldCheck, Loader2, Pencil } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — Reboque Piauí" }] }),
  component: UsuariosPage,
});

interface Row { user_id: string; nome: string; telefone: string | null; pode_abrir_chamado: boolean; receber_notificacoes: boolean; roles: AppRole[] }

function UsuariosPage() {
  const { isAdmin, loading, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ nome: string; email: string; password: string; role: AppRole; telefone: string; podeAbrirChamado: boolean; receberNotificacoes: boolean }>({
    nome: "", email: "", password: "", role: "operador", telefone: "", podeAbrirChamado: false, receberNotificacoes: false,
  });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<{ nome: string; role: AppRole; telefone: string; podeAbrirChamado: boolean; receberNotificacoes: boolean }>({ nome: "", role: "operador", telefone: "", podeAbrirChamado: false, receberNotificacoes: false });
  const [editBusy, setEditBusy] = useState(false);

  async function refresh() {
    const { data: profs } = await supabase.from("profiles").select("user_id, nome, telefone, pode_abrir_chamado, receber_notificacoes");
    const { data: rs } = await supabase.from("user_roles").select("user_id, role");
    const byUser = new Map<string, AppRole[]>();
    (rs ?? []).forEach((r: any) => {
      const arr = byUser.get(r.user_id) ?? []; arr.push(r.role); byUser.set(r.user_id, arr);
    });
    setRows((profs ?? []).map((p: any) => ({
      user_id: p.user_id, nome: p.nome, telefone: p.telefone ?? null,
      pode_abrir_chamado: !!p.pode_abrir_chamado,
      receber_notificacoes: !!p.receber_notificacoes,
      roles: byUser.get(p.user_id) ?? [],
    })));
  }
  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  async function invite(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const { data: signed, error } = await supabase.auth.signUp({
        email: form.email.trim(), password: form.password,
        options: { data: { nome: form.nome, role: form.role }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      const newUid = signed.user?.id;
      if (newUid) {
        await supabase.from("profiles").update({
          telefone: form.telefone || null, pode_abrir_chamado: form.podeAbrirChamado,
          receber_notificacoes: form.receberNotificacoes,
        }).eq("user_id", newUid);
      }
      toast.success(`Usuário ${form.nome} criado.`);
      await supabase.auth.refreshSession();
      setForm({ nome: "", email: "", password: "", role: "operador", telefone: "", podeAbrirChamado: false, receberNotificacoes: false }); setOpen(false);
      setTimeout(refresh, 500);
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao criar usuário");
    } finally { setBusy(false); }
  }

  function openEdit(r: Row) {
    setEditing(r);
    setEditForm({ nome: r.nome, role: (r.roles[0] as AppRole) ?? "operador", telefone: r.telefone ?? "", podeAbrirChamado: r.pode_abrir_chamado, receberNotificacoes: r.receber_notificacoes });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditBusy(true);
    try {
      const profilePatch: any = {};
      if (editForm.nome !== editing.nome) profilePatch.nome = editForm.nome;
      if ((editForm.telefone || null) !== (editing.telefone || null)) profilePatch.telefone = editForm.telefone || null;
      if (editForm.podeAbrirChamado !== editing.pode_abrir_chamado) profilePatch.pode_abrir_chamado = editForm.podeAbrirChamado;
      if (editForm.receberNotificacoes !== editing.receber_notificacoes) profilePatch.receber_notificacoes = editForm.receberNotificacoes;
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await supabase.from("profiles").update(profilePatch).eq("user_id", editing.user_id);
        if (error) throw error;
      }
      // Atualiza role: se mudou, remove as anteriores e insere a nova
      const currentRole = editing.roles[0];
      if (editForm.role !== currentRole) {
        if (editing.user_id === user?.id && currentRole === "admin" && editForm.role !== "admin") {
          const adminCount = rows.filter(r => r.roles.includes("admin")).length;
          if (adminCount <= 1) throw new Error("Você é o único administrador. Promova outro usuário antes de alterar seu próprio perfil.");
        }
        const del = await supabase.from("user_roles").delete().eq("user_id", editing.user_id);
        if (del.error) throw del.error;
        const ins = await supabase.from("user_roles").insert({ user_id: editing.user_id, role: editForm.role });
        if (ins.error) throw ins.error;
      }
      toast.success("Usuário atualizado");
      setEditing(null);
      refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao atualizar usuário");
    } finally { setEditBusy(false); }
  }

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  if (!isAdmin) return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-3 font-display text-lg font-semibold">Acesso restrito</h2>
      <p className="text-sm text-muted-foreground">Apenas administradores podem gerenciar usuários.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Usuários" description="Gerencie acessos e permissões da equipe."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" />Novo usuário</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Convidar novo usuário</DialogTitle></DialogHeader>
              <form onSubmit={invite} className="space-y-4">
                <div className="space-y-2"><Label>Nome</Label><Input required value={form.nome} onChange={(e)=>setForm({...form, nome:e.target.value})} /></div>
                <div className="space-y-2"><Label>E-mail</Label><Input type="email" required value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} /></div>
                <div className="space-y-2"><Label>Senha temporária</Label><Input type="password" required minLength={6} value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})} /></div>
                <div className="space-y-2"><Label>Telefone (WhatsApp)</Label><Input value={form.telefone} onChange={(e)=>setForm({...form, telefone:e.target.value})} placeholder="(86) 9 9999-9999" /></div>
                <div className="space-y-2">
                  <Label>Perfil de acesso</Label>
                  <Select value={form.role} onValueChange={(v)=>setForm({...form, role:v as AppRole})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador (acesso total)</SelectItem>
                      <SelectItem value="financeiro">Financeiro (entradas, saídas, relatórios)</SelectItem>
                      <SelectItem value="operador">Operador (serviços e clientes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label className="text-sm">Autorizar abrir chamados via WhatsApp</Label>
                    <p className="text-xs text-muted-foreground">Permite que o telefone deste usuário abra chamados pelo bot.</p>
                  </div>
                  <Switch checked={form.podeAbrirChamado} onCheckedChange={(v)=>setForm({...form, podeAbrirChamado:v})} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label className="text-sm">Receber notificações no WhatsApp</Label>
                    <p className="text-xs text-muted-foreground">Avisos de chamado finalizado e resumo diário.</p>
                  </div>
                  <Switch checked={form.receberNotificacoes} onCheckedChange={(v)=>setForm({...form, receberNotificacoes:v})} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar usuário</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input required value={editForm.nome} onChange={(e)=>setEditForm({...editForm, nome:e.target.value})} /></div>
            <div className="space-y-2"><Label>Telefone (WhatsApp)</Label><Input value={editForm.telefone} onChange={(e)=>setEditForm({...editForm, telefone:e.target.value})} placeholder="(86) 9 9999-9999" /></div>
            <div className="space-y-2">
              <Label>Perfil de acesso</Label>
              <Select value={editForm.role} onValueChange={(v)=>setEditForm({...editForm, role:v as AppRole})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador (acesso total)</SelectItem>
                  <SelectItem value="financeiro">Financeiro (entradas, saídas, relatórios)</SelectItem>
                  <SelectItem value="operador">Operador (serviços e clientes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Autorizar abrir chamados via WhatsApp</Label>
                <p className="text-xs text-muted-foreground">Permite que o telefone deste usuário abra chamados pelo bot.</p>
              </div>
              <Switch checked={editForm.podeAbrirChamado} onCheckedChange={(v)=>setEditForm({...editForm, podeAbrirChamado:v})} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Receber notificações no WhatsApp</Label>
                <p className="text-xs text-muted-foreground">Avisos de chamado finalizado e resumo diário do dia.</p>
              </div>
              <Switch checked={editForm.receberNotificacoes} onCheckedChange={(v)=>setEditForm({...editForm, receberNotificacoes:v})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={editBusy}>{editBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="hidden md:table-cell">Telefone</TableHead><TableHead>Perfis</TableHead><TableHead>Chamados WhatsApp</TableHead><TableHead className="w-20 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.user_id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{r.telefone ?? "—"}</TableCell>
                <TableCell className="space-x-1">
                  {r.roles.map(role => <Badge key={role} variant="outline" className="capitalize">{role}</Badge>)}
                </TableCell>
                <TableCell>
                  {r.pode_abrir_chamado
                    ? <Badge className="bg-success/10 text-success border-success/30">Autorizado</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário cadastrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
