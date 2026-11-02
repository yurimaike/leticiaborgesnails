import { Hono } from "hono";
import { cors } from "hono/cors";
import { routeEntries } from "./route-registry";
import { withSession } from "../middlewares/with-session";
import { notFound } from "../middlewares/not-found";
import { onError } from "../middlewares/on-error";
import { getAuth } from "./auth";
import { isDatabaseConfigured } from "./db";
import { getAllowedOrigin } from "./env";
import { apiFailure } from "@repo/shared/http";

const app = new Hono({ strict: false });

app.use(
  "/api/*",
  cors({
    origin: (origin) => getAllowedOrigin(origin),
    exposeHeaders: ["set-auth-token"],
    allowHeaders: ["Authorization", "Content-Type", "X-Auth-Return-Redirect"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
  })
);

app.options("/api/auth/*", (c) => c.body(null, 204));
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  if (!isDatabaseConfigured()) {
    return c.json(apiFailure("DATABASE_UNCONFIGURED", "Skybase database runtime env is not configured"), 503);
  }

  // Public self-registration is closed. Accounts are provisioned by an administrator.
  const authPath = new URL(c.req.url).pathname;
  if (c.req.method === "POST" && authPath === "/api/auth/sign-up/email") {
    return c.json(apiFailure("REGISTRATION_CLOSED", "O cadastro é feito somente pelo administrador."), 403);
  }

  // A temporary-password account may only inspect its session, sign out, or
  // change its password. Clear the flag only after Better Auth confirms success.
  const isPasswordChange = c.req.method === "POST" && authPath === "/api/auth/change-password";
  const isAllowedFirstLoginAuthPath =
    isPasswordChange ||
    (c.req.method === "POST" && authPath === "/api/auth/sign-out") ||
    ((c.req.method === "GET" || c.req.method === "POST") && authPath === "/api/auth/get-session");
  const activeSession = await getAuth().api.getSession({ headers: c.req.raw.headers }).catch(() => null);
  const activeUserId = activeSession?.user?.id;
  if (activeUserId && !isAllowedFirstLoginAuthPath) {
    const pending = await (await import("./db")).executeSql(
      "SELECT mustChangePassword FROM user WHERE id = ? LIMIT 1",
      [activeUserId]
    );
    if (Number(pending.rows[0]?.mustChangePassword ?? 0) === 1) {
      return c.json(apiFailure("PASSWORD_CHANGE_REQUIRED", "Altere sua senha temporária antes de continuar."), 403);
    }
  }

  // Email/password sign-in requires current administrator authorisation.
  if (c.req.method === "POST" && authPath === "/api/auth/sign-in/email") {
    const body = await c.req.raw.clone().json().catch(() => null) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json(apiFailure("INVALID_EMAIL", "Informe um e-mail válido."), 400);
    }
    const { executeSql } = await import("./db");
    const authorised = await executeSql("SELECT email FROM authorized_emails WHERE email = ? LIMIT 1", [email]);
    if (authorised.rows.length === 0) {
      return c.json(apiFailure("EMAIL_NOT_AUTHORIZED", "Este e-mail ainda não foi autorizado pelo administrador."), 403);
    }
  }

  const response = await getAuth().handler(c.req.raw);
  if (isPasswordChange && response.ok && activeUserId) {
    const { executeSql } = await import("./db");
    await executeSql("UPDATE user SET mustChangePassword = 0 WHERE id = ?", [activeUserId]);
  }
  return response;
});
app.use("/api/*", withSession);

// Routes are auto-discovered from apps/server/routes/*.route.ts and mounted at
// /api/<name>. To add an endpoint, add a route file — no edits needed here.
for (const { path, router } of routeEntries) {
  app.route(path, router);
}

app.onError(onError);
app.notFound(notFound);

export default app;
