import { keyProblem, razorpayKeys } from "@/lib/razorpay-server";

export const dynamic = "force-dynamic";

// Tells the pay page whether Razorpay test mode is set up on this deployment, and if not, why (never the keys themselves).
export function GET() {
  const keys = razorpayKeys();
  return Response.json({
    razorpay: Boolean(keys),
    keyId: keys?.keyId ?? null,
    mode: keys ? "test" : "off",
    ...(keys ? {} : { reason: keyProblem(), env: process.env.VERCEL_ENV ?? "local" }),
  });
}
