import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { toast } from "sonner";
import { MessageSquare, Workflow, Map, Bot, Database, Trash2 } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Reboque Piauí" }] }),
  component: Page,
});

function Page() {
  const reset = () => toast.info("Restauração via Lovable Cloud — peça ao administrador.");

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Empresa, automações e integrações." />

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold mb-4">Dados da empresa</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Nome fantasia"><Input defaultValue="Reboque Piauí" /></F>
          <F label="CNPJ"><Input defaultValue="00.000.000/0001-00" /></F>
          <F label="Telefone"><Input defaultValue="(86) 99999-0000" /></F>
          <F label="E-mail"><Input defaultValue="contato@reboquepi.com" /></F>
          <div className="sm:col-span-2"><F label="Endereço"><Input defaultValue="Av. Frei Serafim, Teresina - PI" /></F></div>
        </div>
        <div className="mt-4 flex justify-end"><Button>Salvar alterações</Button></div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold mb-4">Automações & Integrações</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Integ icon={MessageSquare} title="WhatsApp / Evolution API" desc="Envio automático de recibos e ordens." />
          <Integ icon={Bot} title="Typebot" desc="Atendimento e captação automatizada." />
          <Integ icon={Workflow} title="n8n" desc="Workflows e automações." />
          <Integ icon={Map} title="Google Maps" desc="Cálculo de rotas e distância." />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold mb-4">Backup & Dados</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm">Backup automático na nuvem</p>
            <p className="text-xs text-muted-foreground">Disponível ao habilitar Lovable Cloud (banco de dados, autenticação e armazenamento).</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={reset}><Trash2 className="h-4 w-4" />Restaurar dados de demonstração</Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold mb-4">Usuários & Acessos</h3>
        <p className="text-sm text-muted-foreground">Defina níveis: <strong className="text-foreground">Admin</strong>, <strong className="text-foreground">Operador</strong>, <strong className="text-foreground">Financeiro</strong>. Login administrativo com Lovable Cloud.</p>
        <div className="mt-3 flex items-center gap-3">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-sm">Habilite Cloud para ativar autenticação real, controle de usuários e backup permanente.</span>
        </div>
      </section>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function Integ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <Switch />
    </div>
  );
}
