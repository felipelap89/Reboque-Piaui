import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export type NotificationItem = {
  id: string;
  numero: string | null;
  cliente: string;
  tipo: string;
  origem: string | null;
  destino: string | null;
  valor: number;
  status: string;
  data: string;
  created_at: string;
};

const STORAGE_PREFIX = "notif:lastReadAt:";

export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null;

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastReadAt, setLastReadAt] = useState<string>(() => {
    if (typeof window === "undefined" || !storageKey) return new Date(0).toISOString();
    return window.localStorage.getItem(storageKey) ?? new Date(0).toISOString();
  });
  const [loaded, setLoaded] = useState(false);

  // Refresh stored lastReadAt when user changes
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    setLastReadAt(window.localStorage.getItem(storageKey) ?? new Date(0).toISOString());
  }, [storageKey]);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("servicos")
        .select("id, numero, cliente, tipo, origem, destino, valor, status, data, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      setItems((data ?? []) as NotificationItem[]);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("servicos-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "servicos" },
        (payload) => {
          const novo = payload.new as NotificationItem;
          setItems((prev) => {
            if (prev.some((p) => p.id === novo.id)) return prev;
            return [novo, ...prev].slice(0, 20);
          });
          toast(`🚨 ${novo.numero ?? "Novo chamado"} — ${novo.cliente}`, {
            description: `${novo.tipo}${novo.origem ? ` • ${novo.origem}` : ""}`,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "servicos" },
        (payload) => {
          const novo = payload.new as NotificationItem;
          const old = payload.old as Partial<NotificationItem>;
          if (novo.status === "Finalizado" && old.status !== "Finalizado") {
            setItems((prev) => {
              const next = prev.filter((p) => p.id !== novo.id);
              return [{ ...novo, created_at: new Date().toISOString() }, ...next].slice(0, 20);
            });
            toast.success(`✅ ${novo.numero ?? "Chamado"} finalizado`, {
              description: novo.cliente,
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const unreadCount = useMemo(() => {
    const t = new Date(lastReadAt).getTime();
    return items.filter((i) => new Date(i.created_at).getTime() > t).length;
  }, [items, lastReadAt]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setLastReadAt(now);
    if (typeof window !== "undefined" && storageKey) {
      window.localStorage.setItem(storageKey, now);
    }
  }, [storageKey]);

  return { items, unreadCount, markAllRead, loaded, lastReadAt };
}
