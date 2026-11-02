import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const database = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../_core/db", () => ({
  DatabaseError: class DatabaseError extends Error {},
  executeSql: database.execute
}));

import { bookingsRouter } from "../routes/bookings.route";

function createApp() {
  const app = new Hono({ strict: false });
  app.route("/bookings", bookingsRouter);
  return app;
}

describe("guest booking history access by existing booking code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an invalid booking code without querying the database", async () => {
    const response = await createApp().request("/bookings/guest-access/not-a-code");
    expect(response.status).toBe(400);
    expect(database.execute).not.toHaveBeenCalled();
  });

  it("returns a sanitized booking and loyalty progress for a valid existing code", async () => {
    database.execute.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM bookings WHERE bookingCode")) return { rows: [{
        id: "booking-1", bookingCode: "LET-AB12CD34", bookingDate: "2030-01-02",
        bookingTime: "09:30", service: "Manicure e pedicure", status: "confirmed",
        paymentStatus: "paid", completedAt: "2030-01-02T10:30:00Z", customerEmail: "client@example.com",
        customerPhone: "11999999999"
      }] };
      if (sql.includes("loyalty_settings")) return { rows: [{ enabled: 1 }] };
      if (sql.includes("COUNT(*) AS completedPaid")) return { rows: [{ completedPaid: 3 }] };
      if (sql.includes("loyalty_rewards")) return { rows: [] };
      throw new Error("Unexpected SQL in guest booking lookup test");
    });

    const response = await createApp().request("/bookings/guest-access/let-ab12cd34");
    const body = await response.json() as { data: { booking: Record<string, unknown>; loyalty: { completedPaid: number; bookingsUntilReward: number } } };

    expect(response.status).toBe(200);
    expect(body.data.booking).toMatchObject({
      id: "booking-1", bookingCode: "LET-AB12CD34", service: "Manicure e pedicure",
      status: "confirmed", paymentStatus: "paid"
    });
    expect(body.data.booking).not.toHaveProperty("customerEmail");
    expect(body.data.booking).not.toHaveProperty("customerPhone");
    expect(body.data.loyalty.completedPaid).toBe(3);
    expect(body.data.loyalty.bookingsUntilReward).toBe(5);
    expect(database.execute).toHaveBeenCalledTimes(4);
  });

  it("returns not found when the booking code does not exist", async () => {
    database.execute.mockResolvedValue({ rows: [] });
    const response = await createApp().request("/bookings/guest-access/LET-AB12CD34");
    expect(response.status).toBe(404);
    expect(database.execute).toHaveBeenCalledTimes(1);
  });
});
