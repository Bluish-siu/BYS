import { sql } from "@/lib/db";
import { expireHolds } from "@/lib/booking-server";

export const dynamic = "force-dynamic";

// Seats other customers have bought, or are paying for right now, for one show.
export async function GET(_req: Request, { params }: { params: { showKey: string } }) {
  const showKey = decodeURIComponent(params.showKey);
  if (!sql) return Response.json({ showKey, seats: [] });
  try {
    await expireHolds(sql);
    const rows = await sql`SELECT seat_id FROM booked_seats WHERE show_key = ${showKey}`;
    return Response.json({ showKey, seats: rows.map((r) => r.seat_id) });
  } catch (e) {
    console.error("booked-seats failed:", (e as Error).message);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
