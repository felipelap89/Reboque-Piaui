import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, useDB } from "@/lib/data";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Reboque Piauí" }] }),
  component: Page,
});

type Period = "diario" | "semanal" | "mensal" | "anual";

function Page() {
  const { services, expenses, drivers, clients } = useDB();
  const [period, setPeriod] = useState<Period>("mensal");

  const since = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0);
    if (period === "diario") return d;
    if (period === "semanal") { d.setDate(d.getDate()-7); return d; }
    if (period === "mensal") { d.setDate(1); return d; }
    return new Date(d.getFullYear(),0,1);
  }, [period]);

  const srv = services.filter(s => new Date(s.data) >= since);
  const exp = expenses.filter(e => new Date(e.data) >= since && e.pago);
  const receita = srv.filter(s => s.status === "Finalizado").reduce((a,s)=>a+s.valor,0);
  const despesa = exp.reduce((a,e)=>a+e.valor,0);

  const exportCSV = () => {
    const rows = [
      ["Tipo","Data","Descrição","Valor"],
      ...srv.map(s => ["Receita", new Date(s.data).toLocaleDateString("pt-BR"), `${s.cliente} - ${s.tipo}`, s.valor]),
      ...exp.map(e => ["Despesa", new Date(e.data).toLocaleDateString("pt-BR"), `${e.tipo} - ${e.responsavel}`, -e.valor]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Análises por período com exportação."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCSV}><FileSpreadsheet className="h-4 w-4" />Excel/CSV</Button>
            <Button variant="outline" className="gap-2" onClick={()=>{ window.print(); toast.success("Diálogo de impressão aberto"); }}><FileText className="h-4 w-4" />PDF</Button>
          </div>
        }
      />

      <Tabs value={period} onValueChange={v => setPeriod(v as Period)}>
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="diario">Diário</TabsTrigger>
          <TabsTrigger value="semanal">Semanal</TabsTrigger>
          <TabsTrigger value="mensal">Mensal</TabsTrigger>
          <TabsTrigger value="anual">Anual</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Receita" value={brl(receita)} tone="success" />
        <Card title="Despesas" value={brl(despesa)} tone="danger" />
        <Card title="Lucro" value={brl(receita - despesa)} tone={receita-despesa>=0?"success":"danger"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Top motoristas">
          <ul className="divide-y divide-border">
            {drivers.map(d => {
              const v = srv.filter(s => s.motoristaId === d.id && s.status === "Finalizado").reduce((a,s)=>a+s.valor,0);
              return <li key={d.id} className="flex items-center justify-between py-2.5 text-sm"><span>{d.nome}</span><span className="font-medium text-success">{brl(v)}</span></li>;
            })}
          </ul>
        </Section>
        <Section title="Top clientes">
          <ul className="divide-y divide-border">
            {clients.map(c => {
              const v = srv.filter(s => s.cliente === c.nome && s.status === "Finalizado").reduce((a,s)=>a+s.valor,0);
              return <li key={c.id} className="flex items-center justify-between py-2.5 text-sm"><span>{c.nome}</span><span className="font-medium">{brl(v)}</span></li>;
            })}
          </ul>
        </Section>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1"><Download className="h-3 w-3" /> Exportações em PDF/Excel/CSV. Use Cloud para histórico permanente.</p>
    </div>
  );
}

function Card({ title, value, tone }: { title: string; value: string; tone: "success" | "danger" }) {
  const cls = tone === "success" ? "text-success" : "text-destructive";
  return (
    <div className="rounded-2xl border border-border bg-[image:var(--gradient-card)] p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className={`mt-2 font-display text-2xl font-semibold ${cls}`}>{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
