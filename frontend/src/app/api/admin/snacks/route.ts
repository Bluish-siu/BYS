import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { invalidateCatalog } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

// Adds a snack, or updates it when "id" is an existing one. Hide a snack by unticking "On the menu";
// it stays in the database so old bookings that include it still show its name.
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const s = await req.json().catch(() => ({}));
  const name = String(s.name ?? "").trim().slice(0, 40);
  const price = Number(s.price);
  if (!name) return Response.json({ error: "Enter the snack's name" }, { status: 400 });
  if (!Number.isInteger(price) || price < 1 || price > 5000) return Response.json({ error: "Enter a price between ₹1 and ₹5,000" }, { status: 400 });
  const id = String(s.id ?? "").trim() || slug(name);
  if (!id) return Response.json({ error: "Invalid name" }, { status: 400 });
  await sql!`INSERT INTO snacks (id, name, price, emoji, active, sort)
             VALUES (${id}, ${name}, ${price}, ${String(s.emoji ?? "🍿").slice(0, 4) || "🍿"}, ${s.active !== false}, ${Number.isInteger(s.sort) ? s.sort : 100})
             ON CONFLICT (id) DO UPDATE SET name = excluded.name, price = excluded.price, emoji = excluded.emoji, active = excluded.active`;
  invalidateCatalog();
  return Response.json({ ok: true, id });
}
