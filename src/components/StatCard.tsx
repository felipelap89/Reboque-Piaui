import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  delta?: number; // percentage
  tone?: "default" | "success" | "danger" | "warning";
}

const toneMap = {
  default: "from-primary/30 to-primary/0 text-primary",
  success: "from-success/30 to-success/0 text-success",
  danger: "from-destructive/30 to-destructive/0 text-destructive",
  warning: "from-warning/30 to-warning/0 text-warning",
};

export function StatCard({ label, value, icon: Icon, hint, delta, tone = "default" }: Props) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[image:var(--gradient-card)] p-5 shadow-[var(--shadow-elegant)]">
      <div className={cn("absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl opacity-60", toneMap[tone])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-card/60 ring-1 ring-border", toneMap[tone].split(" ").pop())}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {typeof delta === "number" && (
        <div className="mt-4 flex items-center gap-1 text-xs">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
            positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
          <span className="text-muted-foreground">vs mês anterior</span>
        </div>
      )}
    </div>
  );
}
