import Link from "next/link";
import Hero from "@/components/Hero";
import Poster from "@/components/Poster";
import { movies } from "@/lib/data";

export default function Home() {
  return (
    <>
      <Hero />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-5 text-2xl font-bold">Now showing</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {movies.map((m) => (
            <Link key={m.id} href={`/movie/${m.id}`} className="group">
              <Poster movie={m} className="transition group-hover:-translate-y-1 group-hover:shadow-2xl" />
              <p className="mt-2 text-sm font-semibold">{m.title}</p>
              <p className="text-xs text-white/50">{m.lang} · ★ {m.rating}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
