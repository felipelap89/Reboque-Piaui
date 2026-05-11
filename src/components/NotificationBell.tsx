import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";

function brl(n: number) {
  return Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function NotificationBell() {
  const { items, unreadCount, markAllRead, lastReadAt } = useNotifications();
  const lastReadMs = new Date(lastReadAt).getTime();

  return (
    <Popover onOpenChange={(o) => { if (!o) markAllRead(); }}>
      <PopoverTrigger asChild>
        <button
          className="relative grid h-9 w-9 place-items-center rounded-lg bg-card border border-border hover:bg-accent transition"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Notificações</div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-[360px]">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nenhum chamado ainda.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((it) => {
                const unread = new Date(it.created_at).getTime() > lastReadMs;
                return (
                  <li key={it.id}>
                    <Link
                      to="/servicos"
                      className={`flex flex-col gap-0.5 px-3 py-2.5 hover:bg-accent transition ${unread ? "bg-accent/40" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                          <div className="min-w-0">
                            {it.numero && <div className="font-mono text-[10px] text-primary">{it.numero}</div>}
                            <span className="truncate text-sm font-medium block">{it.cliente}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(it.created_at)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        🛠️ {it.tipo}
                        {(it.origem || it.destino) ? ` • ${it.origem ?? "?"} → ${it.destino ?? "?"}` : ""}
                      </div>
                      <div className="text-xs font-semibold">{brl(Number(it.valor ?? 0))}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
