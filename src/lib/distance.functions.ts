import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { calculateRouteDistance } from "./distance-core";

const inputSchema = z.object({
  origem: z.string().min(2).max(200),
  destino: z.string().min(2).max(200),
});

export const calcDistance = createServerFn({ method: "POST" })
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.ORS_API_KEY;
    if (!key) throw new Error("ORS_API_KEY não configurada");
    return calculateRouteDistance(data.origem, data.destino, key);
  });
