import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { ticketOut, type TicketRow } from "@/lib/booking-server";
import { istDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

// POST { code }: checks a ticket in at the entrance. `code` is what the QR holds ("PICKMYSEAT|PMS1A2B3C4D|D5,D6"),
// a ticket link, or just the ticket id typed in. Each ticket can be checked in once, on the day of its show.
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const { code, force } = await req.json().catch(() => ({}));
  const id = String(code ?? "").toUpperCase().match(/PMS[0-9A-F]{8}/)?.[0];
  if (!id) return Response.json({ result: "invalid", error: "This isn't a PickMySeat ticket." }, { status: 400 });

  const [b] = await sql!<(TicketRow & { customer: string | null })[]>`
    SELECT b.*, u.name AS customer FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE b.id = ${id}`;
  if (!b || !["confirmed", "cancelled"].includes(b.status)) return Response.json({ result: "invalid", error: `No ticket ${id}.` }, { status: 404 });
  const t = { ...ticketOut(b), customer: b.customer };
  if (b.status === "cancelled") return Response.json({ result: "cancelled", ticket: t, error: "This ticket was cancelled." }, { status: 409 });
  if (b.checked_in_at) return Response.json({ result: "used", ticket: t, error: "Already used." }, { status: 409 });
  // Wrong day: refuse unless the admin taps "Let in anyway".
  if (t.booking.date !== istDate(0) && !force) return Response.json({ result: "wrong-day", ticket: t, error: `This ticket is for ${t.booking.date}, not today.` }, { status: 409 });

  const [done] = await sql!`UPDATE bookings SET checked_in_at = now() WHERE id = ${id} AND status = 'confirmed' AND checked_in_at IS NULL RETURNING checked_in_at`;
  if (!done) return Response.json({ result: "used", ticket: t, error: "Already used." }, { status: 409 });
  return Response.json({ result: "ok", ticket: { ...t, checkedInAt: new Date(done.checked_in_at).getTime() } });
}
