import { sql } from "@/lib/db";
import { confirmPaid } from "@/lib/booking-server";
import { razorpay, razorpayKeys, signatureOk } from "@/lib/razorpay-server";

export const dynamic = "force-dynamic";

// Razorpay's redirect flow, used inside the Android app: after paying, Razorpay posts the signed result
// to this page (a normal form post), so no popup window has to report back. We check the signature,
// confirm the booking, then send the customer to their ticket, or back to the pay page with the reason.
export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const go = (path: string) => Response.redirect(new URL(path, origin), 303);
  const fail = (why: string) => go(`/book/pay?failed=${encodeURIComponent(why)}`);
  const keys = razorpayKeys();
  const form = await req.formData().catch(() => null);
  if (!keys || !form) return fail("Payment could not be completed. Please try again.");

  const paymentId = String(form.get("razorpay_payment_id") ?? "");
  const orderId = String(form.get("razorpay_order_id") ?? "");
  const signature = String(form.get("razorpay_signature") ?? "");
  if (!paymentId) {
    // Failed payment: release the seats held for it so the customer can try again straight away.
    try {
      const meta = JSON.parse(String(form.get("error[metadata]") ?? "{}")) as { order_id?: string };
      if (sql && meta.order_id) await sql`DELETE FROM bookings WHERE payment_order_id = ${meta.order_id} AND status = 'pending'`;
    } catch { /* the hold expires on its own */ }
    return fail(String(form.get("error[description]") ?? "Payment failed. No money was taken."));
  }
  if (!orderId || !signatureOk(keys.secret, orderId, paymentId, signature)) return fail("Payment could not be verified.");

  if (sql) {
    const r = await confirmPaid(sql, orderId, paymentId);
    return r.ok ? go(`/ticket/${r.id}?paid=1`) : fail(r.error);
  }
  try {
    const order = await razorpay<{ receipt: string }>(keys.auth, `/orders/${encodeURIComponent(orderId)}`);
    return go(`/ticket/${order.receipt}?paid=1`);
  } catch {
    return fail("Payment received, but we couldn't confirm it. Please check My tickets in a minute.");
  }
}

// Some failures come back as a GET with no data: send the customer back to try again.
export function GET(req: Request) {
  return Response.redirect(new URL("/book/pay?failed=" + encodeURIComponent("Payment was not completed."), new URL(req.url).origin), 303);
}
