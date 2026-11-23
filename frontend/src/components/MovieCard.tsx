import Link from "next/link";
import Poster from "./Poster";
import type { Movie } from "@/lib/data";
import type { Rating } from "@/lib/catalog";

/** Poster, title and ratings: the critics' score out of 10 and, when there are reviews, the audience's out of 5. */
export default function MovieCard({ movie, rating }: { movie: Movie; rating?: Rating }) {
  return (
    <Link href={`/movie/${movie.id}`} className="group">
      <Poster movie={movie} className="transition group-hover:-translate-y-1 group-hover:shadow-2xl" />
      <p className="mt-2 text-sm font-semibold">{movie.title}</p>
      <p className="text-xs text-fg/55">
        {movie.lang} · {movie.genre} · ★ {movie.rating}/10
        {rating?.count ? <span className="ml-1 font-semibold text-gold">· 👥 {rating.avg}/5 ({rating.count})</span> : null}
      </p>
    </Link>
  );
}
