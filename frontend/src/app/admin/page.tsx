"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import QrScanner from "@/components/QrScanner";
import SeatMap from "@/components/SeatMap";
import type { Movie } from "@/lib/data";
import type { CityTheatre, ShowRow } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog";
import { useCatalog } from "@/lib/use-catalog";
import { useAccount } from "@/lib/auth";
import { getLayout } from "@/lib/layouts";
import { bookableDates, dateLabel } from "@/lib/dates";
import { getShows, showLabel, soldSeatsFor } from "@/lib/shows";

type AdminMovie = Movie & { active: boolean; sort: number };
type AdminTheatre = CityTheatre & { active: boolean };
type AdminSnack = { id: string; name: string; price: number; emoji: string; active: boolean; sort: number };
type AdminData = { movies: AdminMovie[]; theatres: AdminTheatre[]; shows: ShowRow[]; layouts: string[]; snacks: AdminSnack[]; seatPrices: Record<string, Record<string, number>> };
const TABS = ["Dashboard", "Check-in", "Customers", "Movies", "Theatres", "Showtimes", "Prices", "Block seats"] as const;
type Tab = (typeof TABS)[number];
const FORMATS = ["2D", "3D", "IMAX", "4DX", "ICE", "Dolby Atmos"];
const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");

async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Something went wrong");
  return d;
}

export default function AdminPage() {
  const { loaded, user } = useAccount();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [data, setData] = useState<AdminData | null>(null);
  const reload = useCallback(() => api("/api/admin/catalog").then(setData).catch(() => {}), []);
  useEffect(() => { if (user?.role === "admin") reload(); }, [user, reload]);
  // After an edit, the public pages get the new catalogue too.
  const changed = () => { reload(); loadCatalog(true); };

  if (!loaded) return <p className="p-10 text-fg/60">Loading...</p>;
  if (!user) return <p className="p-10"><Link href="/login?next=/admin" className="font-semibold text-brand underline">Sign in</Link> with an admin account.</p>;
  if (user.role !== "admin") return <p className="p-10">This page is for PickMySeat admins only.</p>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h1 className="text-3xl font-black">Admin panel</h1>
        <p className="text-sm text-fg/55">Signed in as {user.name}</p>
      </div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`chip shrink-0 ${tab === t ? "chip-on" : "chip-off"}`}>{t}</button>)}
      </div>
      {tab === "Dashboard" && <Dashboard movies={data?.movies ?? []} />}
      {tab === "Check-in" && <CheckIn movies={data?.movies ?? []} />}
      {tab === "Customers" && <Customers me={user.id} />}
      {data && tab === "Prices" && <Prices data={data} changed={changed} />}
      {data && tab === "Movies" && <Movies data={data} changed={changed} />}
      {data && tab === "Theatres" && <Theatres data={data} changed={changed} />}
      {data && tab === "Showtimes" && <Showtimes data={data} changed={changed} />}
      {data && tab === "Block seats" && <BlockSeats data={data} />}
      {!data && tab !== "Dashboard" && <p className="text-fg/60">Loading...</p>}
    </div>
  );
}

// ---------- Dashboard ----------

type Overview = {
  revenue: number; bookings: number; tickets: number; today: number; customers: number; checked_in: number; refunded: number;
  byMovie: { movie_id: string; revenue: number; tickets: number }[];
  byDay: { day: string; revenue: number }[];
  recent: {
    id: string; movie_id: string; theatre_id: string; city: string; show_time: string; show_date: string; seats: string[]; total: number; status: string;
    payment_id: string | null; created_at: string; checked_in_at: string | null; refund_amount: number | null; cancelled_by: string | null; customer: string | null; contact: string | null;
  }[];
};

function Dashboard({ movies }: { movies: AdminMovie[] }) {
  const [o, setO] = useState<Overview | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [n, setN] = useState(0); // bump to reload
  useEffect(() => {
    const t = setTimeout(() => api(`/api/admin/overview?q=${encodeURIComponent(q)}`).then(setO).catch((e) => setErr(e.message)), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, n]);
  const cancel = async (b: Overview["recent"][number]) => {
    if (!confirm(`Cancel ${b.id} (${b.seats.join(", ")}) and refund the full ₹${b.total}${b.payment_id ? " through Razorpay" : ""}? This can't be undone.`)) return;
    try { const r = await api(`/api/admin/bookings/${b.id}/cancel`, "POST"); alert(`Cancelled. ₹${r.refundAmount} refunded.`); setN((x) => x + 1); }
    catch (e) { alert((e as Error).message); }
  };
  const title = (id: string) => movies.find((m) => m.id === id)?.title ?? id;
  if (err) return <p className="text-brand">{err}</p>;
  if (!o) return <p className="text-fg/60">Loading...</p>;
  const maxDay = Math.max(1, ...o.byDay.map((d) => d.revenue));
  const maxMovie = Math.max(1, ...o.byMovie.map((m) => m.revenue));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[["Revenue", rupees(o.revenue)], ["Today", rupees(o.today)], ["Bookings", o.bookings], ["Tickets sold", o.tickets], ["Customers", o.customers], ["Checked in", o.checked_in], ["Refunded", rupees(o.refunded)]].map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-xs uppercase tracking-wider text-fg/50">{l}</p><p className="mt-1 text-2xl font-black">{v}</p></div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <p className="mb-3 font-bold">Revenue, last 14 days</p>
          <div className="flex h-40 items-end gap-1.5">
            {o.byDay.map((d) => (
              <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end">
                <div className="w-full rounded-t bg-brand/80" style={{ height: `${(d.revenue / maxDay) * 100}%`, minHeight: d.revenue ? 4 : 1 }} title={`${d.day}: ${rupees(d.revenue)}`} />
                <span className="mt-1 text-[9px] text-fg/45">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <p className="mb-3 font-bold">Revenue by movie</p>
          <div className="space-y-2">
            {o.byMovie.map((m) => (
              <div key={m.movie_id} className="text-sm">
                <div className="flex justify-between"><span>{title(m.movie_id)}</span><span className="font-semibold">{rupees(m.revenue)} · {m.tickets} seats</span></div>
                <div className="mt-1 h-2 rounded-full bg-fg/10"><div className="h-full rounded-full bg-ink" style={{ width: `${(m.revenue / maxMovie) * 100}%` }} /></div>
              </div>
            ))}
            {!o.byMovie.length && <p className="text-sm text-fg/50">No sales yet.</p>}
          </div>
        </div>
      </div>
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-bold">Bookings</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticket id, name, email, mobile" className="input !w-72 !py-1.5 text-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-fg/50">
              <tr><th className="py-2 pr-3">Ticket</th><th className="pr-3">Customer</th><th className="pr-3">Movie</th><th className="pr-3">Show</th><th className="pr-3">Seats</th><th className="pr-3 text-right">Amount</th><th className="pr-3">Booked</th><th>Status</th></tr>
            </thead>
            <tbody>
              {o.recent.map((b) => (
                <tr key={b.id} className="border-t border-fg/10 align-top">
                  <td className="py-2 pr-3 font-mono text-xs"><Link href={`/ticket/${b.id}`} className="underline">{b.id}</Link></td>
                  <td className="pr-3">{b.customer ?? "Guest"}<div className="text-xs text-fg/50">{b.contact}</div></td>
                  <td className="pr-3">{title(b.movie_id)}</td>
                  <td className="pr-3 text-xs">{b.city} · {b.show_date} · {b.show_time}</td>
                  <td className="pr-3 text-xs">{b.seats.join(", ")}</td>
                  <td className="pr-3 text-right font-semibold">{rupees(b.total)}</td>
                  <td className="pr-3 text-xs text-fg/55">{new Date(b.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="text-xs">
                    {b.status === "cancelled" ? <span className="text-fg/55">Cancelled by {b.cancelled_by}{b.refund_amount ? ` · ₹${b.refund_amount} refunded` : ""}</span>
                      : b.checked_in_at ? <span className="font-semibold text-emerald-700">Checked in</span>
                      : <button onClick={() => cancel(b)} className="font-semibold text-brand underline">Cancel &amp; refund</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!o.recent.length && <p className="py-4 text-sm text-fg/50">{q ? "No bookings match." : "No bookings yet."}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- Movies ----------

const blankMovie = { id: "", title: "", lang: "Hindi", genre: "", rating: 8, duration: "2h 30m", year: new Date().getFullYear(), blurb: "", banner: "", trailer: "", active: true, sort: 100 };

function Movies({ data, changed }: { data: AdminData; changed: () => void }) {
  const [form, setForm] = useState<typeof blankMovie | null>(null);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof blankMovie, v: string | number | boolean) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const save = async () => {
    setErr("");
    try { await api("/api/admin/movies", "POST", { ...form, rating: Number(form!.rating), year: Number(form!.year), sort: Number(form!.sort) }); setForm(null); changed(); }
    catch (e) { setErr((e as Error).message); }
  };
  const remove = async (m: AdminMovie) => {
    if (!confirm(`Delete "${m.title}" with its showtimes and reviews? Tickets already sold are kept. To take it off the site for now, untick "Showing" instead.`)) return;
    await api(`/api/admin/movies?id=${encodeURIComponent(m.id)}`, "DELETE"); changed();
  };
  return (
    <div className="space-y-4">
      <button className="btn btn-brand" onClick={() => setForm({ ...blankMovie })}>+ Add movie</button>
      {form && (
        <div className="card grid gap-3 p-5 md:grid-cols-2">
          <p className="font-bold md:col-span-2">{form.id ? `Edit ${form.title}` : "New movie"}</p>
          <In label="Title" v={form.title} on={(v) => set("title", v)} />
          <In label="Language" v={form.lang} on={(v) => set("lang", v)} />
          <In label="Genre" v={form.genre} on={(v) => set("genre", v)} />
          <In label="Duration" v={form.duration} on={(v) => set("duration", v)} />
          <In label="Year" v={String(form.year)} on={(v) => set("year", v)} type="number" />
          <In label="Critics' rating (0-10)" v={String(form.rating)} on={(v) => set("rating", v)} type="number" step="0.1" />
          <In label="Key art image (https:// link or /posters/...)" v={form.banner} on={(v) => set("banner", v)} wide />
          <In label="Trailer (YouTube link or id)" v={form.trailer} on={(v) => set("trailer", v)} wide />
          <label className="text-sm md:col-span-2"><span className="mb-1 block font-semibold">Description</span>
            <textarea value={form.blurb} onChange={(e) => set("blurb", e.target.value)} rows={2} maxLength={400} className="input" /></label>
          <In label="Order (lower shows first)" v={String(form.sort)} on={(v) => set("sort", v)} type="number" />
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Showing on the site</label>
          {err && <p className="text-sm text-brand md:col-span-2">{err}</p>}
          <div className="flex gap-2 md:col-span-2"><button className="btn btn-brand" onClick={save}>Save</button><button className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {data.movies.map((m) => (
          <div key={m.id} className={`card flex gap-3 p-3 ${m.active ? "" : "opacity-55"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.banner ? <img src={m.banner} alt="" className="h-16 w-28 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-28 shrink-0 rounded-lg" style={{ background: `hsl(${m.hue} 60% 35%)` }} />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{m.title}{!m.active && <span className="ml-2 text-xs font-normal">(hidden)</span>}</p>
              <p className="text-xs text-fg/55">{m.lang} · {m.genre} · {m.year} · ★ {m.rating}{m.trailer ? " · trailer ✓" : ""}</p>
              <div className="mt-1 flex gap-3 text-xs font-semibold">
                <button className="text-brand" onClick={() => setForm({ ...blankMovie, ...m, banner: m.banner ?? "", trailer: m.trailer ?? "" })}>Edit</button>
                <button className="text-fg/50" onClick={() => remove(m)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Theatres ----------

function Theatres({ data, changed }: { data: AdminData; changed: () => void }) {
  const blank = { id: "", name: "", city: "Mumbai", km: 2, formats: ["2D"], layout: data.layouts[0], active: true };
  const [form, setForm] = useState<typeof blank | null>(null);
  const [err, setErr] = useState("");
  const cities = Array.from(new Set(data.theatres.map((t) => t.city)));
  const save = async () => {
    setErr("");
    try { await api("/api/admin/theatres", "POST", { ...form, km: Number(form!.km) }); setForm(null); changed(); }
    catch (e) { setErr((e as Error).message); }
  };
  const remove = async (t: AdminTheatre) => {
    if (!confirm(`Delete ${t.name}? Its showtimes go too. Tickets already sold are kept.`)) return;
    await api(`/api/admin/theatres?id=${encodeURIComponent(t.id)}`, "DELETE"); changed();
  };
  return (
    <div className="space-y-4">
      <button className="btn btn-brand" onClick={() => setForm({ ...blank })}>+ Add theatre</button>
      {form && (
        <div className="card grid gap-3 p-5 md:grid-cols-2">
          <p className="font-bold md:col-span-2">{form.id ? `Edit ${form.name}` : "New theatre"}</p>
          <In label="Name" v={form.name} on={(v) => setForm({ ...form, name: v })} />
          <label className="text-sm"><span className="mb-1 block font-semibold">City (pick or type a new one)</span>
            <input list="cities" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" />
            <datalist id="cities">{cities.map((c) => <option key={c} value={c} />)}</datalist></label>
          <In label="Distance from centre (km)" v={String(form.km)} on={(v) => setForm({ ...form, km: Number(v) })} type="number" step="0.1" />
          <label className="text-sm"><span className="mb-1 block font-semibold">Seat layout</span>
            <select value={form.layout} onChange={(e) => setForm({ ...form, layout: e.target.value })} className="input">
              {data.layouts.map((l) => <option key={l} value={l}>{l} ({getLayout(l).seatIds.length} seats)</option>)}
            </select></label>
          <div className="text-sm md:col-span-2"><span className="mb-1 block font-semibold">Formats</span>
            <div className="flex flex-wrap gap-2">{FORMATS.map((f) => (
              <button key={f} type="button" onClick={() => setForm({ ...form, formats: form.formats.includes(f) ? form.formats.filter((x) => x !== f) : [...form.formats, f] })}
                className={`chip ${form.formats.includes(f) ? "chip-on" : "chip-off"}`}>{f}</button>
            ))}</div></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Open for booking</label>
          {err && <p className="text-sm text-brand md:col-span-2">{err}</p>}
          <div className="flex gap-2 md:col-span-2"><button className="btn btn-brand" onClick={save}>Save</button><button className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}
      {cities.map((c) => (
        <div key={c}>
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-fg/50">{c}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {data.theatres.filter((t) => t.city === c).map((t) => (
              <div key={t.id} className={`card flex items-center justify-between gap-3 p-3 text-sm ${t.active ? "" : "opacity-55"}`}>
                <div className="min-w-0"><p className="truncate font-semibold">{t.name}</p><p className="text-xs text-fg/55">{t.km} km · {t.formats.join(", ")} · {t.layout} layout{t.active ? "" : " · closed"}</p></div>
                <div className="flex shrink-0 gap-3 text-xs font-semibold">
                  <button className="text-brand" onClick={() => setForm({ ...t })}>Edit</button>
                  <button className="text-fg/50" onClick={() => remove(t)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Showtimes ----------

function Showtimes({ data, changed }: { data: AdminData; changed: () => void }) {
  const [movieId, setMovieId] = useState(data.movies[0]?.id ?? "");
  const [theatreId, setTheatreId] = useState(data.theatres[0]?.id ?? "");
  const theatre = data.theatres.find((t) => t.id === theatreId);
  const [time, setTime] = useState("18:30");
  const [format, setFormat] = useState(theatre?.formats[0] ?? "2D");
  const [err, setErr] = useState("");
  const own = data.shows.filter((s) => s.movieId === movieId && s.theatreId === theatreId);
  const add = async () => {
    setErr("");
    try { await api("/api/admin/shows", "POST", { movieId, theatreId, time, format }); changed(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="card space-y-4 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-semibold">Movie</span>
          <select value={movieId} onChange={(e) => setMovieId(e.target.value)} className="input">{data.movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Theatre</span>
          <select value={theatreId} onChange={(e) => { setTheatreId(e.target.value); setFormat(data.theatres.find((t) => t.id === e.target.value)?.formats[0] ?? "2D"); }} className="input">
            {data.theatres.map((t) => <option key={t.id} value={t.id}>{t.city}: {t.name}</option>)}</select></label>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Daily showtimes</p>
        {own.length ? (
          <div className="flex flex-wrap gap-2">
            {own.map((s) => (
              <span key={s.id} className="chip chip-off flex items-center gap-2">{showLabel(s.time)} · {s.format}
                <button aria-label="Remove" className="text-brand" onClick={async () => { await api(`/api/admin/shows?id=${s.id}`, "DELETE"); changed(); }}>✕</button></span>
            ))}
          </div>
        ) : <p className="text-sm text-fg/55">None set, so customers see automatic showtimes here. Add one to set them yourself.</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className="mb-1 block font-semibold">Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input !w-36" /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="input !w-36">{theatre?.formats.map((f) => <option key={f}>{f}</option>)}</select></label>
        <button className="btn btn-brand" onClick={add}>Add showtime</button>
      </div>
      {err && <p className="text-sm text-brand">{err}</p>}
    </div>
  );
}

// ---------- Block seats ----------

function BlockSeats({ data }: { data: AdminData }) {
  useCatalog(); // showtimes come from the live catalogue, as customers see them
  const live = data.movies.filter((m) => m.active);
  const [movieId, setMovieId] = useState(live[0]?.id ?? "");
  const [theatreId, setTheatreId] = useState(data.theatres.find((t) => t.active)?.id ?? "");
  const dates = bookableDates();
  const [date, setDate] = useState(dates[0]);
  const theatre = data.theatres.find((t) => t.id === theatreId);
  const shows = useMemo(() => (theatre ? getShows(movieId, theatre.city, date).find((t) => t.theatre.id === theatreId)?.shows ?? [] : []), [movieId, theatre, theatreId, date]);
  const [showId, setShowId] = useState("");
  const show = shows.find((s) => s.id === showId) ?? shows[0];
  const showKey = show ? `${movieId}|${show.id}|${date}` : "";
  const [booked, setBooked] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<{ id: string; seats: string[] }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(() => {
    if (!showKey) return;
    fetch(`/api/shows/${encodeURIComponent(showKey)}/booked-seats`, { cache: "no-store" }).then((r) => r.json()).then((d) => setBooked(d.seats ?? []));
    api(`/api/admin/blocks?showKey=${encodeURIComponent(showKey)}`).then((d) => setBlocks(d.blocks));
  }, [showKey]);
  useEffect(() => { setPicked([]); setMsg(""); refresh(); }, [refresh]);

  const layout = theatre ? getLayout(theatre.layout) : null;
  const blockedSet = new Set(blocks.flatMap((b) => b.seats));
  const block = async () => {
    setMsg("");
    try {
      await api("/api/admin/blocks", "POST", { movieId, theatreId, date, showId: show!.id, seats: picked });
      setMsg(`Blocked ${picked.join(", ")}`); setPicked([]); refresh();
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-5 md:grid-cols-4">
        <label className="text-sm"><span className="mb-1 block font-semibold">Movie</span>
          <select value={movieId} onChange={(e) => setMovieId(e.target.value)} className="input">{live.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Theatre</span>
          <select value={theatreId} onChange={(e) => setTheatreId(e.target.value)} className="input">
            {data.theatres.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.city}: {t.name}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Date</span>
          <select value={date} onChange={(e) => setDate(e.target.value)} className="input">{dates.map((d) => <option key={d} value={d}>{dateLabel(d, true)}</option>)}</select></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Show</span>
          <select value={show?.id ?? ""} onChange={(e) => setShowId(e.target.value)} className="input">{shows.map((s) => <option key={s.id} value={s.id}>{s.time} · {s.format}</option>)}</select></label>
      </div>
      {blocks.length > 0 && (
        <div className="card p-4 text-sm">
          <p className="mb-2 font-semibold">Blocked for this show</p>
          <div className="flex flex-wrap gap-2">{blocks.map((b) => (
            <span key={b.id} className="chip chip-off flex items-center gap-2">{b.seats.join(", ")}
              <button className="text-brand" onClick={async () => { await api(`/api/admin/blocks?id=${b.id}`, "DELETE"); refresh(); }}>Release</button></span>
          ))}</div>
        </div>
      )}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <p>{picked.length ? `Selected: ${picked.join(", ")}` : "Tap free seats to select them. Grey seats are sold, held or already blocked."}</p>
        <div className="flex gap-2">
          {picked.length > 0 && <button className="btn btn-ghost !py-1.5" onClick={() => setPicked([])}>Clear</button>}
          <button disabled={!picked.length} className="btn btn-brand !py-1.5 disabled:opacity-50" onClick={block}>Block {picked.length || ""} seat{picked.length === 1 ? "" : "s"}</button>
        </div>
      </div>
      {msg && <p className="text-sm font-semibold text-brand">{msg}</p>}
      {layout && (
        <div className="card overflow-hidden p-2">
          <SeatMap layout={layout} sold={new Set([...soldSeatsFor(showKey, show!.fill, layout.seatIds), ...booked, ...blockedSet])} picked={picked} bestseller={new Set()}
            onPick={(id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))} />
        </div>
      )}
    </div>
  );
}

// ---------- Check-in ----------

type CheckResult = {
  result: "ok" | "used" | "cancelled" | "wrong-day" | "invalid"; error?: string;
  ticket?: { id: string; customer: string | null; checkedInAt?: number; booking: { movieId: string; date: string; time: string; seats: string[]; theatreId: string } };
};

function CheckIn({ movies }: { movies: AdminMovie[] }) {
  const [camera, setCamera] = useState(false);
  const [code, setCode] = useState("");
  const [res, setRes] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const title = (id: string) => movies.find((m) => m.id === id)?.title ?? id;

  const check = async (text: string, force = false) => {
    setBusy(true);
    const r = await fetch("/api/admin/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: text, force }) });
    const d: CheckResult = await r.json().catch(() => ({ result: "invalid", error: "Something went wrong" }));
    setRes(d); setBusy(false);
    if (navigator.vibrate) navigator.vibrate(d.result === "ok" ? 80 : [60, 60, 60]);
  };

  const tone = !res ? "" : res.result === "ok" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : res.result === "wrong-day" ? "border-gold bg-gold/10" : "border-brand bg-brand/10";
  const t = res?.ticket;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-3">
        {camera ? <QrScanner onCode={(text) => { if (!busy) check(text); }} />
          : <button onClick={() => setCamera(true)} className="btn btn-brand w-full max-w-sm !py-4">📷 Scan tickets with the camera</button>}
        {camera && <button onClick={() => setCamera(false)} className="btn btn-ghost !py-1.5 text-sm">Stop camera</button>}
        <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) check(code); }} className="flex max-w-sm gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type the ticket id, e.g. PMS1A2B3C4D" className="input !py-2 text-sm" />
          <button disabled={busy} className="btn btn-ghost !py-2 text-sm">Check</button>
        </form>
      </div>
      <div>
        {res ? (
          <div className={`rounded-2xl border-2 p-5 ${tone}`}>
            <p className="text-2xl font-black">
              {res.result === "ok" ? "✓ Let them in" : res.result === "used" ? "✕ Already used" : res.result === "cancelled" ? "✕ Cancelled ticket" : res.result === "wrong-day" ? "⚠ Wrong day" : "✕ Not valid"}
            </p>
            {res.result !== "ok" && <p className="mt-1 text-sm">{res.error}</p>}
            {t && (
              <div className="mt-3 space-y-0.5 text-sm">
                <p className="font-semibold">{title(t.booking.movieId)}</p>
                <p>{t.booking.date} · {t.booking.time}</p>
                <p>Seats <b>{t.booking.seats.join(", ")}</b> · {t.id}</p>
                {t.customer && <p>Booked by {t.customer}</p>}
                {res.result === "used" && t.checkedInAt && <p>Scanned at {new Date(t.checkedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>}
              </div>
            )}
            {res.result === "wrong-day" && t && <button onClick={() => check(t.id, true)} className="btn btn-ghost mt-3 !py-1.5 text-sm">Let in anyway</button>}
          </div>
        ) : <p className="text-sm text-fg/55">Scan the QR on a customer&apos;s ticket. Each ticket works once, on the day of its show.</p>}
      </div>
    </div>
  );
}

// ---------- Customers ----------

type Customer = { id: string; name: string; email: string | null; phone: string | null; role: string; email_verified: boolean; created_at: string; tickets: number; spent: number };

function Customers({ me }: { me: string }) {
  const [list, setList] = useState<Customer[] | null>(null);
  const [q, setQ] = useState("");
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => api(`/api/admin/users?q=${encodeURIComponent(q)}`).then((d) => setList(d.users)).catch(() => setList([])), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, n]);
  const act = async (u: Customer, action: string) => {
    if (action === "reset" && !confirm(`Give ${u.name} a new temporary password? They are signed out on every device.`)) return;
    try {
      const r = await api("/api/admin/users", "POST", { id: u.id, action });
      if (r.password) prompt(`Temporary password for ${u.name}. Tell them to sign in with it, then they can keep using it:`, r.password);
      setN((x) => x + 1);
    } catch (e) { alert((e as Error).message); }
  };
  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold">Customers</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, mobile" className="input !w-64 !py-1.5 text-sm" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-fg/50">
            <tr><th className="py-2 pr-3">Name</th><th className="pr-3">Email</th><th className="pr-3">Mobile</th><th className="pr-3 text-right">Tickets</th><th className="pr-3 text-right">Spent</th><th className="pr-3">Joined</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {list?.map((u) => (
              <tr key={u.id} className="border-t border-fg/10 align-top">
                <td className="py-2 pr-3 font-semibold">{u.name}{u.role === "admin" && <span className="ml-1 rounded bg-ink px-1.5 text-[10px] text-white">ADMIN</span>}</td>
                <td className="pr-3 text-xs">{u.email}{u.email && <div className={u.email_verified ? "text-emerald-700" : "text-fg/45"}>{u.email_verified ? "✓ confirmed" : "not confirmed"}</div>}</td>
                <td className="pr-3 text-xs">{u.phone ?? "–"}</td>
                <td className="pr-3 text-right">{u.tickets}</td>
                <td className="pr-3 text-right">{rupees(u.spent)}</td>
                <td className="pr-3 text-xs text-fg/55">{new Date(u.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                <td className="space-x-3 whitespace-nowrap text-xs font-semibold">
                  <button className="text-brand" onClick={() => act(u, "reset")}>Reset password</button>
                  {!u.email_verified && <button className="text-fg/60" onClick={() => act(u, "verify")}>Mark confirmed</button>}
                  {u.id !== me && <button className="text-fg/60" onClick={() => act(u, u.role === "admin" ? "user" : "admin")}>{u.role === "admin" ? "Remove admin" : "Make admin"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list && !list.length && <p className="py-4 text-sm text-fg/50">No customers yet.</p>}
      </div>
    </div>
  );
}

// ---------- Prices: seats per theatre, and snacks ----------

function Prices({ data, changed }: { data: AdminData; changed: () => void }) {
  const [theatreId, setTheatreId] = useState(data.theatres[0]?.id ?? "");
  const theatre = data.theatres.find((t) => t.id === theatreId);
  // The layout's own sections and prices, then this theatre's changes on top.
  const sections = useMemo(() => {
    if (!theatre) return [];
    const out: { name: string; base: number; seats: number }[] = [];
    for (const r of getLayout(theatre.layout).rows) {
      const s = out.find((x) => x.name === r.section);
      if (s) s.seats += r.seats.length; else out.push({ name: r.section, base: r.price, seats: r.seats.length });
    }
    return out;
  }, [theatre]);
  const own = data.seatPrices[theatreId] ?? {};
  const [edit, setEdit] = useState<Record<string, string>>({});
  useEffect(() => setEdit(Object.fromEntries(sections.map((s) => [s.name, String(own[s.name] ?? s.base)]))), [theatreId, sections, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [msg, setMsg] = useState("");
  const saveSeats = async () => {
    setMsg("");
    try { await api("/api/admin/prices", "POST", { theatreId, prices: Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, Number(v)])) }); setMsg("Seat prices saved."); changed(); }
    catch (e) { setMsg((e as Error).message); }
  };

  const [snack, setSnack] = useState<AdminSnack | null>(null);
  const saveSnack = async () => {
    try { await api("/api/admin/snacks", "POST", { ...snack, price: Number(snack!.price) }); setSnack(null); changed(); }
    catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card space-y-3 p-5">
        <p className="font-bold">Seat prices</p>
        <select value={theatreId} onChange={(e) => setTheatreId(e.target.value)} className="input">
          {data.theatres.map((t) => <option key={t.id} value={t.id}>{t.city}: {t.name}</option>)}
        </select>
        {sections.map((s) => (
          <label key={s.name} className="flex items-center justify-between gap-3 text-sm">
            <span>{s.name} <span className="text-xs text-fg/45">({s.seats} seats{Number(edit[s.name]) !== s.base ? `, usually ₹${s.base}` : ""})</span></span>
            <span className="flex items-center gap-1">₹<input type="number" min={1} value={edit[s.name] ?? ""} onChange={(e) => setEdit({ ...edit, [s.name]: e.target.value })} className="input !w-24 !py-1.5 text-right" /></span>
          </label>
        ))}
        <div className="flex items-center gap-3">
          <button onClick={saveSeats} className="btn btn-brand !py-1.5">Save seat prices</button>
          {msg && <span className="text-sm text-fg/60">{msg}</span>}
        </div>
        <p className="text-xs text-fg/50">New prices apply to new bookings straight away. Tickets already sold keep their price.</p>
      </div>

      <div className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="font-bold">Snacks</p>
          <button onClick={() => setSnack({ id: "", name: "", price: 150, emoji: "🍿", active: true, sort: 100 })} className="btn btn-ghost !py-1 text-sm">+ Add snack</button>
        </div>
        {snack && (
          <div className="grid grid-cols-[3.5rem_1fr_6rem] gap-2 rounded-xl bg-fg/5 p-3 text-sm">
            <input value={snack.emoji} onChange={(e) => setSnack({ ...snack, emoji: e.target.value })} className="input !px-2 text-center" maxLength={4} aria-label="Emoji" />
            <input value={snack.name} onChange={(e) => setSnack({ ...snack, name: e.target.value })} placeholder="Name" className="input" />
            <input type="number" min={1} value={snack.price} onChange={(e) => setSnack({ ...snack, price: Number(e.target.value) })} className="input text-right" aria-label="Price" />
            <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={snack.active} onChange={(e) => setSnack({ ...snack, active: e.target.checked })} /> On the menu</label>
            <div className="flex justify-end gap-2"><button onClick={() => setSnack(null)} className="text-fg/55">Cancel</button><button onClick={saveSnack} className="font-semibold text-brand">Save</button></div>
          </div>
        )}
        {data.snacks.map((s) => (
          <div key={s.id} className={`flex items-center justify-between text-sm ${s.active ? "" : "opacity-50"}`}>
            <span>{s.emoji} {s.name}{!s.active && " (hidden)"}</span>
            <span className="flex items-center gap-3"><b>₹{s.price}</b><button onClick={() => setSnack({ ...s })} className="text-xs font-semibold text-brand">Edit</button></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function In({ label, v, on, type = "text", step, wide }: { label: string; v: string; on: (v: string) => void; type?: string; step?: string; wide?: boolean }) {
  return (
    <label className={`text-sm ${wide ? "md:col-span-2" : ""}`}>
      <span className="mb-1 block font-semibold">{label}</span>
      <input value={v} onChange={(e) => on(e.target.value)} type={type} step={step} className="input" />
    </label>
  );
}
