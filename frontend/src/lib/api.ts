// Talks to the booking API: the website's own /api routes (Postgres on Supabase, as on Vercel),
// or the separate backend/ server when NEXT_PUBLIC_API_URL is set, e.g. http://localhost:4000/api.
import type { Booking } from "./store";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
export const apiEnabled = Boolean(API);
const PAY_API = API ?? "/api";

/** Identifies one screening: movie, show and its real date, e.g. ramayana|mum-icon-18:55|2026-11-24. */
export const showKeyOf = (b: Pick<Booking, "movieId" | "showId" | "date">) => `${b.movieId}|${b.showId}|${b.date}`;

/** Seats other customers have already bought, or are paying for, for this show. Empty if the API is down. */
export async function fetchBookedSeats(showKey: string): Promise<string[]> {
  try {
    const r = await fetch(`${PAY_API}/shows/${encodeURIComponent(showKey)}/booked-seats`, { cache: "no-store" });
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
    const r = await fetch(`${PAY_API}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: b.movieId, theatreId: b.theatreId, city: b.city, date: b.date, showId: b.showId, time: b.time, format: b.format, seats: b.seats, snacks: b.snacks, total }),
    });
    const data = await r.json();
    return r.ok ? { ok: true, id: data.id } : { ok: false, error: data.error ?? "Booking failed", taken: data.taken };
  } catch {
    return { ok: false, error: "Can't reach the booking server. Please try again." };
  }
}

// ---------- Razorpay (test mode) ----------

export type PaymentConfig = { razorpay: boolean; keyId: string | null; mode: "test" | "off"; database?: boolean };

export async function fetchPaymentConfig(): Promise<PaymentConfig | null> {
  try {
    const r = await fetch(`${PAY_API}/payments/config`, { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export type PaymentOrder = { bookingId: string; orderId: string; amount: number; currency: string; keyId: string; holdMinutes: number };

const post = async (path: string, body: unknown) => {
  const r = await fetch(`${PAY_API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
};

/** Holds the seats on the server and opens a Razorpay order for the total. */
export async function createPaymentOrder(b: Booking, total: number): Promise<{ ok: true; order: PaymentOrder } | { ok: false; error: string; taken?: string[] }> {
  try {
    const { ok, data } = await post("/payments/order", { movieId: b.movieId, theatreId: b.theatreId, city: b.city, date: b.date, showId: b.showId, time: b.time, format: b.format, seats: b.seats, snacks: b.snacks, total });
    return ok ? { ok: true, order: data } : { ok: false, error: data.error ?? "Couldn't start the payment", taken: data.taken };
  } catch {
    return { ok: false, error: "Can't reach the booking server. Please try again." };
  }
}

export type RazorpayResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

/** Sends Razorpay's signed result to the server, which confirms the booking only if the signature is genuine. */
export async function verifyPayment(res: RazorpayResult): Promise<{ ok: true; id: string; paymentId: string } | { ok: false; error: string }> {
  try {
    const { ok, data } = await post("/payments/verify", res);
    return ok ? { ok: true, id: data.id, paymentId: data.payment_id } : { ok: false, error: data.error ?? "Payment could not be verified" };
  } catch {
    return { ok: false, error: "Payment received, but we couldn't confirm it. Please check My tickets in a minute." };
  }
}

/** Releases the held seats when the customer closes the payment window. */
export async function cancelPayment(orderId: string) {
  try { await post("/payments/cancel", { orderId }); } catch { /* the hold expires on its own */ }
}

let checkoutScript: Promise<boolean> | null = null;
/** Loads Razorpay's official checkout script once. */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return Promise.resolve(true);
  checkoutScript ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => { checkoutScript = null; resolve(false); };
    document.body.appendChild(s);
  });
  return checkoutScript;
}
