import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { invalidateCatalog } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
// A YouTube link or id -> the 11-character video id.
const youtubeId = (v: string) => v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(v) ? v : null);

// Adds a movie, or updates it when "id" is an existing movie.
export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const m = await req.json().catch(() => ({}));
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const title = str(m.title, 80), lang = str(m.lang, 30), genre = str(m.genre, 40);
  if (!title || !lang || !genre) return Response.json({ error: "Title, language and genre are required" }, { status: 400 });
  const year = Number(m.year), rating = Number(m.rating);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return Response.json({ error: "Enter a valid year" }, { status: 400 });
  if (!(rating >= 0 && rating <= 10)) return Response.json({ error: "Rating must be between 0 and 10" }, { status: 400 });
  const banner = str(m.banner, 500) || null;
  if (banner && !/^(https:\/\/|\/)/.test(banner)) return Response.json({ error: "The image must be an https:// link or a /posters/ path" }, { status: 400 });
  const trailerIn = str(m.trailer, 200);
  const trailer = trailerIn ? youtubeId(trailerIn) : null;
  if (trailerIn && !trailer) return Response.json({ error: "Paste a YouTube link or video id for the trailer" }, { status: 400 });
  const id = str(m.id, 40) || slug(title);
  if (!/^[a-z0-9-]{2,40}$/.test(id)) return Response.json({ error: "Invalid movie id" }, { status: 400 });
  const hue = Number.isInteger(m.hue) ? m.hue % 360 : Math.floor(Math.random() * 360);
  const hue2 = Number.isInteger(m.hue2) ? m.hue2 % 360 : (hue + 170) % 360;

  const db = sql!;
  if (!m.id) {
    const [taken] = await db`SELECT 1 FROM movies WHERE id = ${id}`;
    if (taken) return Response.json({ error: "A movie with this title already exists" }, { status: 409 });
  }
  await db`INSERT INTO movies (id, title, lang, genre, rating, duration, year, blurb, hue, hue2, banner, trailer, active, sort)
           VALUES (${id}, ${title}, ${lang}, ${genre}, ${rating}, ${str(m.duration, 20)}, ${year}, ${str(m.blurb, 400)}, ${hue}, ${hue2},
                   ${banner}, ${trailer}, ${m.active !== false}, ${Number.isInteger(m.sort) ? m.sort : 100})
           ON CONFLICT (id) DO UPDATE SET title = excluded.title, lang = excluded.lang, genre = excluded.genre, rating = excluded.rating,
             duration = excluded.duration, year = excluded.year, blurb = excluded.blurb, banner = excluded.banner, trailer = excluded.trailer,
             active = excluded.active, sort = excluded.sort`;
  invalidateCatalog();
  return Response.json({ ok: true, id });
}

// Deletes a movie with its showtimes and reviews. Tickets already sold are kept.
export async function DELETE(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  await sql!`DELETE FROM movies WHERE id = ${new URL(req.url).searchParams.get("id") ?? ""}`;
  invalidateCatalog();
  return Response.json({ ok: true });
}
