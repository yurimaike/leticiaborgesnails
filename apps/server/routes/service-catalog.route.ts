import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { DatabaseError, executeSql } from "../_core/db";
import { adminRoute, publicRoute } from "../_core/route-helpers";
import { bodySizeLimit } from "../middlewares/body-size-limit";

export const serviceCatalogRouter = new Hono();
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(""),
  detail: z.string().trim().max(800).default(""),
  mark: z.string().trim().max(20).default("SERVIÇO"),
  sortOrder: z.number().int().min(0).max(10000).optional()
});
const updateSchema = createSchema.extend({
  id: z.string().min(1),
  active: z.boolean().optional()
});

function fail(c: any, error: unknown) {
  if (error instanceof DatabaseError) return c.json(apiFailure(error.code, error.message), error.status as 400|403|404|409|502|503);
  throw error;
}
function rowShape(row: Record<string, unknown>) {
  return { id:String(row.id), name:String(row.name), description:String(row.description ?? ""), detail:String(row.detail ?? ""), mark:String(row.mark ?? ""), active:Number(row.active) === 1, sortOrder:Number(row.sortOrder ?? 0), updatedAt:row.updatedAt };
}

serviceCatalogRouter.get("/", publicRoute, async c => {
  try {
    const result = await executeSql("SELECT id,name,description,detail,mark,active,sortOrder,updatedAt FROM service_catalog WHERE active=1 ORDER BY sortOrder,name");
    return c.json(apiSuccess({ services: result.rows.map(row => rowShape(row as Record<string, unknown>)) }));
  } catch (error) { return fail(c, error); }
});

serviceCatalogRouter.get("/admin", adminRoute, async c => {
  try {
    const result = await executeSql("SELECT id,name,description,detail,mark,active,sortOrder,updatedAt FROM service_catalog ORDER BY sortOrder,name");
    return c.json(apiSuccess({ services: result.rows.map(row => rowShape(row as Record<string, unknown>)) }));
  } catch (error) { return fail(c, error); }
});

serviceCatalogRouter.post("/", adminRoute, bodySizeLimit, async c => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiFailure("INVALID_INPUT", "Informe um nome válido para o serviço."), 400);
  try {
    const id = randomUUID();
    const order = parsed.data.sortOrder ?? Number((await executeSql("SELECT COALESCE(MAX(sortOrder),0)+1 AS nextOrder FROM service_catalog")).rows[0]?.nextOrder ?? 1);
    await executeSql("INSERT INTO service_catalog (id,name,description,detail,mark,active,sortOrder) VALUES (?,?,?,?,?,1,?)", [id, parsed.data.name, parsed.data.description, parsed.data.detail, parsed.data.mark || "SERVIÇO", order]);
    await executeSql("INSERT OR IGNORE INTO service_prices (serviceName,priceCents) VALUES (?,NULL)", [parsed.data.name]);
    const result = await executeSql("SELECT id,name,description,detail,mark,active,sortOrder,updatedAt FROM service_catalog WHERE id=?", [id]);
    return c.json(apiSuccess({ service: rowShape(result.rows[0] as Record<string, unknown>) }), 201);
  } catch (error) {
    if (error instanceof DatabaseError && /unique constraint/i.test(error.databaseMessage)) return c.json(apiFailure("SERVICE_EXISTS", "Já existe um serviço com esse nome."), 409);
    return fail(c, error);
  }
});

serviceCatalogRouter.patch("/", adminRoute, bodySizeLimit, async c => {
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiFailure("INVALID_INPUT", "Confira o nome e os dados do serviço."), 400);
  try {
    const current = await executeSql("SELECT name FROM service_catalog WHERE id=? LIMIT 1", [parsed.data.id]);
    if (!current.rows[0]) return c.json(apiFailure("SERVICE_NOT_FOUND", "Serviço não encontrado."), 404);
    const oldName = String(current.rows[0].name);
    const { id, ...data } = parsed.data;
    await executeSql("UPDATE service_catalog SET name=?,description=?,detail=?,mark=?,active=?,sortOrder=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?", [data.name, data.description, data.detail, data.mark || "SERVIÇO", data.active === false ? 0 : 1, data.sortOrder ?? 0, id]);
    if (oldName !== data.name) {
      await executeSql("UPDATE service_prices SET serviceName=? WHERE serviceName=?", [data.name, oldName]);
    }
    await executeSql("INSERT OR IGNORE INTO service_prices (serviceName,priceCents) VALUES (?,NULL)", [data.name]);
    const result = await executeSql("SELECT id,name,description,detail,mark,active,sortOrder,updatedAt FROM service_catalog WHERE id=?", [id]);
    return c.json(apiSuccess({ service: rowShape(result.rows[0] as Record<string, unknown>) }));
  } catch (error) {
    if (error instanceof DatabaseError && /unique constraint/i.test(error.databaseMessage)) return c.json(apiFailure("SERVICE_EXISTS", "Já existe um serviço com esse nome."), 409);
    return fail(c, error);
  }
});

serviceCatalogRouter.delete("/:id", adminRoute, async c => {
  try {
    const result = await executeSql("UPDATE service_catalog SET active=0,updatedAt=CURRENT_TIMESTAMP WHERE id=?", [c.req.param("id")]);
    if (Number(result.rowsAffected) !== 1) return c.json(apiFailure("SERVICE_NOT_FOUND", "Serviço não encontrado."), 404);
    return c.json(apiSuccess({ id:c.req.param("id"), active:false }));
  } catch (error) { return fail(c, error); }
});
