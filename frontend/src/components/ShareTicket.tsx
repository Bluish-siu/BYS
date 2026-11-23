"use client";
import { useState } from "react";
import { findTheatre, getMovie } from "@/lib/catalog";
import type { Ticket } from "@/lib/store";

type AppBridge = { share: (title: string, text: string) => void };

/**
 * Shares a ticket link. Uses the phone's share sheet (the Android app's own, or the browser's),
 * and falls back to WhatsApp and copy-link buttons on desktop browsers.
 */
export default function ShareTicket({ ticket }: { ticket: Ticket }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const b = ticket.booking;
  const movie = getMovie(b.movieId)?.title ?? "a movie";
  const url = `${window.location.origin}/ticket/${ticket.id}`;
  const text = `🎬 ${movie} at ${findTheatre(b.theatreId).name}, ${b.time}. Seats ${b.seats.join(", ")}. Ticket: ${url}`;

  const share = async () => {
    const app = (window as unknown as { PickMySeatApp?: AppBridge }).PickMySeatApp;
    if (app) return app.share(`Ticket for ${movie}`, text);
    if (navigator.share) {
      try { await navigator.share({ title: `Ticket for ${movie}`, text, url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    setOpen(!open);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copy this link", url); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button onClick={share} className="btn btn-brand">
        <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
        Share ticket
      </button>
      {open && (
        <div className="card absolute left-0 top-12 z-10 flex w-56 flex-col p-2 text-sm shadow-xl">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2 hover:bg-fg/5">Share on WhatsApp</a>
          <button onClick={copy} className="rounded-lg px-3 py-2 text-left hover:bg-fg/5">{copied ? "Link copied ✓" : "Copy link"}</button>
        </div>
      )}
    </div>
  );
}
