"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Kind, Layout, RowSpec } from "@/lib/layouts";

// Box width per seat type, so recliners, loungers and sofas read wider like on BookMyShow.
const CELL: Record<Kind, string> = {
  classic: "w-7", prime: "w-7", plus: "w-7", perfect: "w-7", legroom: "w-8", recliner: "w-10", lounger: "w-12", sofa: "w-16",
};

type Section = { key: string; name: string; price: number; rows: RowSpec[] };

export default function SeatMap({ layout, sold, picked, bestseller, onPick }: {
  layout: Layout; sold: Set<string>; picked: string[]; bestseller: Set<string>; onPick: (id: string) => void;
}) {
  // Group consecutive rows into priced sections, then list them back-to-front so the screen sits at the bottom.
  const sections = useMemo(() => {
    const out: Section[] = [];
    for (const row of layout.rows) {
      const last = out[out.length - 1];
      if (last && last.name === row.section && last.price === row.price) last.rows.push(row);
      else out.push({ key: `${row.letter}-${row.section}`, name: row.section, price: row.price, rows: [row] });
    }
    return out.reverse().map((s) => ({ ...s, rows: [...s.rows].reverse() }));
  }, [layout]);

  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  // Start zoomed to fit the widest row, like the BookMyShow layout does.
  useLayoutEffect(() => {
    if (!outer.current || !inner.current) return;
    const fit = (outer.current.clientWidth - 24) / inner.current.scrollWidth;
    setZoom(Math.max(0.55, Math.min(1.2, fit)));
  }, [layout]);

  return (
    <div className="relative h-full">
      <div ref={outer} className="h-full overflow-auto px-3 pb-10 pt-4">
        <div ref={inner} className="mx-auto w-max" style={{ zoom }}>
          {sections.map((sec) => (
            <section key={sec.key} className="mb-6">
              <h3 className="mb-3 border-b border-white/10 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-white/60">
                ₹{sec.price} {sec.name}
              </h3>
              <div className="space-y-1.5">
                {sec.rows.map((row) => (
                  <div key={row.letter} className="flex items-center">
                    <span className="w-7 shrink-0 text-xs font-medium text-white/45">{row.letter}</span>
                    <div className="flex flex-1 justify-center gap-1">
                      {row.seats.map((s, i) => {
                        const isSold = sold.has(s.id);
                        const isPicked = picked.includes(s.id);
                        const isBest = !isSold && !isPicked && bestseller.has(s.id);
                        const gap = i > 0 && s.group !== row.seats[i - 1].group;
                        const look = isSold
                          ? "cursor-not-allowed border-transparent bg-white/[0.06] text-white/20"
                          : isPicked
                            ? "border-emerald-500 bg-emerald-500 font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                            : isBest
                              ? "border-amber-400 text-amber-200 hover:bg-amber-400/20"
                              : "border-emerald-500/70 text-emerald-300 hover:bg-emerald-500/20";
                        return (
                          <button
                            key={s.id}
                            disabled={isSold}
                            onClick={() => onPick(s.id)}
                            title={`${s.id} · ${row.section} · ₹${row.price}`}
                            aria-label={`Seat ${s.id}${isSold ? ", sold" : isPicked ? ", selected" : ""}`}
                            className={`${CELL[row.kind]} ${gap ? "ml-6" : ""} grid h-7 shrink-0 place-items-center rounded-[4px] border text-[10px] transition ${look}`}
                          >
                            {String(s.num).padStart(2, "0")}
                          </button>
                        );
                      })}
                    </div>
                    <span className="w-7 shrink-0" />
                  </div>
                ))}
              </div>
            </section>
          ))}
          {/* the screen, drawn as a glowing trapezoid like the BookMyShow layout */}
          <div className="mx-auto mt-8 w-[70%] min-w-[260px]">
            <svg viewBox="0 0 400 34" className="w-full drop-shadow-[0_8px_24px_rgba(125,211,252,0.45)]">
              <defs>
                <linearGradient id="scr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#bae6fd" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0.35" />
                </linearGradient>
              </defs>
              <path d="M30 4 H370 L398 30 H2 Z" fill="url(#scr)" stroke="#e0f2fe" strokeOpacity="0.6" />
            </svg>
            <p className="mt-2 text-center text-xs text-white/50">All eyes this way please</p>
          </div>
        </div>
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-panel text-xl hover:bg-white/10">+</button>
        <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.45, z - 0.15))} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-panel text-xl hover:bg-white/10">−</button>
      </div>
    </div>
  );
}
