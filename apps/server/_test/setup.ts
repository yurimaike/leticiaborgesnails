// Vitest global setup for the server test suite. Runs once per test file
// (worker) before any test code, including before the test file imports the
// Hono app. Two things must happen here, in order:
//
//   1. Redirect `@libsql/client/web` to the node variant of `@libsql/client`.
//      The web client only supports HTTP / libsql:// URLs; the node client
//      adds :memory: and file:// scheme support. Both expose the same
//      createClient/Client API surface so the rest of _core/db.ts works
//      unchanged.
//
//   2. Set the env vars _core/env.ts reads at module load. Without these
//      isDatabaseConfigured() returns false and every /api/auth/* request
//      short-circuits with 503 DATABASE_UNCONFIGURED.

import { vi } from "vitest";

vi.mock("@libsql/client/web", async () => {
  return await import("@libsql/client");
});

const TEST_DB_URL = ":memory:";

// Tests must never inherit Turso credentials from the CI runner. _core/db.ts
// prefers Turso whenever both variables are non-empty; leaving them inherited
// can silently send test queries to a remote database that has a different
// schema. Force the test process to use the isolated local libSQL database.
// These are test-process values only; production configuration is unchanged.
process.env.TURSO_DATABASE_URL = "";
process.env.TURSO_AUTH_TOKEN = "";

// Use ??= for the legacy local test client so a runner can explicitly point
// tests at a dedicated libsql-server when needed.
process.env.SKYBASE_DB_ENDPOINT ??= TEST_DB_URL;
process.env.SKYBASE_DB_TOKEN ??= "test-token";
process.env.SKYBASE_DB_NAMESPACE ??= "test-ns";
process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-32-chars-or-more-fixed";
process.env.BETTER_AUTH_URL ??= "http://localhost:3001/api/auth";
process.env.ALLOWED_ORIGINS ??= "http://localhost:3000";
