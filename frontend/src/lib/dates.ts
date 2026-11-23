// Show dates and times in India Standard Time (UTC+5:30), the same on every phone and on the server.
// A show is identified by its real date ("2026-11-24"), never by "days from today", so a booking made
// tonight for tomorrow still matches the same show after midnight.

const IST_MS = 330 * 60_000;
export const BOOKING_DAYS = 5; // dates customers can pick: today + 4

/** Today's date in India, or `plus` days later, as YYYY-MM-DD. */
export function istDate(plus = 0, now = Date.now()) {
  const d = new Date(now + IST_MS);
  d.setUTCDate(d.getUTCDate() + plus);
  return d.toISOString().slice(0, 10);
}

/** Minutes since midnight, India time. */
export function istMinutes(now = Date.now()) {
  const d = new Date(now + IST_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The dates on sale right now: today and the next few days. */
export const bookableDates = (now = Date.now()) => Array.from({ length: BOOKING_DAYS }, (_, i) => istDate(i, now));

/** "Tue, 24 Nov", with "Today" and "Tomorrow" when `relative` is set. */
export function dateLabel(date: string, relative = false, now = Date.now()) {
  if (relative && date === istDate(0, now)) return "Today";
  if (relative && date === istDate(1, now)) return "Tomorrow";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** True once a show starting at HH:MM on that date has begun (India time). Past dates are always started. */
export function hasStarted(date: string, start: string, now = Date.now()) {
  const today = istDate(0, now);
  if (date !== today) return date < today;
  const [h, m] = start.split(":").map(Number);
  return h * 60 + m <= istMinutes(now);
}
