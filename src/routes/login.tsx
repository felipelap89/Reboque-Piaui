import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import logoUrl from "@/assets/logo-mecanica-piaui.png";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Reboque Piauí" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nome: nome.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Cadastro realizado! Você já pode entrar.");
        // Try auto sign-in (works when email confirmation is disabled)
        try { await signIn(email.trim(), password); navigate({ to: "/" }); }
        catch { setMode("login"); }
      } else {
        await signIn(email.trim(), password);
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Falha");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="relative h-28 w-28 rounded-2xl flex items-center justify-center overflow-hidden bg-card ring-1 ring-primary/40 shadow-[var(--shadow-glow)]">
            <img src={logoUrl} alt="Reboque Piauí" className="h-full w-full object-contain p-1" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold leading-tight uppercase tracking-tight">Mecânica <span className="text-primary">Piauí</span></h1>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Reboque · Painel administrativo</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <h2 className="font-display text-xl font-semibold">
            {mode === "login" ? "Acessar sistema" : "Criar conta"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Use suas credenciais administrativas."
              : "O primeiro cadastro será o administrador."}
          </p>
          <form onSubmit={handle} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={(e)=>setNome(e.target.value)} placeholder="Seu nome" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="voce@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pwd">Senha</Label>
              <Input id="pwd" type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Cadastro apenas por convite. Solicite acesso ao administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
