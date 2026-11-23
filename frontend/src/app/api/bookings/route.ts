import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { badResponse, checkBooking, reserve, takenResponse } from "@/lib/booking-server";
import { razorpayKeys } from "@/lib/razorpay-server";

export const dynamic = "force-dynamic";

// Books seats without a payment (demo mode, only when Razorpay is not set up).
export async function POST(req: Request) {
  if (!sql) return Response.json({ error: "Bookings are not stored on this site" }, { status: 503 });
  if (razorpayKeys()) return Response.json({ error: "Payment required. Use /api/payments/order." }, { status: 403 });
  const user = await currentUser(req);
  if (!user) return Response.json({ error: "Please sign in to book tickets" }, { status: 401 });
  const c = await checkBooking(await req.json().catch(() => null));
  if (!c.ok) return badResponse(c);
  const r = await reserve(sql, c.b, "confirmed", user.id);
  return r.ok ? Response.json({ id: r.id, total: c.b.total, status: "confirmed" }, { status: 201 }) : takenResponse(r.taken);
}
