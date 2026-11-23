"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ShareTicket from "@/components/ShareTicket";
import TicketCard from "@/components/TicketCard";
import { useStore, type Ticket } from "@/lib/store";
import { useHydrated } from "@/lib/pricing";

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const ready = useHydrated();
  const mine = useStore((s) => s.tickets.find((t) => t.id === id));
  const [remote, setRemote] = useState<Ticket | null | undefined>(undefined);

  // Not on this device (a shared link, or bought on another phone): fetch it from the server.
  useEffect(() => {
    if (!ready || mine) return;
    fetch(`/api/bookings/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then(setRemote).catch(() => setRemote(null));
  }, [ready, mine, id]);

  const ticket = mine ?? remote;
  if (!ready || (!mine && remote === undefined)) return <p className="p-10 text-fg/60">Loading...</p>;
  if (!ticket) return <p className="p-10">Ticket not found. Check the link, or sign in to see tickets saved to your account.</p>;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-black">{mine ? "You're in! 🎉" : "Movie ticket"}</h1>
      <p className="mb-5 text-fg/60">Show this QR at the entrance.</p>
      <TicketCard ticket={ticket} />
      <div className="mt-6 flex flex-wrap gap-2">
        <ShareTicket ticket={ticket} />
        <Link href="/tickets" className="btn btn-ghost">My tickets</Link>
        <Link href="/" className="btn btn-ghost">Book another</Link>
      </div>
    </div>
  );
}
