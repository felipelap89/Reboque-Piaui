// Shared date-range filter helpers used by Dashboard, Financeiro, Serviços, Despesas.

export type RangePreset = "today" | "week" | "month" | "year" | "custom" | "all";

export interface DateRange {
  preset: RangePreset;
  from: Date | null;
  to: Date | null;
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export function rangeFromPreset(preset: RangePreset, custom?: { from: Date | null; to: Date | null }): DateRange {
  const now = new Date();
  switch (preset) {
    case "today": {
      return { preset, from: startOfDay(now), to: endOfDay(now) };
    }
    case "week": {
      const day = now.getDay(); // 0 = Sunday
      const diffToMonday = (day + 6) % 7;
      const from = startOfDay(new Date(now)); from.setDate(from.getDate() - diffToMonday);
      const to = endOfDay(new Date(from)); to.setDate(to.getDate() + 6);
      return { preset, from, to };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { preset, from, to };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = endOfDay(new Date(now.getFullYear(), 11, 31));
      return { preset, from, to };
    }
    case "custom": {
      return {
        preset,
        from: custom?.from ? startOfDay(custom.from) : null,
        to: custom?.to ? endOfDay(custom.to) : null,
      };
    }
    case "all":
    default:
      return { preset: "all", from: null, to: null };
  }
}

export function inRange(date: string | Date, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const d = typeof date === "string" ? new Date(date) : date;
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

export function rangeLabel(r: DateRange): string {
  if (r.preset === "all") return "Todo o período";
  if (r.preset === "today") return "Hoje";
  if (r.preset === "week") return "Esta semana";
  if (r.preset === "month") return "Este mês";
  if (r.preset === "year") return "Este ano";
  if (r.from && r.to) {
    const f = r.from.toLocaleDateString("pt-BR");
    const t = r.to.toLocaleDateString("pt-BR");
    return f === t ? f : `${f} — ${t}`;
  }
  return "Personalizado";
}
