import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// The customer closed the payment window: release the held seats.
export async function POST(req: Request) {
  const { orderId } = await req.json().catch(() => ({}));
  if (!sql || typeof orderId !== "string" || !orderId) return Response.json({ released: false });
  const gone = await sql`DELETE FROM bookings WHERE payment_order_id = ${orderId} AND status = 'pending' RETURNING id`;
  return Response.json({ released: gone.length > 0 });
}
