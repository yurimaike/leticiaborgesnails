import { Hono } from "hono";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { executeSql, DatabaseError } from "../_core/db";
import { adminRoute, publicRoute } from "../_core/route-helpers";

export const salonSettingsRouter = new Hono();
const timeSchema = z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/);
const updateSchema = z.object({
  isOpen: z.boolean().optional(),
  openingTime: timeSchema.optional(),
  closingTime: timeSchema.optional(),
  intervalMinutes: z.number().int().min(5).max(240).optional()
}).refine(value => Object.keys(value).length > 0, "Informe ao menos uma alteração.");
async function readSettings() {
  const result = await executeSql("SELECT is_open, opening_time, closing_time, interval_minutes, updated_at FROM salon_settings WHERE id=1 LIMIT 1");
  if (!result.rows[0]) throw new DatabaseError("SETTINGS_NOT_FOUND", "Configuração do salão não encontrada. Aplique as migrações 012 e 013.", 503);
  const row = result.rows[0];
  return { isOpen: Number(row.is_open) === 1, openingTime: String(row.opening_time), closingTime: String(row.closing_time), intervalMinutes: Number(row.interval_minutes ?? 90), updatedAt: row.updated_at ?? null };
}
salonSettingsRouter.get("/", publicRoute, async c => {
  try { return c.json(apiSuccess(await readSettings())); }
  catch (error) { if (error instanceof DatabaseError) return c.json(apiFailure(error.code, error.message), error.status as 400|403|404|409|502|503); throw error; }
});
salonSettingsRouter.patch("/", adminRoute, async c => {
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiFailure("INVALID_INPUT", "Confira o estado, os horários e o intervalo informados."), 400);
  try {
    const current = await readSettings();
    const next = { ...current, ...parsed.data };
    if (next.openingTime >= next.closingTime) return c.json(apiFailure("INVALID_HOURS", "O horário de fechamento deve ser posterior ao de abertura."), 400);
    await executeSql("UPDATE salon_settings SET is_open=?, opening_time=?, closing_time=?, interval_minutes=?, updated_at=CURRENT_TIMESTAMP WHERE id=1", [next.isOpen ? 1 : 0, next.openingTime, next.closingTime, next.intervalMinutes]);
    return c.json(apiSuccess(await readSettings()));
  } catch (error) { if (error instanceof DatabaseError) return c.json(apiFailure(error.code, error.message), error.status as 400|403|404|409|502|503); throw error; }
});
