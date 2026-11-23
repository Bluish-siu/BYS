import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { invalidateCatalog } from "@/lib/catalog-server";
import { getLayout } from "@/lib/layouts";

export const dynamic = "force-dynamic";

// POST { theatreId, prices: { "Recliner Rows": 2900, ... } }: sets one theatre's seat prices by section.
// A price equal to the layout's usual price removes the override.
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const { theatreId, prices } = await req.json().catch(() => ({}));
  const [t] = await sql!`SELECT layout FROM theatres WHERE id = ${String(theatreId)}`;
  if (!t) return Response.json({ error: "Unknown theatre" }, { status: 400 });
  const base = new Map(getLayout(t.layout).rows.map((r) => [r.section, r.price]));
  const entries = Object.entries((prices ?? {}) as Record<string, unknown>);
  for (const [section, price] of entries) {
    if (!base.has(section)) return Response.json({ error: `No section called ${section}` }, { status: 400 });
    if (!Number.isInteger(price) || (price as number) < 1 || (price as number) > 50_000) return Response.json({ error: `Enter a price between ₹1 and ₹50,000 for ${section}` }, { status: 400 });
  }
  await sql!.begin(async (tx) => {
    for (const [section, price] of entries) {
      if (price === base.get(section)) await tx`DELETE FROM seat_prices WHERE theatre_id = ${theatreId} AND section = ${section}`;
      else await tx`INSERT INTO seat_prices (theatre_id, section, price) VALUES (${theatreId}, ${section}, ${price as number})
                    ON CONFLICT (theatre_id, section) DO UPDATE SET price = excluded.price`;
    }
  });
  invalidateCatalog();
  return Response.json({ ok: true });
}
