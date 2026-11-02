import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../_core/create-app";
import { getAuth } from "../_core/auth";
import { executeSql } from "../_core/db";
import { applyMigrations, fetchWithAuth, resetDatabase } from "../_test/helpers";

beforeAll(async () => { await applyMigrations(); });
beforeEach(async () => { await resetDatabase(); });

async function createAdmin() {
  const email = "provision-admin@example.com";
  await executeSql(
    "INSERT INTO authorized_emails (email, createdBy, createdAt) VALUES (?, ?, ?)",
    [email, "test-fixture", Math.floor(Date.now() / 1000)]
  );
  const created = await getAuth().api.signUpEmail({
    body: { name: "Provision Admin", email, password: "admin-password-123" }
  });
  if (!created.token) throw new Error("Better Auth returned no admin session token");
  await executeSql("UPDATE user SET role = 'admin' WHERE id = ?", [created.user.id]);
  return { token: created.token, userId: created.user.id };
}

describe("administrator account provisioning", () => {
  it("creates an authorised account, returns a one-time password, and enforces its first change", async () => {
    const admin = await createAdmin();
    const provision = await fetchWithAuth(app, admin.token, "/api/email-authorizations/provision", {
      method: "POST",
      body: JSON.stringify({ name: "New Team Member", email: "new.member@example.com" })
    });

    expect(provision.status).toBe(201);
    const provisionBody = await provision.json() as {
      ok: boolean;
      data?: { account: { id: string; email: string }; temporaryPassword: string; mustChangePassword: boolean };
    };
    expect(provisionBody.ok).toBe(true);
    expect(provisionBody.data?.temporaryPassword).toHaveLength(24);
    expect(provisionBody.data?.mustChangePassword).toBe(true);
    expect(provisionBody.data?.account.email).toBe("new.member@example.com");

    const stored = await executeSql(
      "SELECT mustChangePassword FROM user WHERE id = ?",
      [provisionBody.data!.account.id]
    );
    expect(Number(stored.rows[0]?.mustChangePassword)).toBe(1);

    const login = await app.fetch(new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "new.member@example.com", password: provisionBody.data!.temporaryPassword })
    }));
    expect(login.status).toBe(200);
    const staffToken = login.headers.get("set-auth-token");
    expect(staffToken).toBeTruthy();

    const status = await fetchWithAuth(app, staffToken!, "/api/account/first-login-status");
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({ ok: true, data: { mustChangePassword: true } });

    const blocked = await fetchWithAuth(app, staffToken!, "/api/me/profile");
    expect(blocked.status).toBe(403);

    const changed = await app.fetch(new Request("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        authorization: `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        currentPassword: provisionBody.data!.temporaryPassword,
        newPassword: "my-new-secure-password-2026",
        revokeOtherSessions: true
      })
    }));
    expect(changed.status).toBe(200);

    const afterChange = await executeSql(
      "SELECT mustChangePassword FROM user WHERE id = ?",
      [provisionBody.data!.account.id]
    );
    expect(Number(afterChange.rows[0]?.mustChangePassword)).toBe(0);

    const allowed = await fetchWithAuth(app, staffToken!, "/api/me/profile");
    expect(allowed.status).toBe(200);
  });

  it("rejects duplicate accounts without generating another password", async () => {
    const admin = await createAdmin();
    const first = await fetchWithAuth(app, admin.token, "/api/email-authorizations/provision", {
      method: "POST",
      body: JSON.stringify({ email: "duplicate@example.com" })
    });
    expect(first.status).toBe(201);

    const second = await fetchWithAuth(app, admin.token, "/api/email-authorizations/provision", {
      method: "POST",
      body: JSON.stringify({ email: "duplicate@example.com" })
    });
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toMatchObject({ ok: false, error: { code: "ACCOUNT_ALREADY_EXISTS" } });
  });

  it("does not allow a normal account to provision another account", async () => {
    const email = "regular-user@example.com";
    await executeSql(
      "INSERT INTO authorized_emails (email, createdBy, createdAt) VALUES (?, ?, ?)",
      [email, "test-fixture", Math.floor(Date.now() / 1000)]
    );
    const created = await getAuth().api.signUpEmail({
      body: { name: "Regular User", email, password: "regular-password-123" }
    });
    if (!created.token) throw new Error("Better Auth returned no user session token");
    const response = await fetchWithAuth(app, created.token, "/api/email-authorizations/provision", {
      method: "POST",
      body: JSON.stringify({ email: "friend@example.com" })
    });
    expect(response.status).toBe(403);
  });
});
