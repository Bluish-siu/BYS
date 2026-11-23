import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { findShow, reserve, showKeyOf, takenResponse } from "@/lib/booking-server";
import { layoutFor } from "@/lib/price";

export const dynamic = "force-dynamic";

// GET ?showKey=: seats blocked by an admin for one show (each block can be released on its own).
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const showKey = new URL(req.url).searchParams.get("showKey") ?? "";
  const rows = await sql!`SELECT id, seats, created_at FROM bookings WHERE show_key = ${showKey} AND status = 'blocked' ORDER BY created_at`;
  return Response.json({ blocks: rows });
}

// POST { movieId, theatreId, date, showId, seats }: takes seats off sale for that show (house seats, broken seats, VIPs).
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const body = await req.json().catch(() => ({}));
  const found = await findShow(body.movieId, body.theatreId, body.date, body.showId);
  if (!found.ok) return Response.json({ error: found.error }, { status: found.status });
  const { theatre, show, date, movieId } = found;
  const layout = layoutFor({ theatreId: theatre.id });
  const seats: string[] = Array.isArray(body.seats) ? [...new Set<string>(body.seats.map(String))] : [];
  if (!seats.length || seats.length > 100 || !seats.every((s) => layout.byId.has(s))) return Response.json({ error: "Pick seats that exist in this theatre" }, { status: 400 });
  const r = await reserve(sql!, { movieId, theatreId: theatre.id, city: theatre.city, date, showId: show.id, time: show.time, format: show.format, seats, snacks: {}, total: 0 }, "blocked", a.user.id);
  if (!r.ok) return takenResponse(r.taken);
  return Response.json({ ok: true, id: r.id, showKey: showKeyOf({ movieId, showId: show.id, date }) });
}

// DELETE ?id=BLK...: puts those seats back on sale.
export async function DELETE(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  await sql!`DELETE FROM bookings WHERE id = ${new URL(req.url).searchParams.get("id") ?? ""} AND status = 'blocked'`;
  return Response.json({ ok: true });
}
