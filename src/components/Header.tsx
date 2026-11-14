"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cities } from "@/lib/data";
import { useStore } from "@/lib/store";

export default function Header() {
  const { city, setCity } = useStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-white/10 bg-ink/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-8">
      <Link href="/" className="text-xl font-black tracking-[0.25em]">CINE<span className="text-brand">VERSE</span></Link>
      <nav className="flex items-center gap-3 text-sm">
        <select value={mounted ? city : "Mumbai"} onChange={(e) => setCity(e.target.value)} className="rounded-full border border-white/20 bg-panel px-3 py-1.5">
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Link href="/movies" className="hidden hover:text-brand sm:block">Now showing</Link>
        <Link href="/tickets" className="btn btn-ghost !py-1.5">My tickets</Link>
      </nav>
    </header>
  );
}
