import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { getAuth } from "../_core/auth";
import { executeSql } from "../_core/db";
import { adminRoute } from "../_core/route-helpers";
import { bodySizeLimit } from "../middlewares/body-size-limit";
import { distributedRateLimit, identityRateLimitCounter } from "../middlewares/distributed-rate-limit";
import { buildBetterAuthSessionHeaders } from "../middlewares/with-session";
import { env } from "../_core/env";

export const emailAuthorizationsRouter = new Hono();
const schema = z.object({ email: z.string().trim().email().max(254) });
const limit = distributedRateLimit((c) => [
  identityRateLimitCounter("email-authorizations:write", c.var.currentUser?.id, 10, 60)
]);

emailAuthorizationsRouter.get("/", adminRoute, async (c) => {
  const result = await executeSql(
    `SELECT
       authorised.email AS email,
       authorised.createdAt AS createdAt,
       account.id AS userId,
       account.name AS name
     FROM authorized_emails AS authorised
     LEFT JOIN user AS account ON lower(account.email) = authorised.email
     ORDER BY authorised.createdAt DESC
     LIMIT 500`
  );
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

emailAuthorizationsRouter.post("/:email/reset-password", adminRoute, limit, bodySizeLimit, async (c) => {
  const parsed = schema.safeParse({ email: c.req.param("email") });
  if (!parsed.success) return c.json(apiFailure("INVALID_EMAIL", "E-mail inválido."), 400);
  const email = parsed.data.email.toLowerCase();

  const authorised = await executeSql(
    "SELECT email FROM authorized_emails WHERE email = ? LIMIT 1",
    [email]
  );
  if (authorised.rows.length === 0) {
    return c.json(apiFailure("EMAIL_NOT_AUTHORIZED", "Este e-mail não está autorizado pelo administrador."), 403);
  }

  const found = await executeSql(
    "SELECT id, email, name FROM user WHERE lower(email) = ? LIMIT 1",
    [email]
  );
  const account = found.rows[0] as { id: string; email: string; name: string } | undefined;
  if (!account) {
    return c.json(apiFailure("ACCOUNT_NOT_FOUND", "Não existe uma conta original com este e-mail. Nenhuma conta foi criada."), 404);
  }

  const temporaryPassword = randomBytes(18).toString("base64url");
  await executeSql("UPDATE user SET mustChangePassword = 1 WHERE id = ?", [account.id]);

  try {
    await getAuth().api.setUserPassword({
      body: { userId: account.id, newPassword: temporaryPassword },
      headers: buildBetterAuthSessionHeaders(c.req.raw, env.RATE_LIMIT_TRUST_RENDER_PROXY)
    });
  } catch {
    await executeSql("UPDATE user SET mustChangePassword = 0 WHERE id = ?", [account.id]).catch(() => undefined);
    return c.json(apiFailure("PASSWORD_RESET_FAILED", "Não foi possível gerar a nova senha. A conta original foi preservada."), 500);
  }

  // Revoke every prior session. The user keeps the same account and signs in
  // with the new temporary password, then chooses a personal password.
  await executeSql("DELETE FROM session WHERE userId = ?", [account.id]);

  return c.json(apiSuccess({
    account: { id: account.id, name: account.name, email: account.email },
    temporaryPassword,
    mustChangePassword: true,
    sessionsRevoked: true
  }), 200);
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
