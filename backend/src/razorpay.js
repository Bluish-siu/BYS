// Minimal Razorpay client: create orders and verify payment signatures.
// Only test keys (rzp_test_...) are accepted, so this project can never take real money by accident.
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifySignature(secret, orderId, paymentId, signature) {
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(String(signature ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function razorpayFromEnv(env = process.env) {
  const keyId = env.RAZORPAY_KEY_ID?.trim(), secret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !secret) return null;
  if (!keyId.startsWith("rzp_test_")) {
    console.error("RAZORPAY_KEY_ID is not a test key (rzp_test_...). Razorpay is disabled.");
    return null;
  }
  const auth = "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64");
  return {
    keyId,
    async createOrder({ amount, receipt, notes }) {
      const r = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, currency: "INR", receipt, notes }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error?.description ?? `Razorpay error ${r.status}`);
      return data; // { id: "order_...", amount, currency, ... }
    },
    verify: (orderId, paymentId, signature) => verifySignature(secret, orderId, paymentId, signature),
  };
}
