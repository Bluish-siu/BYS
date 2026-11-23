import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { CANCEL_UNTIL_MIN, cancelBooking, showStartMs, ticketOut, type TicketRow } from "@/lib/booking-server";
import { FEE } from "@/lib/price";

export const dynamic = "force-dynamic";

// A customer cancels their own ticket, up to 30 minutes before the show. The ticket price and snacks are
// refunded to the original payment method; the ₹30 convenience fee is not.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!sql) return Response.json({ error: "Bookings are not stored on this site" }, { status: 503 });
  const user = await currentUser(req);
  if (!user) return Response.json({ error: "Please sign in to cancel a ticket" }, { status: 401 });
  const [b] = await sql<TicketRow[]>`SELECT * FROM bookings WHERE id = ${params.id}`;
  if (!b || b.user_id !== user.id) return Response.json({ error: "This isn't one of your tickets" }, { status: 404 });
  if (b.status !== "confirmed") return Response.json({ error: "This ticket is already cancelled" }, { status: 409 });
  if (b.checked_in_at) return Response.json({ error: "This ticket was already used at the entrance" }, { status: 409 });
  const t = ticketOut(b);
  if (Date.now() > showStartMs(t.booking.date, t.booking.time) - CANCEL_UNTIL_MIN * 60_000)
    return Response.json({ error: `Tickets can be cancelled until ${CANCEL_UNTIL_MIN} minutes before the show.` }, { status: 409 });

  const r = await cancelBooking(sql, b.id, "customer", b.total - FEE);
  return r.ok ? Response.json(r) : Response.json({ error: r.error }, { status: r.status });
}
