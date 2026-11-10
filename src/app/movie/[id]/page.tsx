"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { getMovie } from "@/lib/data";
import { getShows } from "@/lib/shows";
import { useStore } from "@/lib/store";
import { dayLabel, useHydrated } from "@/lib/pricing";

export default function MoviePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ready = useHydrated();
  const { city, setBooking } = useStore();
  const [day, setDay] = useState(0);
  const movie = getMovie(id);
  if (!movie) return <p className="p-10">Movie not found.</p>;
  const cityName = ready ? city : "Mumbai";
  const board = getShows(movie.id, cityName, day);

  return (
    <div>
      <section className="relative flex h-[70vh] min-h-[420px] items-end overflow-hidden"
        style={{ background: `linear-gradient(135deg, hsl(${movie.hue} 80% 40%), hsl(${movie.hue2} 75% 14%) 65%, #07070c)` }}>
        {movie.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 animate-pulse opacity-30" style={{ background: "radial-gradient(circle at 70% 30%, #fff, transparent 50%)" }} />
        )}
        <div className="absolute right-6 top-6 rounded-full border border-white/30 bg-black/40 px-3 py-1 text-xs tracking-widest">TRAILER PLAYING</div>
        <div className="relative w-full bg-gradient-to-t from-ink via-ink/60 to-transparent px-6 pb-10 pt-32 md:px-12">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">{movie.lang} · {movie.genre} · {movie.duration}</p>
          <h1 className="mt-2 text-4xl font-black drop-shadow-lg md:text-6xl">{movie.title}</h1>
          <p className="mt-3 max-w-2xl text-white/80">{movie.blurb}</p>
          <p className="mt-3 font-semibold text-gold">★ {movie.rating} / 10</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-8">
        <h2 className="mb-4 text-2xl font-bold">Theatres in {cityName}</h2>
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {[0, 1, 2, 3, 4].map((d) => (
            <button key={d} onClick={() => setDay(d)} className={`btn shrink-0 !py-2 text-sm ${day === d ? "btn-brand" : "btn-ghost"}`}>{dayLabel(d)}</button>
          ))}
        </div>
        <div className="space-y-4">
          {board.map(({ theatre, shows }) => (
            <div key={theatre.id} className="card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="font-bold">{theatre.name}</h3>
                <span className="text-xs text-white/50">{theatre.km} km away</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {shows.map((s) => {
                  const nearlyFull = s.fill > 0.75;
                  return (
                    <button key={s.id}
                      onClick={() => { setBooking({ movieId: movie.id, city: cityName, day, theatreId: theatre.id, showId: s.id, time: s.time, format: s.format, fill: s.fill, seats: [], snacks: {} }); router.push("/book/seats"); }}
                      className={`rounded-lg border px-3 py-2 text-sm transition hover:scale-105 ${nearlyFull ? "border-orange-400/60 text-orange-300" : "border-emerald-400/60 text-emerald-300"}`}>
                      <div className="font-semibold">{s.time}</div>
                      <div className="text-[10px] text-white/50">{s.format}{nearlyFull ? " · filling fast" : ""}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
