"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cityList } from "@/lib/catalog";
import { useCatalog } from "@/lib/use-catalog";
import { accountLabel, signOut, useAccount } from "@/lib/auth";
import { useStore } from "@/lib/store";

export default function Header() {
  const { city, setCity } = useStore();
  const cat = useCatalog();
  const { enabled, user, needsVerify } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const cities = cityList(cat);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-fg/10 bg-paper/85 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-8">
      <Link href="/" className="flex shrink-0 items-center gap-1.5 sm:gap-2" aria-label="PickMySeat home">
        <img src="/brand/mark.svg" alt="" className="h-7 w-auto sm:h-8" />
        <span className="hidden text-lg font-extrabold tracking-[-0.035em] min-[400px]:inline sm:text-xl">PickMy<span className="text-brand">Seat</span></span>
      </Link>
      <nav className="flex min-w-0 items-center gap-2 text-sm sm:gap-3">
        <select aria-label="City" value={mounted && cities.includes(city) ? city : cities[0]} onChange={(e) => setCity(e.target.value)}
          className="max-w-[6.5rem] rounded-full border border-fg/20 bg-card px-2 py-1.5 sm:max-w-none sm:px-3">
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Link href="/movies" aria-label="Search movies" className="grid h-8 w-8 place-items-center rounded-full border border-fg/20 hover:bg-fg/5 sm:hidden">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </Link>
        <Link href="/movies" className="hidden hover:text-brand sm:block">Movies</Link>
        <Link href="/tickets" className="btn btn-ghost whitespace-nowrap !px-3 !py-1.5"><span className="hidden sm:inline">My&nbsp;</span>Tickets</Link>
        {mounted && enabled && (user
          ? <AccountMenu name={user.name} label={accountLabel(user)} admin={user.role === "admin"} verify={needsVerify} />
          : <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn btn-brand whitespace-nowrap !px-3 !py-1.5">Sign in</Link>)}
      </nav>
    </header>
  );
}

function AccountMenu({ name, label, admin, verify }: { name: string; label: string; admin: boolean; verify: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Account" aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-full bg-ink text-xs font-bold text-white">{initials}</button>
      {open && (
        <div className="card absolute right-0 top-11 w-60 p-2 text-sm shadow-xl">
          <div className="border-b border-fg/10 px-3 pb-2 pt-1">
            <p className="font-bold">{name}</p>
            <p className="truncate text-xs text-fg/55">{label}</p>
          </div>
          {verify && <Link onClick={() => setOpen(false)} href="/login?mode=verify" className="block rounded-lg px-3 py-2 font-semibold text-brand hover:bg-fg/5">Confirm your email</Link>}
          <Link onClick={() => setOpen(false)} href="/tickets" className="block rounded-lg px-3 py-2 hover:bg-fg/5">My tickets</Link>
          {admin && <Link onClick={() => setOpen(false)} href="/admin" className="block rounded-lg px-3 py-2 font-semibold text-brand hover:bg-fg/5">Admin panel</Link>}
          <button onClick={async () => { setOpen(false); await signOut(); router.push("/"); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-fg/5">Sign out</button>
        </div>
      )}
    </div>
  );
}
