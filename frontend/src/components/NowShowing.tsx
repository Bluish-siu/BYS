"use client";
import MovieCard from "./MovieCard";
import { useCatalog } from "@/lib/use-catalog";

export default function NowShowing() {
  const cat = useCatalog();
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
      {cat.movies.map((m) => <MovieCard key={m.id} movie={m} rating={cat.ratings[m.id]} />)}
    </div>
  );
}
