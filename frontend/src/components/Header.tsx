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
    <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-white/10 bg-ink/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-8">
      <Link href="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="PickMySeat home">
        <img src="/brand/pin.png" alt="" className="h-7 w-auto sm:h-8" />
        <span className="text-lg font-black tracking-tight sm:text-xl">PickMy<span className="text-brand">Seat</span></span>
      </Link>
      <nav className="flex min-w-0 items-center gap-2 text-sm sm:gap-3">
        <select value={mounted ? city : "Mumbai"} onChange={(e) => setCity(e.target.value)} className="max-w-[6.5rem] rounded-full border border-white/20 bg-panel px-2 py-1.5 sm:max-w-none sm:px-3">
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Link href="/movies" className="hidden hover:text-brand sm:block">Now showing</Link>
        <Link href="/tickets" className="btn btn-ghost whitespace-nowrap !px-3 !py-1.5"><span className="hidden sm:inline">My </span>Tickets</Link>
      </nav>
    </header>
  );
}
