// Server-only Razorpay helpers for the website's own API routes (src/app/api/payments/*).
// Used on Vercel, where the separate backend/ server is not running.
// Keys come from the RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables. Only test keys are accepted.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const HOLD_MINUTES = 10;

// Values pasted into a dashboard sometimes keep quote marks or spaces: strip them.
const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "").trim() || undefined;

/** Why payments are off, without revealing any key. Null when everything is set up. */
export function keyProblem(): string | null {
  const keyId = clean(process.env.RAZORPAY_KEY_ID);
  const secret = clean(process.env.RAZORPAY_KEY_SECRET);
  if (!keyId && !secret) return "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set for this deployment";
  if (!keyId) return "RAZORPAY_KEY_ID is not set for this deployment";
  if (!secret) return "RAZORPAY_KEY_SECRET is not set for this deployment";
  if (!keyId.startsWith("rzp_test_")) return "RAZORPAY_KEY_ID is not a test key (it must start with rzp_test_)";
  return null;
}

export function razorpayKeys() {
  if (keyProblem()) return null;
  const keyId = clean(process.env.RAZORPAY_KEY_ID)!;
  const secret = clean(process.env.RAZORPAY_KEY_SECRET)!;
  return { keyId, secret, auth: "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64") };
}

export const newBookingId = () => "PMS" + randomBytes(4).toString("hex").toUpperCase();

export function signatureOk(secret: string, orderId: string, paymentId: string, signature: string) {
  const expected = Buffer.from(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"));
  const given = Buffer.from(String(signature ?? ""));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function razorpay<T>(auth: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.description ?? `Razorpay error ${r.status}`);
  return data as T;
}
