import { findTheatre } from "@/lib/catalog";
import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { HOLD_MINUTES, badResponse, checkBooking, newBookingId, reserve, takenResponse } from "@/lib/booking-server";
import { razorpay, razorpayKeys } from "@/lib/razorpay-server";

export const dynamic = "force-dynamic";

// Step 1: check the booking, recalculate the price, hold the seats for 10 minutes, then create a Razorpay order.
export async function POST(req: Request) {
  const keys = razorpayKeys();
  if (!keys) return Response.json({ error: "Payments are not set up on this site" }, { status: 503 });
  // With a database, tickets belong to an account, so the customer must be signed in.
  const user = sql ? await currentUser(req) : null;
  if (sql && !user) return Response.json({ error: "Please sign in to book tickets" }, { status: 401 });
  const c = await checkBooking(await req.json().catch(() => null));
  if (!c.ok) return badResponse(c);
  const b = c.b;

  // Hold the seats first, so two people can never pay for the same seat.
  let bookingId = newBookingId();
  if (sql) {
    const held = await reserve(sql, b, "pending", user!.id);
    if (!held.ok) return takenResponse(held.taken);
    bookingId = held.id;
  }

  try {
    const order = await razorpay<{ id: string; amount: number; currency: string }>(keys.auth, "/orders", {
      amount: b.total * 100, // paise, from the server's own price calculation
      currency: "INR",
      receipt: bookingId,
      notes: { booking: bookingId, movie: b.movieId, theatre: findTheatre(b.theatreId).name, show: `${b.showId} day ${b.day}`, seats: b.seats.join(" ") },
    });
    if (sql) await sql`UPDATE bookings SET payment_order_id = ${order.id} WHERE id = ${bookingId}`;
    return Response.json({ bookingId, orderId: order.id, amount: order.amount, currency: order.currency, keyId: keys.keyId, holdMinutes: HOLD_MINUTES }, { status: 201 });
  } catch (e) {
    if (sql) await sql`DELETE FROM bookings WHERE id = ${bookingId} AND status = 'pending'`; // release the seats again
    console.error("Razorpay order failed:", (e as Error).message);
    return Response.json({ error: "Couldn't start the payment. Please try again." }, { status: 502 });
  }
}
