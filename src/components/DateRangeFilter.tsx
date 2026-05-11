import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarIcon, X } from "lucide-react";
import { rangeFromPreset, rangeLabel, type DateRange, type RangePreset } from "@/lib/date-range";

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "week", label: "Semana" },
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" },
];

export function DateRangeFilter({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Date | undefined>(value.from ?? undefined);
  const [to, setTo] = useState<Date | undefined>(value.to ?? undefined);

  const setPreset = (p: RangePreset) => {
    const r = rangeFromPreset(p);
    setFrom(r.from ?? undefined); setTo(r.to ?? undefined);
    onChange(r);
  };

  const applyCustom = () => {
    onChange(rangeFromPreset("custom", { from: from ?? null, to: to ?? null }));
    setOpen(false);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {PRESETS.map(p => (
        <Button
          key={p.id}
          size="sm"
          variant={value.preset === p.id ? "default" : "outline"}
          onClick={() => setPreset(p.id)}
          className="h-9"
        >
          {p.label}
        </Button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={value.preset === "custom" ? "default" : "outline"}
            className="h-9 gap-2"
          >
            <CalendarIcon className="h-4 w-4" />
            {value.preset === "custom" ? rangeLabel(value) : "Personalizado"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3 bg-popover border-border" align="end">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div>
              <p className="px-1 pb-1 text-[11px] uppercase tracking-widest text-muted-foreground">De</p>
              <Calendar mode="single" selected={from} onSelect={setFrom} className={cn("p-3 pointer-events-auto")} />
            </div>
            <div>
              <p className="px-1 pb-1 text-[11px] uppercase tracking-widest text-muted-foreground">Até</p>
              <Calendar mode="single" selected={to} onSelect={setTo} className={cn("p-3 pointer-events-auto")} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setFrom(undefined); setTo(undefined); }}>Limpar</Button>
            <Button size="sm" onClick={applyCustom} disabled={!from && !to}>Aplicar</Button>
          </div>
        </PopoverContent>
      </Popover>

      {value.preset !== "all" && (
        <Button size="sm" variant="ghost" className="h-9 text-muted-foreground" onClick={() => onChange(rangeFromPreset("all"))}>
          <X className="h-4 w-4 mr-1" />Limpar
        </Button>
      )}
    </div>
  );
}
