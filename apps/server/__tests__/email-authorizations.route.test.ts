import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../_core/create-app";
import { executeSql } from "../_core/db";
import { applyMigrations, fetchWithAuth, resetDatabase, signUpAndGetToken } from "../_test/helpers";

beforeAll(async () => { await applyMigrations(); });
beforeEach(async () => { await resetDatabase(); });

describe("admin email authorizations", () => {
  it("blocks public sign-up until an administrator authorises the exact email", async () => {
    const response = await app.fetch(new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Not allowed", email: "not-allowed@example.com", password: "password1234" })
    }));
    expect(response.status).toBe(403);
    const body = await response.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("REGISTRATION_CLOSED");
  });

  it("lets an admin authorise an email but keeps public self-registration closed", async () => {
    const admin = await signUpAndGetToken(app, { email: "admin-authorizer@example.com" });
    await executeSql("UPDATE user SET role = 'admin' WHERE id = ?", [admin.userId!]);
    const added = await fetchWithAuth(app, admin.token, "/api/email-authorizations", {
      method: "POST", body: JSON.stringify({ email: "Family.Member@Example.com" })
    });
    expect(added.status).toBe(201);

    const allowed = await app.fetch(new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Family member", email: "family.member@example.com", password: "password1234" })
    }));
    expect(allowed.status).toBe(403);
    const allowedBody = await allowed.json() as { error?: { code?: string } };
    expect(allowedBody.error?.code).toBe("REGISTRATION_CLOSED");
    
    const denied = await app.fetch(new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "Other person", email: "other@example.com", password: "password1234" })
    }));
    expect(denied.status).toBe(403);

    const listed = await fetchWithAuth(app, admin.token, "/api/email-authorizations");
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({ ok: true, data: { emails: expect.arrayContaining([expect.objectContaining({ email: "family.member@example.com" })]) } });
  });

  it("revoking an email blocks password login and previously issued API sessions", async () => {
    const admin = await signUpAndGetToken(app, { email: "admin-revoke@example.com" });
    await executeSql("UPDATE user SET role = 'admin' WHERE id = ?", [admin.userId!]);
    const staff = await signUpAndGetToken(app, { email: "staff-revoke@example.com" });

    const removed = await fetchWithAuth(
      app,
      admin.token,
      "/api/email-authorizations/staff-revoke%40example.com",
      { method: "DELETE" }
    );
    expect(removed.status).toBe(200);

    const login = await app.fetch(new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "staff-revoke@example.com", password: "password1234" })
    }));
    expect(login.status).toBe(403);
    const loginBody = await login.json() as { error?: { code?: string } };
    expect(loginBody.error?.code).toBe("EMAIL_NOT_AUTHORIZED");

    const oldSession = await fetchWithAuth(app, staff.token, "/api/email-authorizations");
    expect(oldSession.status).toBe(401);

    // Revoked staff may still use the public customer booking flow as a guest.
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const bookingDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    const customerBooking = await app.fetch(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Former staff customer",
        customerEmail: "staff-revoke@example.com",
        customerPhone: "51999999999",
        bookingDate,
        bookingTime: "11:00",
        service: "Manicure e pedicure"
      })
    }));
    expect(customerBooking.status).toBe(201);

    // Re-authorising the same address restores future sign-in without
    // resurrecting the old session that was revoked on dismissal.
    const reauthorised = await fetchWithAuth(app, admin.token, "/api/email-authorizations", {
      method: "POST",
      body: JSON.stringify({ email: "staff-revoke@example.com" })
    });
    expect(reauthorised.status).toBe(201);
    const newLogin = await app.fetch(new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: "staff-revoke@example.com", password: "password1234" })
    }));
    expect(newLogin.status).toBe(200);
    expect(newLogin.headers.get("set-auth-token")).toBeTruthy();
  });


  it("allows an admin to remove an authorised email when its original account does not exist", async () => {
    const admin = await signUpAndGetToken(app, { email: "admin-orphan-remove@example.com" });
    await executeSql("UPDATE user SET role = 'admin' WHERE id = ?", [admin.userId!]);

    const email = "leticiacaio.borges30@gmail.com";
    const added = await fetchWithAuth(app, admin.token, "/api/email-authorizations", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    expect(added.status).toBe(201);

    const before = await executeSql("SELECT id FROM user WHERE lower(email) = lower(?)", [email]);
    expect(before.rows).toHaveLength(0);

    const removed = await fetchWithAuth(
      app,
      admin.token,
      `/api/email-authorizations/${encodeURIComponent(email)}`,
      { method: "DELETE" }
    );
    expect(removed.status).toBe(200);
    expect(await removed.json()).toMatchObject({
      ok: true,
      data: { email, removed: true, sessionsRevoked: true }
    });

    const listed = await fetchWithAuth(app, admin.token, "/api/email-authorizations");
    expect(listed.status).toBe(200);
    const listedBody = await listed.json() as { data?: { emails?: Array<{ email: string }> } };
    expect(listedBody.data?.emails?.some(item => item.email.toLowerCase() === email)).toBe(false);

    const after = await executeSql("SELECT id FROM user WHERE lower(email) = lower(?)", [email]);
    expect(after.rows).toHaveLength(0);
  });

  it("does not let a normal account manage the authorisation list", async () => {
    const user = await signUpAndGetToken(app, { email: "regular-user@example.com" });
    const response = await fetchWithAuth(app, user.token, "/api/email-authorizations", {
      method: "POST", body: JSON.stringify({ email: "friend@example.com" })
    });
    expect(response.status).toBe(403);
  });
});
