"use client";
import Link from "next/link";
import TicketCard from "@/components/TicketCard";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/pricing";

export default function TicketsPage() {
  const ready = useHydrated();
  const tickets = useStore((s) => s.tickets);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-5 text-3xl font-black">My tickets</h1>
      {!ready ? null : tickets.length === 0 ? (
        <p className="text-white/60">No tickets yet. <Link href="/movies" className="text-brand underline">Find a movie</Link></p>
      ) : (
        <div className="space-y-4">{tickets.map((t) => <TicketCard key={t.id} ticket={t} link />)}</div>
      )}
    </div>
  );
}
