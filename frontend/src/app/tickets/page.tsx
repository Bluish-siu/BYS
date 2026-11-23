"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TicketCard from "@/components/TicketCard";
import { useStore, type Ticket } from "@/lib/store";
import { useHydrated } from "@/lib/pricing";
import { useAccount } from "@/lib/auth";

export default function TicketsPage() {
  const ready = useHydrated();
  const local = useStore((s) => s.tickets);
  const { loaded, enabled, user } = useAccount();
  const [saved, setSaved] = useState<Ticket[] | null>(null);

  // Tickets saved to the account (bought on any device).
  useEffect(() => {
    if (!user) { setSaved(null); return; }
    fetch("/api/me/tickets", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { tickets: [] })).then((d) => setSaved(d.tickets)).catch(() => setSaved([]));
  }, [user]);

  // Account tickets first, plus any bought on this device before signing in.
  const tickets = useMemo(() => {
    const byId = new Map<string, Ticket>();
    for (const t of [...(saved ?? []), ...local]) if (!byId.has(t.id)) byId.set(t.id, t);
    return [...byId.values()].sort((a, b) => b.at - a.at);
  }, [saved, local]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-black">My tickets</h1>
      {loaded && enabled && !user && (
        <p className="mb-5 text-sm text-fg/60">
          <Link href="/login?next=/tickets" className="font-semibold text-brand underline">Sign in</Link> to see tickets saved to your account on any device.
        </p>
      )}
      {user && <p className="mb-5 text-sm text-fg/60">Saved to {user.name}&apos;s account.</p>}
      {!ready || (user && saved === null) ? <p className="text-fg/60">Loading...</p> : tickets.length === 0 ? (
        <p className="text-fg/60">No tickets yet. <Link href="/movies" className="text-brand underline">Find a movie</Link></p>
      ) : (
        <div className="space-y-4">{tickets.map((t) => <TicketCard key={t.id} ticket={t} link />)}</div>
      )}
    </div>
  );
}
