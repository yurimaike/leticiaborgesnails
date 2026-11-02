import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { getAuth } from "../_core/auth";
import { executeSql } from "../_core/db";
import { adminRoute } from "../_core/route-helpers";
import { bodySizeLimit } from "../middlewares/body-size-limit";
import { distributedRateLimit, identityRateLimitCounter } from "../middlewares/distributed-rate-limit";

export const emailAuthorizationsRouter = new Hono();
const schema = z.object({ email: z.string().trim().email().max(254) });
const provisionSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(120).optional()
});
const limit = distributedRateLimit((c) => [
  identityRateLimitCounter("email-authorizations:write", c.var.currentUser?.id, 20, 60)
]);

emailAuthorizationsRouter.get("/", adminRoute, async (c) => {
  const result = await executeSql("SELECT email, createdAt FROM authorized_emails ORDER BY createdAt DESC LIMIT 500");
  return c.json(apiSuccess({ emails: result.rows }));
});

emailAuthorizationsRouter.post("/", adminRoute, limit, bodySizeLimit, async (c) => {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(apiFailure("INVALID_EMAIL", "Informe um e-mail válido."), 400);
  const email = parsed.data.email.toLowerCase();
  await executeSql(
    "INSERT INTO authorized_emails (email, createdBy, createdAt) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING",
    [email, c.var.currentUser.id, Math.floor(Date.now() / 1000)]
  );
  return c.json(apiSuccess({ email }), 201);
});

emailAuthorizationsRouter.post("/provision", adminRoute, limit, bodySizeLimit, async (c) => {
  const parsed = provisionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(apiFailure("INVALID_INPUT", "Informe um e-mail válido e, se desejar, o nome da pessoa."), 400);
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await executeSql("SELECT id FROM user WHERE lower(email) = ? LIMIT 1", [email]);
  if (existingUser.rows.length > 0) {
    return c.json(apiFailure("ACCOUNT_ALREADY_EXISTS", "Este e-mail já possui uma conta. Não foi criada outra senha."), 409);
  }

  const name = parsed.data.name?.trim() || email.split("@")[0];
  const temporaryPassword = randomBytes(18).toString("base64url");
  await executeSql(
    "INSERT INTO authorized_emails (email, createdBy, createdAt) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING",
    [email, c.var.currentUser.id, Math.floor(Date.now() / 1000)]
  );

  try {
    const created = await getAuth().api.signUpEmail({
      body: { name, email, password: temporaryPassword }
    });
    const userId = created.user?.id;
    if (!userId) {
      throw new Error("Better Auth did not return the created user id");
    }

    await executeSql("UPDATE user SET mustChangePassword = 1 WHERE id = ?", [userId]);
    // Do not leave an automatically-created session active; the employee must
    // sign in themselves with the one-time password shown to the administrator.
    await executeSql("DELETE FROM session WHERE userId = ?", [userId]);

    return c.json(apiSuccess({
      account: { id: userId, name, email },
      temporaryPassword,
      mustChangePassword: true
    }), 201);
  } catch {
    return c.json(apiFailure("ACCOUNT_PROVISION_FAILED", "Não foi possível criar a conta. Verifique se o e-mail já está cadastrado e tente novamente."), 409);
  }
});

emailAuthorizationsRouter.delete("/:email", adminRoute, limit, async (c) => {
  const parsed = schema.safeParse({ email: c.req.param("email") });
  if (!parsed.success) return c.json(apiFailure("INVALID_EMAIL", "E-mail inválido."), 400);
  const email = parsed.data.email.toLowerCase();
  await executeSql("DELETE FROM authorized_emails WHERE email = ?", [email]);
  // Revoke every existing session immediately; the user account itself remains intact.
  await executeSql(
    "DELETE FROM session WHERE userId IN (SELECT id FROM user WHERE lower(email) = ?)",
    [email]
  );
  return c.json(apiSuccess({ email, removed: true, sessionsRevoked: true }));
});
