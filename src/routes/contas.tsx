import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, useDB, type Account } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contas")({
  head: () => ({ meta: [{ title: "Contas — Reboque Piauí" }] }),
  component: ContasPage,
});

function ContasPage() {
  const data = useDB();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);

  const onNew = () => { setEditing(null); setOpen(true); };
  const onEdit = (a: Account) => { setEditing(a); setOpen(true); };
  const confirmDelete = async () => {
    if (!toDelete) return;
    try { await api.deleteAccount(toDelete.id); toast.success("Conta removida"); }
    catch (e: any) { toast.error(e.message ?? "Erro"); }
    finally { setToDelete(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas de Pagamento"
        description="Cadastre as contas Pix usadas para receber pagamentos. O QR code é enviado ao motorista via WhatsApp."
        actions={isAdmin && <Button className="gap-2" onClick={onNew}><Plus className="h-4 w-4" />Nova conta</Button>}
      />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <AccountDialog key={editing?.id ?? "new"} initial={editing} onClose={() => { setOpen(false); setEditing(null); }} />
      </Dialog>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-20">QR</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">Banco / Conta</TableHead>
              <TableHead className="hidden lg:table-cell">Responsável</TableHead>
              <TableHead className="hidden sm:table-cell">Chave Pix</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="w-24 text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.accounts.map(a => {
              const url = api.qrPublicUrl(a.qrPath);
              return (
                <TableRow key={a.id} className="border-border">
                  <TableCell>
                    {url ? <img src={url} alt={`QR ${a.nome}`} className="h-12 w-12 rounded border border-border object-cover" />
                         : <div className="h-12 w-12 rounded border border-dashed border-border grid place-items-center text-[10px] text-muted-foreground">sem QR</div>}
                  </TableCell>
                  <TableCell className="font-medium">{a.nome}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {a.banco || a.numeroConta ? <>{a.banco ?? ""}{a.banco && a.numeroConta ? " • " : ""}{a.numeroConta ?? ""}</> : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{a.telefoneResponsavel ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{a.pixKey ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${a.ativa ? "bg-success/10 text-success border border-success/30" : "bg-muted text-muted-foreground"}`}>
                      {a.ativa ? "Ativa" : "Inativa"}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(a)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setToDelete(a)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {data.accounts.length === 0 && (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-muted-foreground">Nenhuma conta cadastrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>A conta "{toDelete?.nome}" será removida. Serviços que a referenciavam ficarão sem conta vinculada.</AlertDialogDescription>
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

function AccountDialog({ initial, onClose }: { initial: Account | null; onClose: () => void }) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [banco, setBanco] = useState(initial?.banco ?? "");
  const [numeroConta, setNumeroConta] = useState(initial?.numeroConta ?? "");
  const [telefoneResp, setTelefoneResp] = useState(initial?.telefoneResponsavel ?? "");
  const [pixKey, setPixKey] = useState(initial?.pixKey ?? "");
  const [ativa, setAtiva] = useState(initial?.ativa ?? true);
  const [qrPath, setQrPath] = useState<string | null>(initial?.qrPath ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewUrl = qrPath ? api.qrPublicUrl(qrPath) : null;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `qr-${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
      const { error } = await supabase.storage.from("contas-qr").upload(path, file, { upsert: true });
      if (error) throw error;
      setQrPath(path);
      toast.success("QR enviado");
    } catch (e: any) { toast.error(e.message ?? "Erro no upload"); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = { nome, pixKey, ativa, qrPath, banco, numeroConta, telefoneResponsavel: telefoneResp };
    try {
      if (initial) {
        await api.updateAccount(initial.id, payload);
        toast.success("Conta atualizada");
      } else {
        await api.addAccount(payload);
        toast.success("Conta criada");
      }
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  };

  return (
    <DialogContent className="bg-card border-border">
      <DialogHeader><DialogTitle>{initial ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nome (como o responsável vai indicar)</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Pix Empresa" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Banco</Label>
            <Input value={banco ?? ""} onChange={e => setBanco(e.target.value)} placeholder="Ex: Banco do Brasil" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Número da conta</Label>
            <Input value={numeroConta ?? ""} onChange={e => setNumeroConta(e.target.value)} placeholder="Agência / conta" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Telefone do responsável</Label>
          <Input value={telefoneResp ?? ""} onChange={e => setTelefoneResp(e.target.value)} placeholder="(86) 9 9999-9999" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Chave Pix (opcional)</Label>
          <Input value={pixKey ?? ""} onChange={e => setPixKey(e.target.value)} placeholder="CNPJ, telefone, e-mail ou aleatória" />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">QR Code (imagem)</Label>
          <div className="flex items-center gap-3">
            {previewUrl ? <img src={previewUrl} alt="QR" className="h-24 w-24 rounded border border-border object-cover" />
                        : <div className="h-24 w-24 rounded border border-dashed border-border grid place-items-center text-xs text-muted-foreground">sem imagem</div>}
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                <Upload className="h-4 w-4" />{uploading ? "Enviando..." : (qrPath ? "Trocar QR" : "Enviar QR")}
              </Button>
              {qrPath && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setQrPath(null)}>Remover</Button>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={ativa} onCheckedChange={setAtiva} id="ativa" />
          <Label htmlFor="ativa" className="text-sm">Conta ativa</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit}>{initial ? "Salvar alterações" : "Criar conta"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
