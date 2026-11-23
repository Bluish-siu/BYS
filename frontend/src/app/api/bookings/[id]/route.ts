import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { ticketOut, type TicketRow } from "@/lib/booking-server";

export const dynamic = "force-dynamic";

// One ticket by its id, so a shared ticket link opens on any phone. Ticket ids are random (PMS + 8 hex
// characters), so they can't be guessed. "mine" tells the page whether to offer Cancel.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!sql) return Response.json({ error: "Bookings are not stored on this site" }, { status: 503 });
  if (!/^PMS[0-9A-F]{8}$/.test(params.id)) return Response.json({ error: "Booking not found" }, { status: 404 });
  const [b] = await sql<TicketRow[]>`SELECT * FROM bookings WHERE id = ${params.id} AND status IN ('confirmed', 'cancelled')`;
  if (!b) return Response.json({ error: "Booking not found" }, { status: 404 });
  const user = await currentUser(req).catch(() => null);
  return Response.json({ ...ticketOut(b), mine: Boolean(user && b.user_id === user.id) });
}
