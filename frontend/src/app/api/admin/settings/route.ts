import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { invalidateCatalog } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

// POST { demoOccupancy: boolean }: turns the sample "sold" seats on every show on or off.
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const { demoOccupancy } = await req.json().catch(() => ({}));
  if (typeof demoOccupancy !== "boolean") return Response.json({ error: "demoOccupancy must be true or false" }, { status: 400 });
  await sql!`INSERT INTO settings (key, value) VALUES ('demo_occupancy', ${sql!.json(demoOccupancy)})
             ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
  invalidateCatalog();
  return Response.json({ ok: true, demoOccupancy });
}
