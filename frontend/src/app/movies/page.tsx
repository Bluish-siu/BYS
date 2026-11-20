"use client";
import Link from "next/link";
import { useState } from "react";
import Poster from "@/components/Poster";
import { movies } from "@/lib/data";

const langs = ["All", ...Array.from(new Set(movies.map((m) => m.lang)))];

export default function MoviesPage() {
  const [lang, setLang] = useState("All");
  const list = movies.filter((m) => lang === "All" || m.lang === lang);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-black">Now showing</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {langs.map((l) => (
          <button key={l} onClick={() => setLang(l)} className={`btn !py-1.5 text-sm ${lang === l ? "btn-brand" : "btn-ghost"}`}>{l}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
        {list.map((m) => (
          <Link key={m.id} href={`/movie/${m.id}`}>
            <Poster movie={m} />
            <p className="mt-2 text-sm font-semibold">{m.title}</p>
            <p className="text-xs text-white/50">{m.genre} · ★ {m.rating}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
