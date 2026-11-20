import { theatresFor, Theatre } from "./data";

export type Show = { id: string; time: string; format: string; fill: number };
export type TheatreShows = { theatre: Theatre; shows: Show[] };

// Deterministic hash + PRNG so the same movie/city/day always gives the same shows.
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

export function getShows(movieId: string, city: string, day: number): TheatreShows[] {
  return [...theatresFor(city)].sort((a, b) => a.km - b.km).map((theatre) => {
    const r = rng(hash(`${movieId}|${city}|${day}|${theatre.id}`));
    const picked = slots.filter(() => r() < 0.8);
    const shows = (picked.length ? picked : [slots[3]]).map((time) => {
      const hour = parseInt(time);
      const base = hour < 12 ? 0.25 : hour < 17 ? 0.45 : 0.7;
      return { id: `${theatre.id}-${time}`, time: label(time), format: theatre.formats[Math.floor(r() * theatre.formats.length)], fill: Math.min(0.95, base + r() * 0.3) };
    });
    return { theatre, shows };
  });
}

export function soldSeatsFor(showKey: string, fill: number, ids: string[]): Set<string> {
  const r = rng(hash(showKey));
  const sold = new Set<string>();
  for (const id of ids) if (r() < fill * 0.7) sold.add(id);
  return sold;
}
