// Server-only: reads the catalogue from Postgres, filling it from the built-in data the first time.
import type { Movie } from "./data";
import { builtInCatalog, setCatalog, type Catalog, type CityTheatre } from "./catalog";
import { sql } from "./db";

let cache: { at: number; cat: Catalog } | null = null;
const TTL_MS = 15_000;

type MovieRow = Omit<Movie, "rating" | "banner" | "trailer"> & { rating: string; banner: string | null; trailer: string | null; active: boolean; sort: number };
type TheatreRow = Omit<CityTheatre, "km"> & { km: string; active: boolean };

export type AdminMovie = Movie & { active: boolean; sort: number };
export type AdminTheatre = CityTheatre & { active: boolean };

async function seedIfEmpty() {
  if (!sql) return;
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM movies`;
  if (n > 0) return;
  await sql.begin(async (tx) => {
    let i = 0;
    for (const m of builtInCatalog.movies)
      await tx`INSERT INTO movies (id, title, lang, genre, rating, duration, year, blurb, hue, hue2, banner, trailer, sort)
               VALUES (${m.id}, ${m.title}, ${m.lang}, ${m.genre}, ${m.rating}, ${m.duration}, ${m.year}, ${m.blurb}, ${m.hue}, ${m.hue2},
                       ${m.banner ?? null}, ${m.trailer ?? null}, ${i++}) ON CONFLICT (id) DO NOTHING`;
    for (const t of builtInCatalog.theatres)
      await tx`INSERT INTO theatres (id, city, name, km, formats, layout)
               VALUES (${t.id}, ${t.city}, ${t.name}, ${t.km}, ${tx.array(t.formats)}, ${t.layout}) ON CONFLICT (id) DO NOTHING`;
  });
}

const toMovie = (r: MovieRow): AdminMovie => ({
  id: r.id, title: r.title, lang: r.lang, genre: r.genre, rating: Number(r.rating), duration: r.duration, year: r.year,
  blurb: r.blurb, hue: r.hue, hue2: r.hue2, banner: r.banner ?? undefined, trailer: r.trailer ?? undefined, active: r.active, sort: r.sort,
});
const toTheatre = (r: TheatreRow): AdminTheatre => ({ id: r.id, city: r.city, name: r.name, km: Number(r.km), formats: r.formats, layout: r.layout, active: r.active });

/** Everything, including hidden movies and theatres, for the admin panel. */
export async function adminCatalog() {
  if (!sql) return null;
  await seedIfEmpty();
  const [movies, theatres, shows] = await Promise.all([
    sql<MovieRow[]>`SELECT * FROM movies ORDER BY sort, title`,
    sql<TheatreRow[]>`SELECT * FROM theatres ORDER BY city, km`,
    sql`SELECT id, movie_id AS "movieId", theatre_id AS "theatreId", time, format FROM shows ORDER BY time`,
  ]);
  return { movies: movies.map(toMovie), theatres: theatres.map(toTheatre), shows: shows as unknown as Catalog["shows"] };
}

/** The public catalogue (active movies and theatres only). Also becomes the server's current catalogue. */
export async function dbCatalog(): Promise<Catalog> {
  if (!sql) return builtInCatalog;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cat;
  const all = await adminCatalog();
  const ratings = await sql`SELECT movie_id, round(avg(rating)::numeric, 1)::float AS avg, count(*)::int AS count FROM reviews GROUP BY movie_id`;
  const movies = all!.movies.filter((m) => m.active).map(({ active, sort, ...m }) => m); // eslint-disable-line @typescript-eslint/no-unused-vars
  const theatres = all!.theatres.filter((t) => t.active).map(({ active, ...t }) => t); // eslint-disable-line @typescript-eslint/no-unused-vars
  const live = new Set(movies.map((m) => m.id));
  const open = new Set(theatres.map((t) => t.id));
  const cat: Catalog = {
    movies,
    theatres,
    shows: all!.shows.filter((s) => live.has(s.movieId) && open.has(s.theatreId)),
    ratings: Object.fromEntries(ratings.map((r) => [r.movie_id, { avg: r.avg, count: r.count }])),
    live: true,
  };
  cache = { at: Date.now(), cat };
  setCatalog(cat);
  return cat;
}

/** Call after an admin change so the next request reads the database again. */
export const invalidateCatalog = () => { cache = null; };
