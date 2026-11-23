import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth-server";
import { dbCatalog, invalidateCatalog } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

// GET /api/reviews?movie=ramayana: the average, the count of each star rating, and the latest reviews.
export async function GET(req: Request) {
  const movie = new URL(req.url).searchParams.get("movie") ?? "";
  if (!sql) return Response.json({ enabled: false, avg: 0, count: 0, stars: [0, 0, 0, 0, 0], reviews: [], mine: null });
  const user = await currentUser(req).catch(() => null);
  const [summary, stars, reviews] = await Promise.all([
    sql`SELECT coalesce(round(avg(rating)::numeric, 1), 0)::float AS avg, count(*)::int AS count FROM reviews WHERE movie_id = ${movie}`,
    sql`SELECT rating, count(*)::int AS n FROM reviews WHERE movie_id = ${movie} GROUP BY rating`,
    sql`SELECT r.id, r.rating, r.comment, r.created_at, u.name, r.user_id = ${user?.id ?? null}::uuid AS mine
        FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.movie_id = ${movie} ORDER BY r.created_at DESC LIMIT 50`,
  ]);
  const counts = [1, 2, 3, 4, 5].map((n) => stars.find((s) => s.rating === n)?.n ?? 0);
  return Response.json({
    enabled: true,
    ...summary[0],
    stars: counts,
    // Only first names are shown publicly.
    reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, at: r.created_at, name: String(r.name).split(" ")[0], mine: r.mine })),
    mine: reviews.find((r) => r.mine) ? { rating: reviews.find((r) => r.mine)!.rating, comment: reviews.find((r) => r.mine)!.comment } : null,
  });
}

// POST { movieId, rating 1-5, comment }: adds or updates the signed-in customer's review.
export async function POST(req: Request) {
  if (!sql) return Response.json({ error: "Reviews are not available on this site" }, { status: 503 });
  const user = await currentUser(req);
  if (!user) return Response.json({ error: "Please sign in to write a review" }, { status: 401 });
  const { movieId, rating, comment } = await req.json().catch(() => ({}));
  const cat = await dbCatalog();
  if (typeof movieId !== "string" || !cat.movies.some((m) => m.id === movieId)) return Response.json({ error: "Unknown movie" }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return Response.json({ error: "Pick 1 to 5 stars" }, { status: 400 });
  const text = String(comment ?? "").trim().slice(0, 1000);
  await sql`INSERT INTO reviews (movie_id, user_id, rating, comment) VALUES (${movieId}, ${user.id}, ${rating}, ${text})
            ON CONFLICT (movie_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = now()`;
  invalidateCatalog();
  return Response.json({ ok: true });
}

// DELETE ?movie=id: removes the signed-in customer's own review.
export async function DELETE(req: Request) {
  if (!sql) return Response.json({ error: "Reviews are not available on this site" }, { status: 503 });
  const user = await currentUser(req);
  if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });
  await sql`DELETE FROM reviews WHERE movie_id = ${new URL(req.url).searchParams.get("movie") ?? ""} AND user_id = ${user.id}`;
  invalidateCatalog();
  return Response.json({ ok: true });
}
