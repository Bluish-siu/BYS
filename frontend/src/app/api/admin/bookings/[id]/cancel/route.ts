import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { cancelBooking } from "@/lib/booking-server";

export const dynamic = "force-dynamic";

// An admin cancels any confirmed booking (show cancelled, double charge, complaint...) with a full refund.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const [b] = await sql!`SELECT total FROM bookings WHERE id = ${params.id} AND status = 'confirmed'`;
  if (!b) return Response.json({ error: "No confirmed booking with this id" }, { status: 404 });
  const r = await cancelBooking(sql!, params.id, "admin", b.total);
  return r.ok ? Response.json(r) : Response.json({ error: r.error }, { status: r.status });
}
