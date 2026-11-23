// The live catalogue: movies, theatres and admin-set showtimes.
// Starts with the built-in data (data.ts), then switches to the database copy from /api/catalog,
// which admins edit in the admin panel. Server routes load it from the database (catalog-server.ts).
import { createStore } from "zustand/vanilla";
import { cityTheatres, movies as builtInMovies, type Movie, type Theatre } from "./data";

export type CityTheatre = Theatre & { city: string };
export type ShowRow = { id: string; movieId: string; theatreId: string; time: string; format: string };
export type Rating = { avg: number; count: number };
export type Catalog = {
  movies: Movie[];
  theatres: CityTheatre[];
  shows: ShowRow[];                 // admin-set showtimes; movie/theatre pairs without any get generated ones
  ratings: Record<string, Rating>;  // audience ratings from reviews, by movie id
  live: boolean;                    // true when it came from the database
};

export const builtInCatalog: Catalog = {
  movies: builtInMovies,
  theatres: Object.entries(cityTheatres).flatMap(([city, list]) => list.map((t) => ({ ...t, city }))),
  shows: [],
  ratings: {},
  live: false,
};

// A plain store (no React here, so server routes can import this file). Pages use useCatalog() from use-catalog.ts.
export const catalogStore = createStore<{ cat: Catalog }>(() => ({ cat: builtInCatalog }));
const cur = () => catalogStore.getState().cat;
export const setCatalog = (cat: Catalog) => catalogStore.setState({ cat });

export const allMovies = () => cur().movies;
export const getMovie = (id: string) => cur().movies.find((m) => m.id === id);
export const cityList = (cat: Catalog = cur()) => Array.from(new Set(cat.theatres.map((t) => t.city)));
export const theatresFor = (city: string) => {
  const list = cur().theatres.filter((t) => t.city === city);
  return list.length ? list : cur().theatres.filter((t) => t.city === cityList()[0]);
};
/** The theatre with this id. Falls back to the first theatre so old tickets still open. */
export const findTheatre = (id: string) => cur().theatres.find((t) => t.id === id) ?? cur().theatres[0];
export const theatreExists = (id: string) => cur().theatres.some((t) => t.id === id);

const CACHE_KEY = "pickmyseat-catalog";
let loading: Promise<void> | null = null;

/** Loads the database catalogue once per page load. The last copy is kept in the browser so pages open instantly. */
export function loadCatalog(force = false) {
  if (typeof window === "undefined") return Promise.resolve();
  if (force) loading = null;
  if (!loading) {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved && !cur().live) setCatalog(JSON.parse(saved));
    } catch { /* no storage: keep the built-in catalogue */ }
    loading = fetch("/api/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Catalog | null) => {
        if (!c?.movies?.length) return;
        setCatalog(c);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
      })
      .catch(() => { /* offline: keep what we have */ });
  }
  return loading;
}
