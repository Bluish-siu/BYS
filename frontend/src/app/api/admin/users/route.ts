import { randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// GET ?q=: customers with their ticket counts, newest first.
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const like = `%${q}%`;
  const users = await sql!`
    SELECT u.id, u.name, u.email, u.phone, u.role, u.email_verified, u.created_at,
           count(b.id) FILTER (WHERE b.status = 'confirmed')::int AS tickets,
           coalesce(sum(b.total) FILTER (WHERE b.status = 'confirmed'), 0)::int AS spent
    FROM users u LEFT JOIN bookings b ON b.user_id = u.id
    WHERE ${q} = '' OR u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.phone ILIKE ${like}
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`;
  return Response.json({ users });
}

// POST { id, action }: "reset" gives a temporary password (shown once, signs the customer out everywhere),
// "verify" marks the email as confirmed, "admin" / "user" changes the role.
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const { id, action } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Unknown customer" }, { status: 400 });
  if (action === "reset") {
    // Easy to read out over the phone: two words and four digits.
    const words = ["popcorn", "screen", "ticket", "recliner", "matinee", "trailer", "balcony", "premiere", "encore", "spotlight"];
    const temp = `${words[randomInt(words.length)]}-${words[randomInt(words.length)]}-${randomInt(1000, 10000)}`;
    const [u] = await sql!`UPDATE users SET password_hash = ${await hashPassword(temp)}, session_version = session_version + 1 WHERE id = ${id} RETURNING name`;
    return u ? Response.json({ ok: true, password: temp }) : Response.json({ error: "Unknown customer" }, { status: 404 });
  }
  if (action === "verify") await sql!`UPDATE users SET email_verified = true WHERE id = ${id}`;
  else if (action === "admin" || action === "user") {
    if (id === a.user.id && action === "user") return Response.json({ error: "You can't remove your own admin rights here" }, { status: 400 });
    await sql!`UPDATE users SET role = ${action} WHERE id = ${id}`;
  } else return Response.json({ error: "Unknown action" }, { status: 400 });
  return Response.json({ ok: true });
}
