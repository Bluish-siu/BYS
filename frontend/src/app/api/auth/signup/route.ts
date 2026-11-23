import { sql } from "@/lib/db";
import { hashPassword, newCode, parseLogin, publicUser, sessionCookie, type User } from "@/lib/auth-server";
import { mailEnabled, sendCode } from "@/lib/mail";

export const dynamic = "force-dynamic";

// Creates an account: name, email (required, so codes can be sent), mobile number (optional) and password.
// When e-mail is set up, a 6-digit code is sent to confirm the address; tickets can be bought once it is confirmed.
export async function POST(req: Request) {
  if (!sql) return Response.json({ error: "Accounts are not available on this site" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return Response.json({ error: "Enter your name" }, { status: 400 });
  const e = parseLogin(body.email);
  if (!("email" in e)) return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  let phone: string | null = null;
  if (String(body.phone ?? "").trim()) {
    const p = parseLogin(body.phone);
    if (!("phone" in p)) return Response.json({ error: "Enter a valid 10-digit mobile number, or leave it empty" }, { status: 400 });
    phone = p.phone;
  }
  const password = body.password;
  if (typeof password !== "string" || password.length < 8 || password.length > 100)
    return Response.json({ error: "Use a password of at least 8 characters" }, { status: 400 });

  let u: User;
  try {
    [u] = await sql<User[]>`INSERT INTO users (name, email, phone, password_hash)
                            VALUES (${name}, ${e.email}, ${phone}, ${await hashPassword(password)})
                            RETURNING id, name, email, phone, role, email_verified, session_version`;
  } catch (err) {
    if ((err as { code?: string; constraint_name?: string }).code === "23505") {
      const which = (err as { constraint_name?: string }).constraint_name?.includes("phone") ? "mobile number" : "email";
      return Response.json({ error: `An account with this ${which} already exists. Sign in instead.` }, { status: 409 });
    }
    throw err;
  }
  let verify = false;
  if (mailEnabled) {
    const code = await newCode(u.id, "verify");
    verify = Boolean(code && (await sendCode(e.email, name, code, "verify")));
  }
  return Response.json({ user: publicUser(u), verify, verifyRequired: mailEnabled }, { status: 201, headers: { "Set-Cookie": sessionCookie(req, u) } });
}
