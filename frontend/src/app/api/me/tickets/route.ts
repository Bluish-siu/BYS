import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { ticketOut, type TicketRow } from "@/lib/booking-server";

export const dynamic = "force-dynamic";

// Every ticket bought by the signed-in account, newest first, on any device.
export async function GET(req: Request) {
  if (!sql) return Response.json({ tickets: [] });
  const u = await currentUser(req);
  if (!u) return Response.json({ error: "Please sign in" }, { status: 401 });
  const rows = await sql<TicketRow[]>`SELECT * FROM bookings WHERE user_id = ${u.id} AND status IN ('confirmed', 'cancelled') ORDER BY created_at DESC LIMIT 200`;
  return Response.json({ tickets: rows.map(ticketOut) });
}
