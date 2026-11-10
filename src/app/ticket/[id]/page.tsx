"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import TicketCard from "@/components/TicketCard";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/pricing";

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const ready = useHydrated();
  const ticket = useStore((s) => s.tickets.find((t) => t.id === id));
  if (!ready) return <p className="p-10 text-white/60">Loading...</p>;
  if (!ticket) return <p className="p-10">Ticket not found on this device.</p>;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-black">You&apos;re in! 🎉</h1>
      <p className="mb-5 text-white/60">Show this QR at the entrance.</p>
      <TicketCard ticket={ticket} />
      <div className="mt-6 flex gap-2">
        <Link href="/tickets" className="btn btn-ghost">My tickets</Link>
        <Link href="/" className="btn btn-brand">Book another</Link>
      </div>
    </div>
  );
}
