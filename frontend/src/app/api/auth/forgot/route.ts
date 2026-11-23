import { sql } from "@/lib/db";
import { findUser, maskEmail, newCode, parseLogin } from "@/lib/auth-server";
import { mailEnabled, sendCode } from "@/lib/mail";

export const dynamic = "force-dynamic";

// POST { login }: e-mails a password-reset code to the account's email address.
// The answer is the same whether or not the account exists, so this can't be used to find out who has an account.
export async function POST(req: Request) {
  if (!sql) return Response.json({ error: "Accounts are not available on this site" }, { status: 503 });
  if (!mailEnabled) return Response.json({ mail: false });
  const { login } = await req.json().catch(() => ({}));
  const id = parseLogin(login);
  if ("error" in id) return Response.json({ error: id.error }, { status: 400 });
  const u = await findUser(id);
  if (u?.email) {
    const code = await newCode(u.id, "reset");
    if (code) await sendCode(u.email, u.name, code, "reset");
  }
  return Response.json({ mail: true, sentTo: u?.email ? maskEmail(u.email) : null });
}
