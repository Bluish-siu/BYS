"use client";
import { useMemo, useState } from "react";
import MovieCard from "@/components/MovieCard";
import { useCatalog } from "@/lib/use-catalog";
import { getShows } from "@/lib/shows";
import { bookableDates } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/pricing";

const ALL = "All";

export default function MoviesPage() {
  const cat = useCatalog();
  const ready = useHydrated();
  const city = useStore((s) => s.city);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState(ALL);
  const [genre, setGenre] = useState(ALL);
  const [format, setFormat] = useState(ALL);
  const [sort, setSort] = useState("popular");

  const cityName = ready ? city : "Mumbai";
  // Formats each movie plays in this city over the next five days (IMAX, 4DX, 2D...).
  const formatsOf = useMemo(() => {
    const out = new Map<string, Set<string>>();
    for (const m of cat.movies) {
      const set = new Set<string>();
      for (const d of bookableDates()) for (const t of getShows(m.id, cityName, d)) for (const s of t.shows) set.add(s.format);
      out.set(m.id, set);
    }
    return out;
  }, [cat, cityName]);

  const langs = [ALL, ...Array.from(new Set(cat.movies.map((m) => m.lang))).sort()];
  const genres = [ALL, ...Array.from(new Set(cat.movies.map((m) => m.genre))).sort()];
  const formats = [ALL, ...Array.from(new Set([...formatsOf.values()].flatMap((s) => [...s]))).sort()];

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = cat.movies
    .filter((m) => words.every((w) => `${m.title} ${m.lang} ${m.genre} ${m.year}`.toLowerCase().includes(w)))
    .filter((m) => lang === ALL || m.lang === lang)
    .filter((m) => genre === ALL || m.genre === genre)
    .filter((m) => format === ALL || formatsOf.get(m.id)?.has(format))
    .sort((a, b) => sort === "rating" ? b.rating - a.rating
      : sort === "audience" ? (cat.ratings[b.id]?.avg ?? 0) - (cat.ratings[a.id]?.avg ?? 0)
      : sort === "az" ? a.title.localeCompare(b.title) : 0);
  const filtered = q || lang !== ALL || genre !== ALL || format !== ALL;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-black">Movies in {cityName}</h1>

      <div className="relative mb-4">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/45" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search movies, languages, genres" aria-label="Search movies" className="input !rounded-full !pl-10" />
      </div>

      <Chips label="Language" options={langs} value={lang} onChange={setLang} />
      <Chips label="Genre" options={genres} value={genre} onChange={setGenre} />
      <Chips label="Format" options={formats} value={format} onChange={setFormat} />

      <div className="mb-6 mt-2 flex items-center justify-between gap-3 text-sm">
        <p className="text-fg/60">{list.length} movie{list.length === 1 ? "" : "s"}{filtered && (
          <button className="ml-2 font-semibold text-brand underline" onClick={() => { setQ(""); setLang(ALL); setGenre(ALL); setFormat(ALL); }}>Clear filters</button>
        )}</p>
        <label className="flex items-center gap-2 text-fg/60">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full border border-fg/20 bg-card px-3 py-1.5 text-fg">
            <option value="popular">Popular</option>
            <option value="rating">Critics&apos; rating</option>
            <option value="audience">Audience rating</option>
            <option value="az">A to Z</option>
          </select>
        </label>
      </div>

      {list.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {list.map((m) => <MovieCard key={m.id} movie={m} rating={cat.ratings[m.id]} />)}
        </div>
      ) : (
        <p className="card p-8 text-center text-fg/60">No movies match. Try another search or clear the filters.</p>
      )}
    </div>
  );
}

function Chips({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  if (options.length <= 2) return null; // only one real choice: nothing to filter
  return (
    <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wider text-fg/45">{label}</span>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`chip shrink-0 ${value === o ? "chip-on" : "chip-off"}`}>{o}</button>
      ))}
    </div>
  );
}
