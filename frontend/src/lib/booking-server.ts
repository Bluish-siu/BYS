// Server-only booking logic for the website's API routes: checks the request against the live catalogue,
// recalculates the price, and reserves seats atomically so a seat can never be sold twice.
import { randomBytes } from "node:crypto";
import { snacks as menu } from "./data";
import { findTheatre, getMovie, theatreExists } from "./catalog";
import { dbCatalog } from "./catalog-server";
import { grandTotal, layoutFor } from "./price";
import { getShows, soldSeatsFor } from "./shows";
import type { sql as Db } from "./db";

type Sql = NonNullable<typeof Db>;
export const HOLD_MINUTES = 10;
const MAX_SEATS = 10;

export type BookingInput = {
  movieId: string; theatreId: string; city: string; day: number; showId: string; time: string; format: string;
  seats: string[]; snacks: Record<string, number>; total: number;
};

export const newBookingId = (prefix = "PMS") => prefix + randomBytes(4).toString("hex").toUpperCase();
export const showKeyOf = (b: Pick<BookingInput, "movieId" | "showId" | "day">) => `${b.movieId}|${b.showId}|${b.day}`;

type Bad = { ok: false; status: number; error: string; taken?: string[] };
const bad = (error: string, status = 400): Bad => ({ ok: false, status, error });

/** Finds the show on the server, so the time, format and city come from the catalogue rather than the browser. */
export async function findShow(movieId: unknown, theatreId: unknown, day: unknown, showId: unknown) {
  await dbCatalog(); // makes the database catalogue the current one
  if (typeof movieId !== "string" || !getMovie(movieId)) return bad("Unknown movie");
  if (typeof theatreId !== "string" || !theatreExists(theatreId)) return bad("Unknown theatre");
  if (!Number.isInteger(day) || (day as number) < 0 || (day as number) > 6) return bad("Invalid day");
  const theatre = findTheatre(theatreId);
  const show = getShows(movieId, theatre.city, day as number).find((t) => t.theatre.id === theatreId)?.shows.find((s) => s.id === showId);
  if (!show) return bad("This show is no longer available. Please choose another showtime.", 409);
  return { ok: true as const, theatre, show, day: day as number, movieId };
}

/** Returns the clean booking, or an error message. The price is recalculated here and must match what the customer saw. */
export async function checkBooking(body: unknown): Promise<{ ok: true; b: BookingInput } | Bad> {
  const r = (body ?? {}) as Partial<BookingInput>;
  const found = await findShow(r.movieId, r.theatreId, r.day, r.showId);
  if (!found.ok) return found;
  const { theatre, show, day, movieId } = found;
  const seats = r.seats;
  if (!Array.isArray(seats) || seats.length < 1 || seats.length > MAX_SEATS) return bad(`Choose between 1 and ${MAX_SEATS} seats`);
  if (new Set(seats).size !== seats.length) return bad("Duplicate seats");
  const layout = layoutFor({ theatreId: theatre.id });
  if (!seats.every((s) => typeof s === "string" && layout.byId.has(s))) return bad("Some seats don't exist in this theatre");
  const showKey = showKeyOf({ movieId, showId: show.id, day });
  const soldOut = soldSeatsFor(showKey, show.fill, layout.seatIds);
  const gone = seats.filter((s) => soldOut.has(s));
  if (gone.length) return { ok: false, status: 409, error: `Seat ${gone.join(", ")} is already sold`, taken: gone };
  const snacks: Record<string, number> = {};
  for (const [id, q] of Object.entries(r.snacks ?? {})) {
    if (!menu.some((m) => m.id === id) || !Number.isInteger(q) || q < 0 || q > 20) return bad("Invalid snacks");
    if (q > 0) snacks[id] = q;
  }
  const b: BookingInput = { movieId, theatreId: theatre.id, city: theatre.city, day, showId: show.id, time: show.time, format: show.format, seats, snacks, total: 0 };
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
        INSERT INTO bookings (id, movie_id, theatre_id, city, day, show_id, show_key, show_time, format, seats, snacks, total, status, user_id, expires_at)
        VALUES (${id}, ${b.movieId}, ${b.theatreId}, ${b.city}, ${b.day}, ${b.showId}, ${showKey}, ${b.time}, ${b.format},
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
  id: string; movie_id: string; theatre_id: string; city: string; day: number; show_id: string; show_time: string; format: string;
  seats: string[]; snacks: Record<string, number>; total: number; payment_id: string | null; created_at: Date;
};
export const ticketOut = (r: TicketRow) => ({
  id: r.id, total: r.total, at: new Date(r.created_at).getTime(), paymentId: r.payment_id ?? undefined,
  booking: { movieId: r.movie_id, city: r.city, day: r.day, theatreId: r.theatre_id, showId: r.show_id, time: r.show_time, format: r.format, fill: 0, seats: r.seats, snacks: r.snacks },
});
