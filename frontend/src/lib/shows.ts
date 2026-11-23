import type { Theatre } from "./data";
import { catalogStore, theatresFor } from "./catalog";
import { hasStarted } from "./dates";

export type Show = { id: string; start: string; time: string; format: string; fill: number }; // start: 24-hour HH:MM, India time
export type TheatreShows = { theatre: Theatre; shows: Show[] };

// Deterministic hash + PRNG so the same movie/city/date always gives the same shows.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const slots = ["07:00", "10:45", "14:50", "18:55", "23:00"];
const label = (t: string) => {
  const h = parseInt(t);
  return `${String(h % 12 || 12).padStart(2, "0")}:${t.slice(3)} ${h < 12 ? "AM" : "PM"}`;
};

export const showLabel = label;

/**
 * Showtimes for a movie in a city on a date (YYYY-MM-DD), nearest theatre first.
 * Times an admin set for a movie and theatre are used as they are; otherwise a believable set is generated.
 * Shows that have already started (India time) are left out unless `includeStarted` is set.
 */
export function getShows(movieId: string, city: string, date: string, { includeStarted = false } = {}): TheatreShows[] {
  const set = catalogStore.getState().cat.shows.filter((s) => s.movieId === movieId);
  const keep = (s: Show) => includeStarted || !hasStarted(date, s.start);
  return [...theatresFor(city)].sort((a, b) => a.km - b.km).map((theatre) => {
    const r = rng(hash(`${movieId}|${city}|${date}|${theatre.id}`));
    const fillFor = (time: string) => {
      const hour = parseInt(time);
      return Math.min(0.95, (hour < 12 ? 0.25 : hour < 17 ? 0.45 : 0.7) + r() * 0.3);
    };
    const own = set.filter((s) => s.theatreId === theatre.id).sort((a, b) => a.time.localeCompare(b.time));
    if (own.length) return { theatre, shows: own.map((s) => ({ id: s.id, start: s.time, time: label(s.time), format: s.format, fill: fillFor(s.time) })).filter(keep) };
    const picked = slots.filter(() => r() < 0.8);
    const shows = (picked.length ? picked : [slots[3]]).map((time) => {
      const format = theatre.formats[Math.floor(r() * theatre.formats.length)];
      return { id: `${theatre.id}-${time}`, start: time, time: label(time), format, fill: fillFor(time) };
    });
    return { theatre, shows: shows.filter(keep) };
  });
}

export function soldSeatsFor(showKey: string, fill: number, ids: string[]): Set<string> {
  const r = rng(hash(showKey));
  const sold = new Set<string>();
  for (const id of ids) if (r() < fill * 0.7) sold.add(id);
  return sold;
}

/** False once the chosen show has started (India time), or if it no longer exists. */
export const showIsOpen = (b: { movieId: string; city: string; date: string; theatreId: string; showId: string }) =>
  getShows(b.movieId, b.city, b.date).find((t) => t.theatre.id === b.theatreId)?.shows.some((s) => s.id === b.showId) ?? false;
