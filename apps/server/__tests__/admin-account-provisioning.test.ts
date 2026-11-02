import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../_core/create-app";
import { getAuth } from "../_core/auth";
import { executeSql } from "../_core/db";
import { applyMigrations, fetchWithAuth, resetDatabase } from "../_test/helpers";

beforeAll(async () => { await applyMigrations(); });
beforeEach(async () => { await resetDatabase(); });

async function createAccount(email: string, name: string, password = "existing-password-123") {
  await executeSql(
    "INSERT INTO authorized_emails (email, createdBy, createdAt) VALUES (?, ?, ?)",
    [email, "test-fixture", Math.floor(Date.now() / 1000)]
  );
  const created = await getAuth().api.signUpEmail({ body: { name, email, password } });
  if (!created.token) throw new Error("Better Auth returned no fixture session token");
  return { id: created.user.id, token: created.token, password };
}

async function createAdmin() {
  const admin = await createAccount("reset-admin@example.com", "Reset Admin", "admin-password-123");
  await executeSql("UPDATE user SET role = 'admin' WHERE id = ?", [admin.id]);
  return admin;
}

describe("administrator temporary password reset", () => {
  it("resets the password of the original account and forces a personal password change", async () => {
    const admin = await createAdmin();
    const staff = await createAccount("existing.staff@example.com", "Existing Staff");

    const before = await executeSql(
      "SELECT id, name, email, mustChangePassword FROM user WHERE id = ?",
      [staff.id]
    );
    const accountBefore = await executeSql(
      "SELECT id, providerId, password FROM account WHERE userId = ? AND providerId = 'credential'",
      [staff.id]
    );

    await executeSql(
      `INSERT INTO bookings
        (id, bookingCode, customerName, customerEmail, customerPhone, bookingDate, bookingTime, service, status, userId, createdAt, updatedAt, paymentStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["booking-original-user", "ORIGINAL123", "Existing Staff", "existing.staff@example.com", "51999999999",
       "2027-01-15", "10:00", "Manicure e pedicure", "confirmed", staff.id,
       "2026-11-02T00:00:00.000Z", "2026-11-02T00:00:00.000Z", "unpaid"]
    );

    const reset = await fetchWithAuth(
      app,
      admin.token,
      "/api/email-authorizations/existing.staff%40example.com/reset-password",
      { method: "POST" }
    );

    expect(reset.status).toBe(200);
    const resetBody = await reset.json() as {
      ok: boolean;
      data?: { account: { id: string; name: string; email: string }; temporaryPassword: string; mustChangePassword: boolean };
    };
    expect(resetBody.ok).toBe(true);
    expect(resetBody.data?.account).toEqual({
      id: staff.id,
      name: "Existing Staff",
      email: "existing.staff@example.com"
    });
    expect(resetBody.data?.temporaryPassword).toHaveLength(24);
    expect(resetBody.data?.mustChangePassword).toBe(true);

    const after = await executeSql(
      "SELECT id, name, email, mustChangePassword FROM user WHERE id = ?",
      [staff.id]
    );
    expect(after.rows[0]?.id).toBe(before.rows[0]?.id);
    expect(after.rows[0]?.name).toBe("Existing Staff");
    expect(after.rows[0]?.email).toBe("existing.staff@example.com");
    expect(Number(after.rows[0]?.mustChangePassword)).toBe(1);

    const accountAfter = await executeSql(
      "SELECT id, providerId, password FROM account WHERE userId = ? AND providerId = 'credential'",
      [staff.id]
    );
    expect(accountAfter.rows).toHaveLength(1);
    expect(accountAfter.rows[0]?.id).toBe(accountBefore.rows[0]?.id);
    expect(accountAfter.rows[0]?.password).not.toBe(accountBefore.rows[0]?.password);

    const history = await executeSql("SELECT userId, bookingCode FROM bookings WHERE id = ?", ["booking-original-user"]);
    expect(history.rows).toEqual([{ userId: staff.id, bookingCode: "ORIGINAL123" }]);

    const oldSession = await executeSql("SELECT id FROM session WHERE userId = ?", [staff.id]);
    expect(oldSession.rows).toHaveLength(0);

    const oldLogin = await app.fetch(new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "existing.staff@example.com", password: staff.password })
    }));
    expect(oldLogin.status).toBe(401);

    const login = await app.fetch(new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "existing.staff@example.com", password: resetBody.data!.temporaryPassword })
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
        currentPassword: resetBody.data!.temporaryPassword,
        newPassword: "my-new-secure-password-2026",
        revokeOtherSessions: true
      })
    }));
    expect(changed.status).toBe(200);

    const afterChange = await executeSql(
      "SELECT mustChangePassword FROM user WHERE id = ?",
      [staff.id]
    );
    expect(Number(afterChange.rows[0]?.mustChangePassword)).toBe(0);

    const newLogin = await app.fetch(new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "existing.staff@example.com", password: "my-new-secure-password-2026" })
    }));
    expect(newLogin.status).toBe(200);
  });

  it("does not create a new account when an authorised email has no existing user", async () => {
    const admin = await createAdmin();
    await executeSql(
      "INSERT INTO authorized_emails (email, createdBy, createdAt) VALUES (?, ?, ?)",
      ["not-created@example.com", admin.id, Math.floor(Date.now() / 1000)]
    );

    const response = await fetchWithAuth(
      app,
      admin.token,
      "/api/email-authorizations/not-created%40example.com/reset-password",
      { method: "POST" }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "ACCOUNT_NOT_FOUND" }
    });
    const accountCount = await executeSql("SELECT COUNT(*) AS count FROM user WHERE lower(email) = ?", ["not-created@example.com"]);
    expect(Number(accountCount.rows[0]?.count)).toBe(0);
  });

  it("does not allow a normal account to reset another person's password", async () => {
    const regular = await createAccount("regular.user@example.com", "Regular User");
    const target = await createAccount("target.staff@example.com", "Target Staff");

    const response = await fetchWithAuth(
      app,
      regular.token,
      "/api/email-authorizations/target.staff%40example.com/reset-password",
      { method: "POST" }
    );

    expect(response.status).toBe(403);
    const targetLogin = await app.fetch(new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "target.staff@example.com", password: target.password })
    }));
    expect(targetLogin.status).toBe(200);
  });
});
