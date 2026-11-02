import { Hono } from "hono";
import { apiSuccess } from "@repo/shared/http";
import { executeSql } from "../_core/db";
import { protectedRoute } from "../_core/route-helpers";

export const accountRouter = new Hono();

accountRouter.get("/first-login-status", protectedRoute, async (c) => {
  const result = await executeSql(
    "SELECT mustChangePassword FROM user WHERE id = ? LIMIT 1",
    [c.var.currentUser.id]
  );
  return c.json(apiSuccess({
    mustChangePassword: Number(result.rows[0]?.mustChangePassword ?? 0) === 1
  }), 200);
});
