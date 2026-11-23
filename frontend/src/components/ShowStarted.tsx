"use client";
import Link from "next/link";

/** Shown instead of the booking steps once the chosen show has started. */
export default function ShowStarted({ movieId, time }: { movieId: string; time: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-4xl">⏰</p>
      <h1 className="mt-3 text-2xl font-black">The {time} show has started</h1>
      <p className="mt-2 text-fg/60">Tickets close when a show begins. Your seats weren&apos;t charged. Pick a later show or another day.</p>
      <Link href={`/movie/${movieId}`} className="btn btn-brand mt-6">Choose another show</Link>
    </div>
  );
}
