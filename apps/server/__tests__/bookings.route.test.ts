import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../_core/create-app";
import { executeSql } from "../_core/db";
import { applyMigrations, fetchWithAuth, resetDatabase, signUpAndGetToken } from "../_test/helpers";

beforeAll(async () => { await applyMigrations(); });
beforeEach(async () => { await resetDatabase(); await executeSql("DELETE FROM bookings"); await executeSql("UPDATE salon_settings SET is_open=1, opening_time='08:00', closing_time='19:00', interval_minutes=90 WHERE id=1"); });
function futureDate(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
describe("bookings route", () => {
  it("creates pending reservation and lists the slot as busy", async () => {
    const date = futureDate(20);
    const res = await app.fetch(new Request("http://localhost/api/bookings", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({customerName:"Test User",customerEmail:"test@example.com",customerPhone:"51999999999",bookingDate:date,bookingTime:"11:00",service:"Pés tradicional"}) }));
    expect(res.status).toBe(201);
    const body = await res.json() as {data:{status:string;id:string;bookingCode:string}};
    expect(body.data.status).toBe("pending");
    expect(body.data.bookingCode).toMatch(/^LET-[A-F0-9]+$/);
    const list = await app.fetch(new Request(`http://localhost/api/bookings?date=${date}`));
    expect(((await list.json()) as {data:{busyTimes:string[]}}).data.busyTimes).toContain("11:00");
  });

  it("blocks only new bookings when manually closed and preserves existing reservations", async () => {
    const date = futureDate(23);
    const existing = await app.fetch(new Request("http://localhost/api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerName: "Existing Client", customerEmail: "existing@example.com", customerPhone: "51999999999", bookingDate: date, bookingTime: "11:00", service: "Pés tradicional" }) }));
    expect(existing.status).toBe(201);
    const existingBody = await existing.json() as { data: { id: string } };
    const admin = await signUpAndGetToken(app, { email: "salon-settings-admin@example.com" });
    if (!admin.userId) throw new Error("Admin fixture did not return a user id");
    await executeSql("UPDATE user SET role='admin' WHERE id=?", [admin.userId]);
    const closed = await fetchWithAuth(app, admin.token, "/api/salon-settings", { method: "PATCH", body: JSON.stringify({ isOpen: false, openingTime: "09:00", closingTime: "18:00" }) });
    expect(closed.status).toBe(200);
    const closedPayload = await closed.json() as { data: { isOpen: boolean; openingTime: string; closingTime: string } };
    expect(closedPayload.data).toMatchObject({ isOpen: false, openingTime: "09:00", closingTime: "18:00" });
    const rejectedNew = await app.fetch(new Request("http://localhost/api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerName: "New Client", customerEmail: "new@example.com", customerPhone: "51999999999", bookingDate: futureDate(24), bookingTime: "11:00", service: "Pés tradicional" }) }));
    expect(rejectedNew.status).toBe(409);
    const stored = await executeSql("SELECT status FROM bookings WHERE id=?", [existingBody.data.id]);
    expect(stored.rows[0]?.status).toBe("pending");
    const reopened = await fetchWithAuth(app, admin.token, "/api/salon-settings", { method: "PATCH", body: JSON.stringify({ isOpen: true }) });
    expect(reopened.status).toBe(200);
    const acceptedAfterOpening = await app.fetch(new Request("http://localhost/api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerName: "New Client", customerEmail: "new@example.com", customerPhone: "51999999999", bookingDate: futureDate(24), bookingTime: "11:00", service: "Pés tradicional" }) }));
    expect(acceptedAfterOpening.status).toBe(201);
  });
  it("uses admin-configured interval and accepts a closing-time slot at 22:00", async () => {
    const admin = await signUpAndGetToken(app, { email: "booking-hours-admin@example.com" });
    if (!admin.userId) throw new Error("Admin fixture did not return a user id");
    await executeSql("UPDATE user SET role='admin' WHERE id=?", [admin.userId]);
    const saved = await fetchWithAuth(app, admin.token, "/api/salon-settings", {
      method: "PATCH",
      body: JSON.stringify({ openingTime: "08:00", closingTime: "22:00", intervalMinutes: 30 })
    });
    expect(saved.status).toBe(200);
    const settings = await saved.json() as { data: { openingTime: string; closingTime: string; intervalMinutes: number } };
    expect(settings.data).toMatchObject({ openingTime: "08:00", closingTime: "22:00", intervalMinutes: 30 });

    const date = futureDate(25);
    const booking = await app.fetch(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerName: "Late Client", customerEmail: "late@example.com", customerPhone: "51999999999", bookingDate: date, bookingTime: "22:00", service: "Mãos tradicional" })
    }));
    expect(booking.status).toBe(201);
    const offInterval = await app.fetch(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerName: "Other Client", customerEmail: "other@example.com", customerPhone: "51999999998", bookingDate: futureDate(26), bookingTime: "21:45", service: "Mãos tradicional" })
    }));
    expect(offInterval.status).toBe(400);
  });

  it("blocks duplicate slots using valid customer details", async () => {
    const date = futureDate(21);
    const input = JSON.stringify({customerName:"Test User",customerEmail:"test@example.com",customerPhone:"51999999999",bookingDate:date,bookingTime:"13:00",service:"Mãos tradicional"});
    const first = await app.fetch(new Request("http://localhost/api/bookings",{method:"POST",headers:{"content-type":"application/json"},body:input}));
    expect(first.status).toBe(201);
    const duplicate = await app.fetch(new Request("http://localhost/api/bookings",{method:"POST",headers:{"content-type":"application/json"},body:input}));
    expect(duplicate.status).toBe(409);
  });
  it("allows an admin to cancel a confirmed reservation and releases its slot", async () => {
    const date = futureDate(22);
    const created = await app.fetch(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: "Test User",
        customerEmail: "confirmed@example.com",
        customerPhone: "51999999999",
        bookingDate: date,
        bookingTime: "14:30",
        service: "Mãos tradicional"
      })
    }));
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { data: { id: string } };

    const admin = await signUpAndGetToken(app, { email: "booking-admin@example.com" });
    if (!admin.userId) throw new Error("Admin fixture did not return a user id");
    await executeSql("UPDATE user SET role = 'admin' WHERE id = ?", [admin.userId]);

    const confirmed = await fetchWithAuth(app, admin.token, `/api/bookings/${createdBody.data.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ action: "confirmed" })
    });
    expect(confirmed.status).toBe(200);

    const cancelled = await fetchWithAuth(app, admin.token, `/api/bookings/${createdBody.data.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ action: "cancelled" })
    });
    expect(cancelled.status).toBe(200);

    const list = await app.fetch(new Request(`http://localhost/api/bookings?date=${date}`));
    expect(((await list.json()) as { data: { busyTimes: string[] } }).data.busyTimes).not.toContain("14:30");
  });
  it("rejects oversized admin booking status payloads before processing", async () => {
    const admin = await signUpAndGetToken(app, { email: "booking-payload-admin@example.com" });
    if (!admin.userId) throw new Error("Admin fixture did not return a user id");
    await executeSql("UPDATE user SET role = 'admin' WHERE id = ?", [admin.userId]);

    const body = JSON.stringify({ action: "confirmed", note: "x".repeat(50_000) });
    const res = await fetchWithAuth(app, admin.token, "/api/bookings/booking-test-id/status", {
      method: "PATCH",
      body
    });

    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(50_000);
    expect(res.status).toBe(413);
    const payload = await res.json() as { error?: { code?: string } };
    expect(payload.error?.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects oversized public booking request bodies before processing", async () => {
    const body = JSON.stringify({ payload: "x".repeat(50_000) });
    const res = await app.fetch(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    }));

    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(50_000);
    expect(res.status).toBe(413);
    const payload = await res.json() as { error?: { code?: string } };
    expect(payload.error?.code).toBe("PAYLOAD_TOO_LARGE");
  });

});
