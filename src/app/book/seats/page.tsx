"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findTheatre, getMovie } from "@/lib/data";
import { KIND_COLOR, Layout } from "@/lib/layouts";
import { getShows, soldSeatsFor } from "@/lib/shows";
import { useStore } from "@/lib/store";
import { dayLabel, layoutFor, seatsTotal, useHydrated } from "@/lib/pricing";
import { newInput, type CamMode } from "@/components/SeatHall";
import SeatMap from "@/components/SeatMap";

const SeatHall = dynamic(() => import("@/components/SeatHall"), { ssr: false, loading: () => <div className="grid h-full place-items-center text-white/50">Building the hall...</div> });

const MODES: { id: CamMode; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stage", label: "From stage" },
  { id: "balcony", label: "Back row" },
  { id: "bird", label: "Bird's eye" },
];
const TOUR: CamMode[] = ["overview", "stage", "balcony", "bird"];

const sweetRow = (layout: Layout) => Math.floor(layout.rows.length * 0.55);

// Scores every run of `qty` side-by-side free seats and returns the best one (lowest score).
function bestSeats(layout: Layout, qty: number, sold: Set<string>): string[] | null {
  const sweet = sweetRow(layout);
  let best: { score: number; ids: string[] } | null = null;
  for (const row of layout.rows) {
    const pairs = row.kind === "recliner" || row.kind === "lounger" || row.kind === "sofa";
    for (let start = 0; start + qty <= row.seats.length; start++) {
      const run = row.seats.slice(start, start + qty);
      if (run.some((s) => sold.has(s.id))) continue;
      if (run[0].group !== run[qty - 1].group) continue; // would cross an aisle
      if (row.kind === "recliner" && (start % 2 === 1 || (start + qty) % 2 === 1)) continue; // would split a couple recliner
      const centre = Math.abs(run.reduce((a, s) => a + s.x, 0) / qty);
      const score = centre * 1.2 + Math.abs(row.idx - sweet) * (pairs ? 1.4 : 1);
      if (!best || score < best.score) best = { score, ids: run.map((s) => s.id) };
    }
  }
  return best ? (best as { ids: string[] }).ids : null;
}

// "Bestseller" seats: the centre block of the rows around the sweet spot.
function bestsellers(layout: Layout) {
  const sweet = sweetRow(layout);
  const set = new Set<string>();
  for (const row of layout.rows) {
    if (Math.abs(row.idx - sweet) > 1) continue;
    for (const s of row.seats) if (Math.abs(s.x) < 1.7) set.add(s.id);
  }
  return set;
}

export default function SeatsPage() {
  const ready = useHydrated();
  const router = useRouter();
  const { booking, patch } = useStore();
  const [view, setView] = useState<"map" | "3d">("map");
  const [mode, setMode] = useState<CamMode>("overview");
  const [tour, setTour] = useState(false);
  const [qty, setQty] = useState(2);
  const [msg, setMsg] = useState("");
  const input = useRef(newInput());
  const onWalk = useCallback(() => { setTour(false); setMode("walk"); }, []);

  useEffect(() => { if (ready && !booking) router.replace("/"); }, [ready, booking, router]);
  useEffect(() => {
    if (!tour) return;
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % TOUR.length; setMode(TOUR[i]); }, 3200);
    return () => clearInterval(t);
  }, [tour]);

  const layout = useMemo(() => (booking ? layoutFor(booking) : null), [booking?.theatreId]); // eslint-disable-line react-hooks/exhaustive-deps
  const sold = useMemo(() => (booking && layout ? soldSeatsFor(`${booking.movieId}|${booking.showId}|${booking.day}`, booking.fill, layout.seatIds) : new Set<string>()), [booking?.movieId, booking?.showId, booking?.day, layout]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = useMemo(() => (layout ? bestsellers(layout) : new Set<string>()), [layout]);
  const movie = booking ? getMovie(booking.movieId) : undefined;
  if (!ready || !booking || !movie || !layout) return <p className="p-10 text-white/60">Loading...</p>;

  const theatre = findTheatre(booking.theatreId);
  const shows = getShows(booking.movieId, booking.city, booking.day).find((t) => t.theatre.id === booking.theatreId)?.shows ?? [];
  const picked = booking.seats;
  const last = picked[picked.length - 1] ?? null;
  const lastRow = last ? layout.byId.get(last) : undefined;

  const enter3d = (m: CamMode) => { setTour(false); setMode(m); setView("3d"); };
  const toggle = (id: string) => {
    setMsg("");
    if (picked.includes(id)) {
      const rest = picked.filter((s) => s !== id);
      patch({ seats: rest });
      if (!rest.length && mode === "seat") setMode("overview");
      return;
    }
    if (picked.length >= 8) return setMsg("You can pick up to 8 seats.");
    patch({ seats: [...picked, id] });
    // take you into the seat so you can check the view from it
    enter3d("seat");
  };
  const pickBest = () => {
    const ids = bestSeats(layout, qty, sold);
    if (!ids) return setMsg(`No ${qty} seats together are free for this show.`);
    patch({ seats: ids });
    setMsg(`Picked ${ids.join(", ")}`);
    if (view === "3d") enter3d("seat");
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-[57px] z-40 flex flex-col bg-ink">
      {/* title bar */}
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2 md:px-6">
        <button aria-label="Back" onClick={() => (view === "3d" ? setView("map") : router.push(`/movie/${movie.id}`))} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl hover:bg-white/10">‹</button>
        <div className="mr-auto min-w-0">
          <p className="truncate font-semibold">{movie.title} ({booking.format}) - {movie.lang}</p>
          <p className="truncate text-xs text-white/55">{theatre.name} | {dayLabel(booking.day)} | {booking.time}</p>
        </div>
        {view === "map" ? (
          <button onClick={() => enter3d("overview")} className="btn btn-ghost shrink-0 !px-3 !py-1.5 text-xs">View hall in 3D</button>
        ) : (
          <button onClick={() => { setTour(false); setView("map"); }} className="btn btn-brand shrink-0 !px-3 !py-1.5 text-xs">▦ Seat map</button>
        )}
      </div>

      {view === "map" ? (
        <>
          {/* other showtimes at this theatre */}
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 bg-white/[0.03] px-3 py-2 md:px-6">
            {shows.map((s) => {
              const active = s.id === booking.showId;
              return (
                <button key={s.id}
                  onClick={() => { if (!active) { patch({ showId: s.id, time: s.time, format: s.format, fill: s.fill, seats: [] }); setMsg(""); } }}
                  className={`shrink-0 rounded-md border px-3 py-1 text-center text-xs ${active ? "border-emerald-500 bg-emerald-500 text-white" : s.fill > 0.75 ? "border-amber-400/70 text-amber-200" : "border-emerald-500/60 text-emerald-300"}`}>
                  <div className="font-semibold">{s.time}</div>
                  <div className="text-[9px] opacity-80">{s.format}</div>
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1">
            <SeatMap layout={layout} sold={sold} picked={picked} bestseller={best} onPick={toggle} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-white/10 py-2 text-xs text-white/70">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-emerald-500/70" />Available</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-white/15" />Sold</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-amber-400" />Bestseller</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-500" />Selected</span>
            <span className="text-white/40">Tap a seat to see your view in 3D</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2 text-sm md:px-6">
            {MODES.map((m) => <button key={m.id} onClick={() => { setTour(false); setMode(m.id); }} className={`btn shrink-0 !px-3 !py-1.5 text-xs ${mode === m.id && !tour ? "btn-brand" : "btn-ghost"}`}>{m.label}</button>)}
            <button disabled={!last} onClick={() => { setTour(false); setMode("seat"); }} className={`btn shrink-0 !px-3 !py-1.5 text-xs disabled:opacity-40 ${mode === "seat" && !tour ? "btn-brand" : "btn-ghost"}`}>From my seat</button>
            <button onClick={() => { setTour(false); setMode("walk"); }} className={`btn shrink-0 !px-3 !py-1.5 text-xs ${mode === "walk" && !tour ? "btn-brand" : "btn-ghost"}`}>Walk around</button>
            <button onClick={() => setTour((t) => !t)} className={`btn shrink-0 !px-3 !py-1.5 text-xs ${tour ? "btn-brand" : "btn-ghost"}`}>{tour ? "Stop tour" : "Auto tour"}</button>
          </div>
          <div className="fade-in relative min-h-0 flex-1">
            <SeatHall layout={layout} format={booking.format} movie={movie} sold={sold} picked={picked} onPick={toggle} mode={mode} seat={last} input={input} onWalk={onWalk} />
            <div className="pointer-events-none absolute left-3 top-3 max-h-[70%] space-y-1.5 overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-3 text-[11px] backdrop-blur-md">
              {layout.legend.map((l) => (
                <div key={`${l.kind}${l.price}`} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: KIND_COLOR[l.kind] }} />{l.name} ₹{l.price}</div>
              ))}
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: "#2ee08a" }} />Your pick</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: "#2b2b31" }} />Sold</div>
              <div className="hidden pt-1 text-white/45 sm:block">Drag to look 360°<br />WASD or arrows to walk<br />Tap a seat to sit there</div>
            </div>
            {mode === "seat" && last && lastRow && (
              <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/45 px-4 py-1.5 text-sm backdrop-blur-md">
                View from seat <b>{last}</b> · {lastRow.section} · ₹{lastRow.price}
              </div>
            )}
            <div className="absolute bottom-4 right-4 grid grid-cols-3 gap-1.5 select-none" style={{ touchAction: "none" }}>
              {([["", ""], ["f", "▲"], ["", ""], ["l", "◀"], ["b", "▼"], ["r", "▶"]] as const).map(([k, g], i) => k ? (
                <button key={i} aria-label={`walk ${k}`}
                  onPointerDown={(e) => { e.stopPropagation(); onWalk(); input.current[k as "f" | "b" | "l" | "r"] = true; }}
                  onPointerUp={() => { input.current[k as "f" | "b" | "l" | "r"] = false; }}
                  onPointerLeave={() => { input.current[k as "f" | "b" | "l" | "r"] = false; }}
                  className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-lg active:bg-brand">{g}</button>
              ) : <span key={i} />)}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-panel/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <button className="btn btn-ghost !px-3 !py-1" onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
          <span className="w-4 text-center">{qty}</span>
          <button className="btn btn-ghost !px-3 !py-1" onClick={() => setQty(Math.min(8, qty + 1))}>+</button>
          <button className="btn btn-ghost !py-1.5 text-sm" onClick={pickBest}>✦ Best {qty} seat{qty > 1 ? "s" : ""}</button>
        </div>
        <div className="mr-auto min-w-0 text-sm text-white/70">{msg || (picked.length ? `${picked.join(", ")}` : "Tap a seat to pick it")}</div>
        {view === "map" && last && (
          <button onClick={() => enter3d("seat")} className="btn btn-ghost !py-1.5 text-sm">👁 View from {last}</button>
        )}
        <div className="text-right text-sm">
          <div className="font-bold">₹{seatsTotal(booking)}</div>
          <div className="text-xs text-white/50">{picked.length} seat{picked.length === 1 ? "" : "s"}{lastRow ? ` · ${lastRow.section}` : ""}</div>
        </div>
        <button disabled={!picked.length} onClick={() => router.push("/book/snacks")} className="btn btn-brand disabled:opacity-40">Continue</button>
      </div>
    </div>
  );
}
