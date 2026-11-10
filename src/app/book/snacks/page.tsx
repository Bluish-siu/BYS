"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { snacks } from "@/lib/data";
import { useStore } from "@/lib/store";
import { seatsTotal, snacksTotal, useHydrated } from "@/lib/pricing";

export default function SnacksPage() {
  const ready = useHydrated();
  const router = useRouter();
  const { booking, patch } = useStore();
  useEffect(() => { if (ready && (!booking || !booking.seats.length)) router.replace("/"); }, [ready, booking, router]);
  if (!ready || !booking) return <p className="p-10 text-white/60">Loading...</p>;

  const set = (id: string, d: number) => {
    const q = Math.max(0, (booking.snacks[id] ?? 0) + d);
    const next = { ...booking.snacks, [id]: q };
    if (!q) delete next[id];
    patch({ snacks: next });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-black">Grab some snacks</h1>
      <p className="mb-6 text-white/60">Delivered to your seat before the movie starts.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {snacks.map((s) => {
          const q = booking.snacks[s.id] ?? 0;
          return (
            <div key={s.id} className="card flex items-center gap-4 p-4">
              <div className="text-4xl">{s.emoji}</div>
              <div className="flex-1">
                <p className="font-semibold">{s.name}</p>
                <p className="text-sm text-white/50">₹{s.price}</p>
              </div>
              {q ? (
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost !px-3 !py-1" onClick={() => set(s.id, -1)}>-</button>
                  <span className="w-4 text-center">{q}</span>
                  <button className="btn btn-brand !px-3 !py-1" onClick={() => set(s.id, 1)}>+</button>
                </div>
              ) : <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => set(s.id, 1)}>Add</button>}
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-panel p-4">
        <div className="text-sm text-white/70">Seats ₹{seatsTotal(booking)} · Snacks ₹{snacksTotal(booking)}</div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => router.push("/book/seats")}>Back</button>
          <button className="btn btn-brand" onClick={() => router.push("/book/pay")}>{Object.keys(booking.snacks).length ? "Review" : "Skip"}</button>
        </div>
      </div>
    </div>
  );
}
