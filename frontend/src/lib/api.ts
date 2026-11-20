// Talks to the PickMySeat backend (backend/). Set NEXT_PUBLIC_API_URL, e.g. http://localhost:4000/api.
// Without it the site runs on its own (demo mode): seats and tickets live only in this browser.
import type { Booking } from "./store";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
export const apiEnabled = Boolean(API);

export const showKeyOf = (b: Pick<Booking, "movieId" | "showId" | "day">) => `${b.movieId}|${b.showId}|${b.day}`;

/** Seats other customers have already bought for this show. Empty in demo mode or if the API is down. */
export async function fetchBookedSeats(showKey: string): Promise<string[]> {
  if (!API) return [];
  try {
    const r = await fetch(`${API}/shows/${encodeURIComponent(showKey)}/booked-seats`, { cache: "no-store" });
    if (!r.ok) return [];
    return ((await r.json()) as { seats: string[] }).seats;
  } catch {
    return [];
  }
}

export type CreateResult = { ok: true; id: string } | { ok: false; error: string; taken?: string[] };

/** Saves the booking on the server, which reserves the seats or refuses if any were just taken. */
export async function createBooking(b: Booking, total: number): Promise<CreateResult> {
  try {
    const r = await fetch(`${API}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: b.movieId, theatreId: b.theatreId, city: b.city, day: b.day, showId: b.showId, time: b.time, format: b.format, seats: b.seats, snacks: b.snacks, total }),
    });
    const data = await r.json();
    return r.ok ? { ok: true, id: data.id } : { ok: false, error: data.error ?? "Booking failed", taken: data.taken };
  } catch {
    return { ok: false, error: "Can't reach the booking server. Please try again." };
  }
}
