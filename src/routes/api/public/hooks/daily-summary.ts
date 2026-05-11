import { createFileRoute } from "@tanstack/react-router";
import { sendDailySummaryToManagers } from "@/lib/notify-manager.functions";

export const Route = createFileRoute("/api/public/hooks/daily-summary")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const r: any = await sendDailySummaryToManagers();
          return Response.json(r);
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "erro" }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, hint: "POST para disparar resumo" }),
    },
  },
});
