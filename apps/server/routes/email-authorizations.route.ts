import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Hono } from "hono";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { executeSql } from "../_core/db";
import { adminRoute } from "../_core/route-helpers";
import { bodySizeLimit } from "../middlewares/body-size-limit";
import { distributedRateLimit, identityRateLimitCounter } from "../middlewares/distributed-rate-limit";

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
     LEFT JOIN user AS account ON lower(account.email) = lower(authorised.email)
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
    "SELECT email FROM authorized_emails WHERE lower(email) = ? LIMIT 1",
    [email]
  );
  if (authorised.rows.length === 0) {
    return c.json(apiFailure("EMAIL_NOT_AUTHORIZED", "Este e-mail não está autorizado pelo administrador."), 403);
  }

  const found = await executeSql(
    "SELECT id, email, name FROM user WHERE lower(email) = ? LIMIT 1",
    [email]
  );
  const accountUser = found.rows[0] as { id: string; email: string; name: string } | undefined;
  if (!accountUser) {
    return c.json(apiFailure("ACCOUNT_NOT_FOUND", "Não existe uma conta original com este e-mail. Nenhuma conta foi criada."), 404);
  }

  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  const now = Math.floor(Date.now() / 1000);

  // Set the gate first. If hashing/storage fails, restore the previous flag.
  await executeSql("UPDATE user SET mustChangePassword = 1 WHERE id = ?", [accountUser.id]);
  try {
    const credential = await executeSql(
      "SELECT id FROM account WHERE userId = ? AND providerId = 'credential' LIMIT 1",
      [accountUser.id]
    );
    if (credential.rows.length > 0) {
      // Preserve the original credential-account ID and update only its hash.
      await executeSql(
        "UPDATE account SET password = ?, updatedAt = ? WHERE id = ?",
        [passwordHash, now, credential.rows[0].id as string]
      );
    } else {
      // For an existing OAuth-only account, attach a credential login to the
      // same user ID; never create a second user or replace account history.
      await executeSql(
        `INSERT INTO account
          (id, accountId, providerId, userId, password, createdAt, updatedAt)
         VALUES (?, ?, 'credential', ?, ?, ?, ?)`,
        [randomBytes(16).toString("hex"), accountUser.id, accountUser.id, passwordHash, now, now]
      );
    }
  } catch {
    await executeSql("UPDATE user SET mustChangePassword = 0 WHERE id = ?", [accountUser.id]).catch(() => undefined);
    return c.json(apiFailure("PASSWORD_RESET_FAILED", "Não foi possível gerar a nova senha. A conta original foi preservada."), 500);
  }

  let sessionsRevoked = true;
  try {
    await executeSql("DELETE FROM session WHERE userId = ?", [accountUser.id]);
  } catch {
    // The mustChangePassword gate still blocks any old session if cleanup fails.
    sessionsRevoked = false;
  }

  return c.json(apiSuccess({
    account: { id: accountUser.id, name: accountUser.name, email: accountUser.email },
    temporaryPassword,
    mustChangePassword: true,
    sessionsRevoked
  }), 200);
});

emailAuthorizationsRouter.delete("/:email", adminRoute, limit, async (c) => {
  const parsed = schema.safeParse({ email: c.req.param("email") });
  if (!parsed.success) return c.json(apiFailure("INVALID_EMAIL", "E-mail inválido."), 400);
  const email = parsed.data.email.toLowerCase();
  await executeSql("DELETE FROM authorized_emails WHERE lower(email) = ?", [email]);
  // Revoke every existing session immediately; the user account itself remains intact.
  await executeSql(
    "DELETE FROM session WHERE userId IN (SELECT id FROM user WHERE lower(email) = ?)",
    [email]
  );
  return c.json(apiSuccess({ email, removed: true, sessionsRevoked: true }));
});
