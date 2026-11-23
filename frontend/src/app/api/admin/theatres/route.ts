import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { invalidateCatalog } from "@/lib/catalog-server";
import { layoutIds } from "@/lib/layouts";

export const dynamic = "force-dynamic";

const FORMATS = ["2D", "3D", "IMAX", "4DX", "ICE", "Dolby Atmos"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// Adds a theatre, or updates it when "id" is an existing theatre.
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const t = await req.json().catch(() => ({}));
  const name = String(t.name ?? "").trim().slice(0, 80);
  const city = String(t.city ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  const km = Number(t.km);
  const formats: string[] = Array.isArray(t.formats) ? t.formats.filter((f: unknown) => FORMATS.includes(String(f))) : [];
  if (!name || !city) return Response.json({ error: "Name and city are required" }, { status: 400 });
  if (!(km >= 0 && km <= 999)) return Response.json({ error: "Distance must be a number of km" }, { status: 400 });
  if (!formats.length) return Response.json({ error: "Pick at least one format" }, { status: 400 });
  if (!layoutIds().includes(t.layout)) return Response.json({ error: "Pick a seat layout" }, { status: 400 });
  const id = String(t.id ?? "").trim() || slug(`${city.slice(0, 3)}-${name}`);
  await sql!`INSERT INTO theatres (id, city, name, km, formats, layout, active)
             VALUES (${id}, ${city}, ${name}, ${km}, ${sql!.array(formats)}, ${t.layout}, ${t.active !== false})
             ON CONFLICT (id) DO UPDATE SET city = excluded.city, name = excluded.name, km = excluded.km,
               formats = excluded.formats, layout = excluded.layout, active = excluded.active`;
  invalidateCatalog();
  return Response.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  await sql!`DELETE FROM theatres WHERE id = ${new URL(req.url).searchParams.get("id") ?? ""}`;
  invalidateCatalog();
  return Response.json({ ok: true });
}
