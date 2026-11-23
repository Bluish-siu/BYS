import { sql } from "@/lib/db";
import { hashPassword, parseLogin, publicUser, sessionCookie, type User } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// Creates an account with a name, an email or mobile number, and a password, then signs it in.
export async function POST(req: Request) {
  if (!sql) return Response.json({ error: "Accounts are not available on this site" }, { status: 503 });
  const { name, login, password } = await req.json().catch(() => ({}));
  const cleanName = String(name ?? "").trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 60) return Response.json({ error: "Enter your name" }, { status: 400 });
  const id = parseLogin(login);
  if ("error" in id) return Response.json({ error: id.error }, { status: 400 });
  if (typeof password !== "string" || password.length < 8 || password.length > 100)
    return Response.json({ error: "Use a password of at least 8 characters" }, { status: 400 });

  const email = "email" in id ? id.email : null;
  const phone = "phone" in id ? id.phone : null;
  try {
    const [u] = await sql<User[]>`INSERT INTO users (name, email, phone, password_hash)
                                  VALUES (${cleanName}, ${email}, ${phone}, ${await hashPassword(password)})
                                  RETURNING id, name, email, phone, role`;
    return Response.json({ user: publicUser(u) }, { status: 201, headers: { "Set-Cookie": sessionCookie(req, u.id) } });
  } catch (e) {
    if ((e as { code?: string }).code === "23505")
      return Response.json({ error: `An account with this ${email ? "email" : "mobile number"} already exists. Sign in instead.` }, { status: 409 });
    throw e;
  }
}
