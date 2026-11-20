import { getMovie, findTheatre } from "@/lib/data";
import { HOLD_MINUTES, newBookingId, razorpay, razorpayKeys } from "@/lib/razorpay-server";

export const dynamic = "force-dynamic";

type Body = { movieId?: string; theatreId?: string; showId?: string; day?: number; seats?: string[]; total?: number };

// Step 1: create a Razorpay order for the booking total. The booking id travels as the order's receipt.
export async function POST(req: Request) {
  const keys = razorpayKeys();
  if (!keys) return Response.json({ error: "Payments are not set up on this site" }, { status: 503 });
  const b = (await req.json().catch(() => ({}))) as Body;
  const seats = Array.isArray(b.seats) ? b.seats : [];
  if (!b.movieId || !getMovie(b.movieId)) return Response.json({ error: "Unknown movie" }, { status: 400 });
  if (!seats.length || seats.length > 10 || !seats.every((s) => /^[A-Z]{1,2}\d{1,3}$/.test(s))) return Response.json({ error: "Choose between 1 and 10 valid seats" }, { status: 400 });
  if (!Number.isInteger(b.total) || (b.total as number) <= 0 || (b.total as number) > 500_000) return Response.json({ error: "Invalid total" }, { status: 400 });

  const bookingId = newBookingId();
  try {
    const order = await razorpay<{ id: string; amount: number; currency: string }>(keys.auth, "/orders", {
      amount: (b.total as number) * 100, // paise
      currency: "INR",
      receipt: bookingId,
      notes: { booking: bookingId, movie: b.movieId, theatre: findTheatre(b.theatreId ?? "").name, show: `${b.showId ?? ""} day ${b.day ?? 0}`, seats: seats.join(" ") },
    });
    return Response.json({ bookingId, orderId: order.id, amount: order.amount, currency: order.currency, keyId: keys.keyId, holdMinutes: HOLD_MINUTES }, { status: 201 });
  } catch (e) {
    console.error("Razorpay order failed:", (e as Error).message);
    return Response.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
