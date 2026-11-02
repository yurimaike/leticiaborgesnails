import { Hono } from "hono";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { DatabaseError, executeSql } from "../_core/db";
import { adminRoute, publicRoute } from "../_core/route-helpers";
import { BOOKING_SERVICES } from "../services/bookings";
import { bodySizeLimit } from "../middlewares/body-size-limit";

export const servicePricesRouter = new Hono();
const updateSchema = z.object({
  serviceName: z.string().trim().min(2).max(120),
  priceCents: z.number().int().min(100).max(100_000_000).nullable()
});

function fail(c: any, error: unknown) {
  if (error instanceof DatabaseError) return c.json(apiFailure(error.code, error.message), error.status as 400|403|404|409|502|503);
  throw error;
}

servicePricesRouter.get("/", publicRoute, async c => {
  try {
    const result = await executeSql("SELECT serviceName,priceCents,updatedAt FROM service_prices ORDER BY serviceName");
    return c.json(apiSuccess({ services: result.rows.map(row => ({ serviceName: String(row.serviceName), priceCents: row.priceCents == null ? null : Number(row.priceCents), updatedAt: row.updatedAt })) }));
  } catch (error) { return fail(c, error); }
});

servicePricesRouter.patch("/", adminRoute, bodySizeLimit, async c => {
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiFailure("INVALID_INPUT", "Informe um preço válido a partir de R$ 1,00 ou deixe vazio para ocultar."), 400);
  if (!BOOKING_SERVICES.includes(parsed.data.serviceName as typeof BOOKING_SERVICES[number])) return c.json(apiFailure("INVALID_SERVICE", "Serviço não encontrado."), 404);
  try {
    const result = await executeSql("UPDATE service_prices SET priceCents=?,updatedAt=CURRENT_TIMESTAMP WHERE serviceName=?", [parsed.data.priceCents, parsed.data.serviceName]);
    if (Number(result.rowsAffected) !== 1) return c.json(apiFailure("SERVICE_NOT_FOUND", "Serviço não encontrado."), 404);
    return c.json(apiSuccess({ service: { serviceName: parsed.data.serviceName, priceCents: parsed.data.priceCents } }));
  } catch (error) { return fail(c, error); }
});
