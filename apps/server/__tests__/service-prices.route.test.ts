import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../_core/create-app";
import { executeSql } from "../_core/db";
import { applyMigrations, fetchWithAuth, resetDatabase, signUpAndGetToken } from "../_test/helpers";

beforeAll(async () => { await applyMigrations(); });
beforeEach(async () => {
  await resetDatabase();
  await executeSql("UPDATE service_prices SET priceCents=NULL");
});

describe("service prices route", () => {
  it("shows the current service prices publicly", async () => {
    const response = await app.fetch(new Request("http://localhost/api/service-prices"));
    expect(response.status).toBe(200);
    const payload = await response.json() as { data: { services: Array<{ serviceName: string; priceCents: number | null }> } };
    expect(payload.data.services).toHaveLength(4);
    expect(payload.data.services.every(item => item.priceCents === null)).toBe(true);
  });

  it("allows only an administrator to save prices from R$ 1.00 upwards", async () => {
    const regular = await signUpAndGetToken(app, { email: "prices-customer@example.com" });
    const denied = await fetchWithAuth(app, regular.token, "/api/service-prices", {
      method: "PATCH",
      body: JSON.stringify({ serviceName: "Banho de gel", priceCents: 100 })
    });
    expect(denied.status).toBe(403);

    await executeSql("UPDATE user SET role='admin' WHERE id=?", [regular.userId]);
    const saved = await fetchWithAuth(app, regular.token, "/api/service-prices", {
      method: "PATCH",
      body: JSON.stringify({ serviceName: "Banho de gel", priceCents: 100 })
    });
    expect(saved.status).toBe(200);

    const listed = await app.fetch(new Request("http://localhost/api/service-prices"));
    const payload = await listed.json() as { data: { services: Array<{ serviceName: string; priceCents: number | null }> } };
    expect(payload.data.services.find(item => item.serviceName === "Banho de gel")?.priceCents).toBe(100);
  });

  it("rejects values below R$ 1.00", async () => {
    const admin = await signUpAndGetToken(app, { email: "prices-admin@example.com" });
    await executeSql("UPDATE user SET role='admin' WHERE id=?", [admin.userId]);
    const response = await fetchWithAuth(app, admin.token, "/api/service-prices", {
      method: "PATCH",
      body: JSON.stringify({ serviceName: "Manicure e pedicure", priceCents: 99 })
    });
    expect(response.status).toBe(400);
  });
});
