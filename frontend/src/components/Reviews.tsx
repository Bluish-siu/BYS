"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog";

type Review = { id: number; rating: number; comment: string; at: string; name: string; mine: boolean };
type Data = { enabled: boolean; avg: number; count: number; stars: number[]; reviews: Review[]; mine: { rating: number; comment: string } | null };

const Stars = ({ n, size = "text-base" }: { n: number; size?: string }) => (
  <span className={`${size} tracking-tight`} aria-label={`${n} out of 5 stars`}>
    <span className="text-gold">{"★".repeat(n)}</span><span className="text-fg/20">{"★".repeat(5 - n)}</span>
  </span>
);

/** Audience ratings (1 to 5 stars) and written reviews for one movie. Signed-in customers can add, change or delete theirs. */
export default function Reviews({ movieId }: { movieId: string }) {
  const { user } = useAccount();
  const path = usePathname();
  const [data, setData] = useState<Data | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    fetch(`/api/reviews?movie=${encodeURIComponent(movieId)}`, { cache: "no-store" }).then((r) => r.json()).then((d: Data) => {
      setData(d);
      if (d.mine) { setRating(d.mine.rating); setComment(d.mine.comment); }
    }).catch(() => setData(null));
  }, [movieId]);
  useEffect(load, [load, user]);

  if (!data?.enabled) return null;

  const save = async () => {
    if (!rating) return setMsg("Pick 1 to 5 stars first.");
    setBusy(true); setMsg("");
    const r = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ movieId, rating, comment }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(d.error ?? "Couldn't save your review.");
    setEditing(false); load(); loadCatalog(true);
  };
  const remove = async () => {
    setBusy(true);
    await fetch(`/api/reviews?movie=${encodeURIComponent(movieId)}`, { method: "DELETE" });
    setBusy(false); setRating(0); setComment(""); load(); loadCatalog(true);
  };

  const showForm = user && (!data.mine || editing);
  return (
    <section className="mx-auto max-w-4xl px-4 pb-12">
      <h2 className="mb-4 text-2xl font-bold">Ratings &amp; reviews</h2>
      <div className="card grid gap-6 p-5 sm:grid-cols-[180px_1fr]">
        <div className="text-center sm:border-r sm:border-fg/10 sm:pr-6">
          <p className="text-5xl font-black">{data.count ? data.avg.toFixed(1) : "–"}</p>
          <Stars n={Math.round(data.avg)} size="text-xl" />
          <p className="mt-1 text-xs text-fg/55">{data.count} review{data.count === 1 ? "" : "s"}</p>
        </div>
        <div className="space-y-1.5 self-center">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = data.stars[n - 1];
            return (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-6 text-fg/60">{n}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-gold" style={{ width: `${data.count ? (c / data.count) * 100 : 0}%` }} /></div>
                <span className="w-6 text-right text-fg/50">{c}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!user ? (
        <p className="mt-4 text-sm text-fg/60"><Link href={`/login?next=${encodeURIComponent(path)}`} className="font-semibold text-brand underline">Sign in</Link> to rate this movie.</p>
      ) : showForm ? (
        <div className="card mt-4 space-y-3 p-5">
          <p className="font-semibold">{data.mine ? "Edit your review" : "Rate this movie"}</p>
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}
                className={`text-3xl leading-none transition hover:scale-110 ${(hover || rating) >= n ? "text-gold" : "text-fg/20"}`}>★</button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="What did you think? (optional)" className="input" />
          {msg && <p className="text-sm text-brand">{msg}</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={save} className="btn btn-brand disabled:opacity-60">{busy ? "Saving..." : "Post review"}</button>
            {editing && <button onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-fg/60">You rated this <Stars n={data.mine!.rating} /></span>
          <button onClick={() => setEditing(true)} className="font-semibold text-brand underline">Edit</button>
          <button disabled={busy} onClick={remove} className="text-fg/50 underline">Delete</button>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {data.reviews.map((r) => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{r.name}{r.mine && <span className="ml-1 text-xs font-normal text-fg/50">(you)</span>}</p>
              <p className="text-xs text-fg/45">{new Date(r.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
            <Stars n={r.rating} />
            {r.comment && <p className="mt-1 text-sm text-fg/80">{r.comment}</p>}
          </div>
        ))}
        {!data.reviews.length && <p className="text-sm text-fg/50">No reviews yet. Be the first to rate it.</p>}
      </div>
    </section>
  );
}
