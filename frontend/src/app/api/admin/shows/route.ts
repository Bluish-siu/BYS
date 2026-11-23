import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { invalidateCatalog } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

// Adds a daily showtime for a movie at a theatre. Once a movie has any showtimes at a theatre, only those are offered there.
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const { movieId, theatreId, time, format } = await req.json().catch(() => ({}));
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) return Response.json({ error: "Enter the time as HH:MM (24-hour)" }, { status: 400 });
  const [t] = await sql!`SELECT formats FROM theatres WHERE id = ${String(theatreId)}`;
  if (!t) return Response.json({ error: "Unknown theatre" }, { status: 400 });
  if (!(t.formats as string[]).includes(format)) return Response.json({ error: "This theatre doesn't have that format" }, { status: 400 });
  const [m] = await sql!`SELECT 1 FROM movies WHERE id = ${String(movieId)}`;
  if (!m) return Response.json({ error: "Unknown movie" }, { status: 400 });
  try {
    await sql!`INSERT INTO shows (id, movie_id, theatre_id, time, format) VALUES (${"s" + randomBytes(4).toString("hex")}, ${movieId}, ${theatreId}, ${time}, ${format})`;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return Response.json({ error: "There is already a show at that time" }, { status: 409 });
    throw e;
  }
  invalidateCatalog();
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  await sql!`DELETE FROM shows WHERE id = ${new URL(req.url).searchParams.get("id") ?? ""}`;
  invalidateCatalog();
  return Response.json({ ok: true });
}
