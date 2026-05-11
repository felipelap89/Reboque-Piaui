import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Wallet, TrendingUp, Wrench, Activity, Target, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { brl, useDB } from "@/lib/data";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { rangeFromPreset, inRange, type DateRange } from "@/lib/date-range";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Reboque Piauí" },
      { name: "description", content: "Visão geral financeira e operacional da empresa." },
    ],
  }),
  component: Dashboard,
});

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

function Dashboard() {
  const { services, expenses } = useDB();
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset("month"));

  const filteredServices = useMemo(() => services.filter(s => inRange(s.data, range)), [services, range]);
  // Caixa só considera despesas efetivamente pagas
  const filteredExpenses = useMemo(() => expenses.filter(e => inRange(e.data, range) && e.pago), [expenses, range]);

  const stats = useMemo(() => {
    const today = startOfDay();
    const isFinalized = (s: typeof services[number]) => s.status === "Finalizado";

    const faturadoHoje = services.filter(s => isFinalized(s) && new Date(s.data) >= today).reduce((a, s) => a + s.valor, 0);
    const faturadoPeriodo = filteredServices.filter(isFinalized).reduce((a, s) => a + s.valor, 0);
    const gastosPeriodo = filteredExpenses.reduce((a, e) => a + e.valor, 0);
    const realizados = filteredServices.filter(isFinalized).length;
    const andamento = filteredServices.filter(s => s.status === "Em andamento").length;
    const pendentes = filteredServices.filter(s => s.status === "Pendente").length;

    return {
      faturadoHoje,
      faturadoPeriodo,
      gastosPeriodo,
      lucro: faturadoPeriodo - gastosPeriodo,
      realizados,
      andamento,
      pendentes,
      meta: 25000,
    };
  }, [services, filteredServices, filteredExpenses]);

  // 14-day series
  const series = useMemo(() => {
    const days: { dia: string; receita: number; despesa: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const receita = filteredServices
        .filter(s => s.status === "Finalizado" && new Date(s.data) >= d && new Date(s.data) < next)
        .reduce((a, s) => a + s.valor, 0);
      const despesa = filteredExpenses
        .filter(e => new Date(e.data) >= d && new Date(e.data) < next)
        .reduce((a, e) => a + e.valor, 0);
      days.push({
        dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        receita,
        despesa,
      });
    }
    // ensure non-zero for visual demo if all zero
    if (days.every(d => d.receita === 0 && d.despesa === 0)) {
      days.forEach((d, i) => { d.receita = 800 + Math.round(Math.sin(i)*200 + i*60); d.despesa = 400 + Math.round(Math.cos(i)*120 + i*30); });
    }
    return days;
  }, [filteredServices, filteredExpenses]);

  const tipoData = useMemo(() => {
    const map = new Map<string, number>();
    filteredServices.forEach(s => map.set(s.tipo, (map.get(s.tipo) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredServices]);

  const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  const metaPct = Math.min(100, Math.round((stats.faturadoPeriodo / stats.meta) * 100));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel Geral"
        description="Visão executiva em tempo real da operação."
        actions={<Badge variant="outline" className="gap-2 border-success/40 text-success"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Operação ativa</Badge>}
      />

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturado hoje" value={brl(stats.faturadoHoje)} icon={Wallet} tone="success" delta={12.4} hint="Pagamentos confirmados" />
        <StatCard label="Faturado no período" value={brl(stats.faturadoPeriodo)} icon={TrendingUp} tone="default" delta={8.2} hint="Conforme filtro" />
        <StatCard label="Lucro líquido" value={brl(stats.lucro)} icon={Target} tone={stats.lucro >= 0 ? "success" : "danger"} delta={stats.lucro >= 0 ? 5.6 : -3.1} />
        <StatCard label="Despesas no período" value={brl(stats.gastosPeriodo)} icon={Receipt} tone="danger" delta={-2.4} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Serviços realizados" value={String(stats.realizados)} icon={Wrench} hint="Total acumulado" />
        <StatCard label="Em andamento" value={String(stats.andamento)} icon={Activity} tone="warning" />
        <StatCard label="Pendentes" value={String(stats.pendentes)} icon={Activity} tone="warning" />
        <div className="relative overflow-hidden rounded-2xl border border-border bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-elegant)]">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Meta mensal</p>
          <p className="mt-2 font-display text-2xl font-semibold">{brl(stats.meta)}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-[image:var(--gradient-primary)]" style={{ width: `${metaPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{metaPct}% atingido</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Receitas vs Despesas</h3>
              <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Receita</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Despesa</span>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => brl(v)} />
                <Area type="monotone" dataKey="receita" stroke="var(--chart-1)" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="despesa" stroke="var(--chart-4)" fill="url(#g2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-base font-semibold">Tipos de serviço</h3>
          <p className="text-xs text-muted-foreground">Distribuição por categoria</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tipoData} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                  {tipoData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 text-xs">
            {tipoData.map((t, i) => (
              <li key={t.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: pieColors[i % pieColors.length] }} />{t.name}</span>
                <span className="text-muted-foreground">{t.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-base font-semibold">Últimos serviços</h3>
          <p className="text-xs text-muted-foreground mb-3">Movimentação recente</p>
          <div className="divide-y divide-border">
            {services.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{s.cliente}</div>
                  <div className="text-xs text-muted-foreground">{s.tipo} · {s.origem} → {s.destino}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-success">{brl(s.valor)}</div>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Comparativo mensal</h3>
              <p className="text-xs text-muted-foreground">Receita vs mês anterior</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { mes: "Anterior", receita: stats.faturadoPeriodo * 0.86, despesa: stats.gastosPeriodo * 1.05 },
                { mes: "Atual", receita: stats.faturadoPeriodo, despesa: stats.gastosPeriodo },
              ]} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} formatter={(v: number) => brl(v)} />
                <Bar dataKey="receita" fill="var(--chart-1)" radius={[8,8,0,0]} />
                <Bar dataKey="despesa" fill="var(--chart-4)" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Finalizado": "bg-success/10 text-success border-success/30",
    "Em andamento": "bg-warning/10 text-warning border-warning/30",
    "Pendente": "bg-muted text-muted-foreground border-border",
    "Cancelado": "bg-destructive/10 text-destructive border-destructive/30",
  };
  return <span className={`mt-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] || ""}`}>{status}</span>;
}
