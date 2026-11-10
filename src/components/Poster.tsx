import { Movie, posterGradient } from "@/lib/data";

// Widescreen card: real key art when we have it, otherwise generated art with the title.
export default function Poster({ movie, className = "" }: { movie: Movie; className?: string }) {
  if (movie.banner) {
    return (
      <div className={`relative aspect-video overflow-hidden rounded-xl bg-panel ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={movie.banner} alt={movie.title} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  return (
    <div className={`relative flex aspect-video flex-col justify-end overflow-hidden rounded-xl p-3 ${className}`} style={{ background: posterGradient(movie) }}>
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 70% 25%, #fff, transparent 45%)" }} />
      <span className="relative text-[10px] uppercase tracking-widest text-white/70">{movie.lang}</span>
      <span className="relative text-lg font-black leading-tight drop-shadow">{movie.title}</span>
    </div>
  );
}
