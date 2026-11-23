import { sql } from "@/lib/db";
import { findUser, hashPassword, parseLogin, publicUser, sessionCookie, checkCode, type User } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// POST { login, code, password }: sets a new password with the e-mailed code, signs out every other device,
// and signs in here. Using the code also proves the email address belongs to the customer.
export async function POST(req: Request) {
  if (!sql) return Response.json({ error: "Accounts are not available on this site" }, { status: 503 });
  const { login, code, password } = await req.json().catch(() => ({}));
  const id = parseLogin(login);
  if ("error" in id) return Response.json({ error: id.error }, { status: 400 });
  if (typeof password !== "string" || password.length < 8 || password.length > 100)
    return Response.json({ error: "Use a password of at least 8 characters" }, { status: 400 });
  const found = await findUser(id);
  const r = found ? await checkCode(found.id, "reset", code) : "wrong";
  if (r === "wrong") return Response.json({ error: "That code isn't right. Check the latest email from PickMySeat." }, { status: 400 });
  if (r === "expired") return Response.json({ error: "That code has expired. Ask for a new one." }, { status: 410 });
  const [u] = await sql<User[]>`UPDATE users SET password_hash = ${await hashPassword(password)}, session_version = session_version + 1, email_verified = true
                                WHERE id = ${found!.id} RETURNING id, name, email, phone, role, email_verified, session_version`;
  return Response.json({ user: publicUser(u) }, { headers: { "Set-Cookie": sessionCookie(req, u) } });
}
