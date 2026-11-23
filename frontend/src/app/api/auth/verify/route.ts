import { sql } from "@/lib/db";
import { currentUser, maskEmail, newCode, publicUser, checkCode } from "@/lib/auth-server";
import { mailEnabled, sendCode } from "@/lib/mail";

export const dynamic = "force-dynamic";

// POST { code }: confirms the signed-in account's email with the 6-digit code.
// POST { resend: true }: sends a new code (at most one a minute).
export async function POST(req: Request) {
  if (!sql) return Response.json({ error: "Accounts are not available on this site" }, { status: 503 });
  const u = await currentUser(req);
  if (!u) return Response.json({ error: "Please sign in" }, { status: 401 });
  if (u.email_verified) return Response.json({ user: publicUser(u) });
  if (!mailEnabled || !u.email) return Response.json({ error: "Email isn't set up on this site, so there is nothing to confirm." }, { status: 503 });
  const body = await req.json().catch(() => ({}));

  if (body.resend) {
    const code = await newCode(u.id, "verify");
    if (!code) return Response.json({ error: "A code was sent less than a minute ago. Check your inbox and spam folder." }, { status: 429 });
    if (!(await sendCode(u.email, u.name, code, "verify"))) return Response.json({ error: "Couldn't send the email. Try again in a minute." }, { status: 502 });
    return Response.json({ sentTo: maskEmail(u.email) });
  }

  const r = await checkCode(u.id, "verify", body.code);
  if (r === "wrong") return Response.json({ error: "That code isn't right. Check the latest email from PickMySeat." }, { status: 400 });
  if (r === "expired") return Response.json({ error: "That code has expired. Send a new one." }, { status: 410 });
  await sql`UPDATE users SET email_verified = true WHERE id = ${u.id}`;
  return Response.json({ user: publicUser({ ...u, email_verified: true }) });
}
