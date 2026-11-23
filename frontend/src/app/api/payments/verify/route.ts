import { sql } from "@/lib/db";
import { confirmPaid } from "@/lib/booking-server";
import { razorpay, razorpayKeys, signatureOk } from "@/lib/razorpay-server";

export const dynamic = "force-dynamic";

// Step 2: Razorpay's signed result is checked with the secret key, then the held booking is confirmed.
export async function POST(req: Request) {
  const keys = razorpayKeys();
  if (!keys) return Response.json({ error: "Payments are not set up on this site" }, { status: 503 });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = await req.json().catch(() => ({}));
  if (!orderId || !paymentId || !signature) return Response.json({ error: "Missing payment details" }, { status: 400 });
  if (!signatureOk(keys.secret, orderId, paymentId, signature)) return Response.json({ error: "Payment could not be verified" }, { status: 400 });

  if (sql) {
    const r = await confirmPaid(sql, orderId, paymentId);
    if (!r.ok) return Response.json({ error: r.error }, { status: 410 });
    return Response.json({ id: r.id, payment_id: paymentId, status: "confirmed" });
  }
  try {
    // No database: the booking id was stored as the order's receipt.
    const order = await razorpay<{ receipt: string }>(keys.auth, `/orders/${encodeURIComponent(orderId)}`);
    return Response.json({ id: order.receipt, payment_id: paymentId, status: "confirmed" });
  } catch {
    return Response.json({ error: "Payment received, but we couldn't confirm it. Please check My tickets in a minute." }, { status: 502 });
  }
}
