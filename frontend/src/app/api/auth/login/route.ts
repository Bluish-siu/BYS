import { sql } from "@/lib/db";
import { parseLogin, passwordOk, publicUser, sessionCookie, type User } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// Slows down password guessing: at most 10 failed attempts per login per 15 minutes on each server instance.
const fails = new Map<string, { n: number; until: number }>();

export async function POST(req: Request) {
  if (!sql) return Response.json({ error: "Accounts are not available on this site" }, { status: 503 });
  const { login, password } = await req.json().catch(() => ({}));
  const id = parseLogin(login);
  if ("error" in id) return Response.json({ error: id.error }, { status: 400 });
  const key = "email" in id ? id.email : id.phone;
  const f = fails.get(key);
  if (f && f.n >= 10 && f.until > Date.now()) return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });

  const [u] = "email" in id
    ? await sql<(User & { password_hash: string })[]>`SELECT id, name, email, phone, role, password_hash FROM users WHERE email = ${id.email}`
    : await sql<(User & { password_hash: string })[]>`SELECT id, name, email, phone, role, password_hash FROM users WHERE phone = ${id.phone}`;
  if (!u || typeof password !== "string" || !(await passwordOk(password, u.password_hash))) {
    fails.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    return Response.json({ error: "Wrong email/mobile number or password" }, { status: 401 });
  }
  fails.delete(key);
  return Response.json({ user: publicUser(u) }, { headers: { "Set-Cookie": sessionCookie(req, u.id) } });
}
