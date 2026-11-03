import { executeSql } from "../_core/db";

/**
 * Remove booking records older than six months only when they are in the past
 * and unpaid. Paid bookings are deliberately retained because the finance and
 * loyalty features calculate historical totals from these rows.
 */
export async function runBookingRetentionCleanup() {
  const result = await executeSql(
    "DELETE FROM bookings WHERE bookingDate < date('now', '-6 months') AND bookingDate < date('now') AND paymentStatus != 'paid'"
  );
  const removed = Number(result.rowsAffected ?? 0);
  if (removed > 0) {
    console.info(`[booking-retention] Removed ${removed} old unpaid bookings`);
  }
  return removed;
}

/**
 * The Render Node server is long-lived. Run once after startup and then daily.
 * The task is idempotent, so repeated execution does not affect active bookings.
 */
export function startBookingRetentionScheduler() {
  const run = () => {
    void runBookingRetentionCleanup().catch((error) => {
      console.error("[booking-retention] Cleanup failed; will retry on next schedule", error);
    });
  };
  const startupDelay = setTimeout(run, 30_000);
  const dailyInterval = setInterval(run, 24 * 60 * 60 * 1000);
  startupDelay.unref?.();
  dailyInterval.unref?.();
}
