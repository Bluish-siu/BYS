"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ShareTicket from "@/components/ShareTicket";
import TicketCard from "@/components/TicketCard";
import { useStore, type Ticket } from "@/lib/store";
import { FEE, useHydrated, useNow } from "@/lib/pricing";

const CANCEL_UNTIL_MIN = 30; // same rule as the server

/** When the show starts (India time), from "2026-11-25" and "07:00 PM". */
function startMs(date: string, label: string) {
  const m = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  const [y, mo, d] = date.split("-").map(Number);
  if (!m) return NaN;
  return Date.UTC(y, mo - 1, d, (Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0), Number(m[2])) - 330 * 60_000;
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const ready = useHydrated();
  const now = useNow();
  const mine = useStore((s) => s.tickets.find((t) => t.id === id));
  const { addTicket, setBooking } = useStore();
  const [remote, setRemote] = useState<Ticket | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState("");

  // The server copy has the latest status (cancelled, checked in). The copy on this phone still opens offline.
  const load = useCallback(() => fetch(`/api/bookings/${encodeURIComponent(id)}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null)).then((t: Ticket | null) => {
      setRemote(t);
      if (t && new URLSearchParams(window.location.search).get("paid")) {
        // Back from Razorpay's redirect flow (Android app): keep the ticket on this phone and end the booking.
        addTicket({ ...t, mine: undefined });
        setBooking(null);
        window.history.replaceState(null, "", `/ticket/${t.id}`);
      } else if (t && mine) addTicket({ ...mine, ...t, mine: undefined }); // refresh the saved copy's status
      return t;
    }).catch(() => setRemote(null)), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const ticket = remote ? { ...mine, ...remote } as Ticket : mine;
  if (!ready || (!mine && remote === undefined)) return <p className="p-10 text-fg/60">Loading...</p>;
  if (!ticket) return <p className="p-10">Ticket not found. Check the link, or sign in to see tickets saved to your account.</p>;

  const cancelled = ticket.status === "cancelled";
  const deadline = startMs(ticket.booking.date, ticket.booking.time) - CANCEL_UNTIL_MIN * 60_000;
  const canCancel = Boolean(remote?.mine) && !cancelled && !ticket.checkedInAt && now < deadline;
  const refund = ticket.paymentId ? Math.max(0, ticket.total - FEE) : 0;

  const cancel = async () => {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/bookings/${encodeURIComponent(ticket.id)}/cancel`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false); setConfirming(false);
    if (!r.ok) return setMsg(d.error ?? "Couldn't cancel. Please try again.");
    setMsg(d.refundAmount ? `Cancelled. ₹${d.refundAmount} is being refunded to your original payment method (Razorpay test mode).` : "Cancelled. Your seats are free for others now.");
    load();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-black">{cancelled ? "Ticket cancelled" : ticket.checkedInAt ? "Enjoy the movie 🍿" : mine ? "You're in! 🎉" : "Movie ticket"}</h1>
      <p className="mb-5 text-fg/60">
        {cancelled ? "This ticket can't be used." : ticket.checkedInAt ? "This ticket was scanned at the entrance." : "Show this QR at the entrance."}
      </p>
      <TicketCard ticket={ticket} />
      {msg && <p className="mt-4 rounded-xl border border-fg/15 bg-card p-3 text-sm">{msg}</p>}
      <div className="mt-6 flex flex-wrap gap-2">
        {!cancelled && <ShareTicket ticket={ticket} />}
        <Link href="/tickets" className="btn btn-ghost">My tickets</Link>
        <Link href="/" className="btn btn-ghost">Book another</Link>
      </div>

      {canCancel && (
        <div className="card mt-6 p-4 text-sm">
          {!confirming ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-fg/65">Plans changed? Cancel until {CANCEL_UNTIL_MIN} minutes before the show{refund ? `, and get ₹${refund} back (the ₹${FEE} convenience fee isn't refunded)` : ""}.</p>
              <button onClick={() => setConfirming(true)} className="btn btn-ghost !py-1.5">Cancel ticket</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold">Cancel seats {ticket.booking.seats.join(", ")}{refund ? ` and refund ₹${refund}` : ""}? This can&apos;t be undone.</p>
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => setConfirming(false)} className="btn btn-ghost !py-1.5">Keep it</button>
                <button disabled={busy} onClick={cancel} className="btn btn-brand !py-1.5 disabled:opacity-60">{busy ? "Cancelling..." : "Yes, cancel"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
