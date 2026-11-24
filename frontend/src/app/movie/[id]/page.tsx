"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Reviews from "@/components/Reviews";
import { getMovie } from "@/lib/catalog";
import { useCatalog } from "@/lib/use-catalog";
import { fillingFast, getShows } from "@/lib/shows";
import { useStore } from "@/lib/store";
import { useHydrated, useNow } from "@/lib/pricing";
import { bookableDates, dateLabel } from "@/lib/dates";

export default function MoviePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ready = useHydrated();
  const { city, setBooking } = useStore();
  const [picked, setPicked] = useState<string | null>(null);
  const now = useNow();
  const cat = useCatalog();
  const movie = getMovie(id);
  if (!movie) return <p className="p-10">{cat.live ? "Movie not found." : "Loading..."}</p>;
  const audience = cat.ratings[movie.id];
  const cityName = ready ? city : "Mumbai";
  const dates = bookableDates(now);
  const hasShows = (d: string) => getShows(movie.id, cityName, d).some((t) => t.shows.length);
  // Late at night today may have no shows left: open on the first date that still has some.
  const date = picked && dates.includes(picked) ? picked : dates.find(hasShows) ?? dates[0];
  const board = getShows(movie.id, cityName, date);

  return (
    <div>
      <section className="on-dark relative flex h-[70vh] min-h-[420px] items-end overflow-hidden bg-ink text-white"
        style={{ background: `linear-gradient(135deg, hsl(${movie.hue} 80% 40%), hsl(${movie.hue2} 75% 14%) 65%, #16161A)` }}>
        {movie.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 animate-pulse opacity-30" style={{ background: "radial-gradient(circle at 70% 30%, #fff, transparent 50%)" }} />
        )}
        <div className="absolute right-6 top-6 rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs tracking-widest">TRAILER PLAYING</div>
        <div className="relative w-full bg-gradient-to-t from-ink via-ink/60 to-transparent px-6 pb-10 pt-32 md:px-12">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">{movie.lang} · {movie.genre} · {movie.duration}</p>
          {/* real key art already carries the title, so keep the heading for screen readers only */}
          <h1 className={movie.banner ? "sr-only" : "mt-2 text-4xl font-black drop-shadow-lg md:text-6xl"}>{movie.title}</h1>
          <p className="mt-3 max-w-2xl text-white/80">{movie.blurb}</p>
          <p className="mt-3 font-semibold text-amber-300">
            ★ {movie.rating} / 10 critics
            {audience?.count ? <span className="ml-3">👥 {audience.avg} / 5 from {audience.count} review{audience.count === 1 ? "" : "s"}</span> : null}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="mb-4 text-2xl font-bold">Theatres in {cityName}</h2>
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {dates.map((d) => (
            <button key={d} onClick={() => setPicked(d)} className={`btn shrink-0 !py-2 text-sm ${date === d ? "btn-brand" : "btn-ghost"}`}>{dateLabel(d, true, now)}</button>
          ))}
        </div>
        <div className="space-y-4">
          {board.map(({ theatre, shows }) => (
            <div key={theatre.id} className="card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="font-bold">{theatre.name}</h3>
                <span className="text-xs text-fg/50">{theatre.km} km away</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {!shows.length && <p className="text-sm text-fg/50">No more shows today. Pick another date.</p>}
                {shows.map((s) => {
                  const nearlyFull = fillingFast(s.fill);
                  return (
                    <button key={s.id}
                      onClick={() => { setBooking({ movieId: movie.id, city: cityName, date, theatreId: theatre.id, showId: s.id, time: s.time, format: s.format, fill: s.fill, seats: [], snacks: {} }); router.push("/book/seats"); }}
                      className={`rounded-lg border px-3 py-2 text-sm transition hover:scale-105 ${nearlyFull ? "border-gold/60 font-semibold text-gold hover:bg-gold/10" : "border-fg/25 font-semibold text-fg hover:border-fg hover:bg-fg/5"}`}>
                      <div className="font-semibold">{s.time}</div>
                      <div className="text-[10px] text-fg/50">{s.format}{nearlyFull ? " · filling fast" : ""}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Reviews movieId={movie.id} />
    </div>
  );
}
