// Server-only booking logic for the website's API routes: checks the request against the live catalogue,
// recalculates the price, and reserves seats atomically so a seat can never be sold twice.
import { randomBytes } from "node:crypto";
import { findTheatre, getMovie, snackMenu, theatreExists } from "./catalog";
import { dbCatalog } from "./catalog-server";
import { grandTotal, layoutFor } from "./price";
import { refundPayment } from "./razorpay-server";
import { demoSold, getShows } from "./shows";
import { bookableDates, isDate } from "./dates";
import type { sql as Db } from "./db";

type Sql = NonNullable<typeof Db>;
export const HOLD_MINUTES = 10;
const MAX_SEATS = 10;

export type BookingInput = {
  movieId: string; theatreId: string; city: string; date: string; showId: string; time: string; format: string;
  seats: string[]; snacks: Record<string, number>; total: number;
};

export const newBookingId = (prefix = "PMS") => prefix + randomBytes(4).toString("hex").toUpperCase();
export const showKeyOf = (b: Pick<BookingInput, "movieId" | "showId" | "date">) => `${b.movieId}|${b.showId}|${b.date}`;

type Bad = { ok: false; status: number; error: string; taken?: string[] };
const bad = (error: string, status = 400): Bad => ({ ok: false, status, error });

/** Finds the show on the server, so the time, format and city come from the catalogue rather than the browser. */
export async function findShow(movieId: unknown, theatreId: unknown, date: unknown, showId: unknown) {
  await dbCatalog(); // makes the database catalogue the current one
  if (typeof movieId !== "string" || !getMovie(movieId)) return bad("Unknown movie");
  if (typeof theatreId !== "string" || !theatreExists(theatreId)) return bad("Unknown theatre");
  if (!isDate(date)) return bad("Invalid date");
  // Only today and the next few days (India time) are on sale.
  if (!bookableDates().includes(date)) return bad("Tickets for this date aren't on sale. Please choose another day.", 409);
  const theatre = findTheatre(theatreId);
  const all = getShows(movieId, theatre.city, date, { includeStarted: true }).find((t) => t.theatre.id === theatreId)?.shows ?? [];
  const show = all.find((s) => s.id === showId);
  if (!show) return bad("This show is no longer available. Please choose another showtime.", 409);
  const upcoming = getShows(movieId, theatre.city, date).find((t) => t.theatre.id === theatreId)?.shows ?? [];
  if (!upcoming.some((s) => s.id === showId)) return bad(`The ${show.time} show has already started. Please choose a later show.`, 409);
  return { ok: true as const, theatre, show, date, movieId };
}

/** Returns the clean booking, or an error message. The price is recalculated here and must match what the customer saw. */
export async function checkBooking(body: unknown): Promise<{ ok: true; b: BookingInput } | Bad> {
  const r = (body ?? {}) as Partial<BookingInput>;
  const found = await findShow(r.movieId, r.theatreId, r.date, r.showId);
  if (!found.ok) return found;
  const { theatre, show, date, movieId } = found;
  const seats = r.seats;
  if (!Array.isArray(seats) || seats.length < 1 || seats.length > MAX_SEATS) return bad(`Choose between 1 and ${MAX_SEATS} seats`);
  if (new Set(seats).size !== seats.length) return bad("Duplicate seats");
  const layout = layoutFor({ theatreId: theatre.id });
  if (!seats.every((s) => typeof s === "string" && layout.byId.has(s))) return bad("Some seats don't exist in this theatre");
  const showKey = showKeyOf({ movieId, showId: show.id, date });
  const soldOut = demoSold(showKey, show.fill, layout.seatIds);
  const gone = seats.filter((s) => soldOut.has(s));
  if (gone.length) return { ok: false, status: 409, error: `Seat ${gone.join(", ")} is already sold`, taken: gone };
  const snacks: Record<string, number> = {};
  for (const [id, q] of Object.entries(r.snacks ?? {})) {
    if (!snackMenu().some((m) => m.id === id) || !Number.isInteger(q) || q < 0 || q > 20) return bad("Invalid snacks");
    if (q > 0) snacks[id] = q;
  }
  const b: BookingInput = { movieId, theatreId: theatre.id, city: theatre.city, date, showId: show.id, time: show.time, format: show.format, seats, snacks, total: 0 };
  b.total = grandTotal(b);
  // The browser shows a total too. If it differs, someone changed the price in the browser, or prices changed meanwhile.
  if (r.total !== b.total) return bad(`The price has changed to ₹${b.total}. Please review your booking.`, 409);
  return { ok: true, b };
}

/** Deletes seat holds whose payment window has passed, which frees their seats. */
export const expireHolds = (sql: Sql) => sql`DELETE FROM bookings WHERE status = 'pending' AND expires_at < now()`;

type Status = "pending" | "confirmed" | "blocked";

/**
 * Reserves the seats atomically. "pending" holds them for HOLD_MINUTES while the customer pays;
 * "blocked" takes them off sale (admin). Returns the seats someone else already has if there is a clash, and then nothing is saved.
 */
export async function reserve(sql: Sql, b: BookingInput, status: Status, userId: string | null = null): Promise<{ ok: true; id: string } | { ok: false; taken: string[] }> {
  await expireHolds(sql);
  const id = newBookingId(status === "blocked" ? "BLK" : "PMS");
  const showKey = showKeyOf(b);
  const holdMinutes = status === "pending" ? HOLD_MINUTES : null;
  try {
    // One statement inserts the booking and all its seats, so it runs as one transaction: if any seat is
    // already taken, the primary key on (show_key, seat_id) fails the whole statement and nothing is saved.
    // If two customers race for a seat, Postgres makes the second wait for the first, then refuses it.
    await sql`
      WITH booking AS (
        INSERT INTO bookings (id, movie_id, theatre_id, city, show_date, show_id, show_key, show_time, format, seats, snacks, total, status, user_id, expires_at)
        VALUES (${id}, ${b.movieId}, ${b.theatreId}, ${b.city}, ${b.date}::date, ${b.showId}, ${showKey}, ${b.time}, ${b.format},
                ${sql.json(b.seats)}, ${sql.json(b.snacks)}, ${b.total}, ${status}, ${userId},
                now() + make_interval(mins => ${holdMinutes}::int))
        RETURNING id
      )
      INSERT INTO booked_seats (show_key, seat_id, booking_id)
      SELECT ${showKey}, seat, booking.id FROM booking, unnest(${sql.array(b.seats)}::text[]) AS seat`;
  } catch (e) {
    if ((e as { code?: string }).code !== "23505") throw e; // 23505 = unique violation: a seat is taken
    const rows = await sql`SELECT seat_id FROM booked_seats WHERE show_key = ${showKey} AND seat_id = ANY(${sql.array(b.seats)}::text[])`;
    return { ok: false, taken: rows.length ? rows.map((r) => r.seat_id as string) : b.seats };
  }
  return { ok: true, id };
}

export const badResponse = (c: Bad) => Response.json({ error: c.error, taken: c.taken }, { status: c.status });

export const takenResponse = (taken: string[]) =>
  Response.json({ error: "Some seats were just booked by someone else", taken }, { status: 409 });

/** A booking row as the ticket pages use it. */
export type TicketRow = {
  id: string; movie_id: string; theatre_id: string; city: string; show_date: string | Date; show_id: string; show_time: string; format: string;
  seats: string[]; snacks: Record<string, number>; total: number; payment_id: string | null; created_at: Date; status: string;
  user_id: string | null; checked_in_at: Date | null; cancelled_at: Date | null; cancelled_by: string | null; refund_id: string | null; refund_amount: number | null;
};
const ms = (d: Date | null) => (d ? new Date(d).getTime() : undefined);
export const ticketOut = (r: TicketRow) => ({
  id: r.id, total: r.total, at: new Date(r.created_at).getTime(), paymentId: r.payment_id ?? undefined,
  status: r.status as "confirmed" | "cancelled", checkedInAt: ms(r.checked_in_at), cancelledAt: ms(r.cancelled_at),
  refundAmount: r.refund_amount ?? undefined, refundId: r.refund_id ?? undefined,
  booking: { movieId: r.movie_id, city: r.city, date: new Date(r.show_date).toISOString().slice(0, 10), theatreId: r.theatre_id, showId: r.show_id, time: r.show_time, format: r.format, fill: 0, seats: r.seats, snacks: r.snacks },
});

// ---------- Cancellation and refunds ----------

/** Customers can cancel until this many minutes before the show starts. */
export const CANCEL_UNTIL_MIN = 30;

/** When a show starts, from its date (YYYY-MM-DD) and its label ("07:00 PM"), in India time. */
export function showStartMs(date: string, label: string) {
  const m = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const [y, mo, d] = date.split("-").map(Number);
  if (!m || !y) return NaN;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0);
  return Date.UTC(y, mo - 1, d, h, Number(m[2])) - 330 * 60_000;
}

/**
 * Cancels a confirmed booking: refunds `refund` rupees through Razorpay (test mode) when it was paid online,
 * then frees its seats. The booking is claimed first, so two cancel taps can't refund twice.
 * If Razorpay refuses the refund, nothing changes.
 */
export async function cancelBooking(sql: Sql, id: string, by: "customer" | "admin", refund: number):
  Promise<{ ok: true; refundAmount: number; refundId: string | null } | { ok: false; status: number; error: string }> {
  const [b] = await sql`UPDATE bookings SET cancelled_at = now(), cancelled_by = ${by}
                        WHERE id = ${id} AND status = 'confirmed' AND cancelled_at IS NULL RETURNING payment_id`;
  if (!b) return { ok: false, status: 409, error: "This ticket is already cancelled, or is being cancelled." };
  let refundId: string | null = null;
  const amount = b.payment_id ? Math.max(0, refund) : 0;
  if (b.payment_id && amount > 0) {
    try {
      refundId = await refundPayment(b.payment_id, amount, { booking: id, by });
    } catch (e) {
      await sql`UPDATE bookings SET cancelled_at = NULL, cancelled_by = NULL WHERE id = ${id}`;
      return { ok: false, status: 502, error: `Razorpay couldn't refund this payment: ${(e as Error).message}` };
    }
  }
  await sql`WITH b AS (UPDATE bookings SET status = 'cancelled', refund_id = ${refundId}, refund_amount = ${amount} WHERE id = ${id} RETURNING id)
            DELETE FROM booked_seats WHERE booking_id IN (SELECT id FROM b)`;
  return { ok: true, refundAmount: amount, refundId };
}

/**
 * Marks a held booking as paid once Razorpay's signature has been checked. Used by both the in-page
 * handler (/payments/verify) and the redirect flow (/payments/callback, used inside the Android app).
 */
export async function confirmPaid(sql: Sql, orderId: string, paymentId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const [b] = await sql`UPDATE bookings SET status = 'confirmed', payment_id = ${paymentId}, expires_at = NULL
                        WHERE payment_order_id = ${orderId} AND status IN ('pending', 'confirmed') RETURNING id`;
  return b ? { ok: true, id: b.id } : { ok: false, error: "Your seat hold expired before the payment finished. Any amount debited will be refunded." };
}
