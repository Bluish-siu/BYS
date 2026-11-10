"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMovie, snacks, findTheatre } from "@/lib/data";
import { useStore } from "@/lib/store";
import { FEE, dayLabel, grandTotal, seatsTotal, useHydrated } from "@/lib/pricing";

export default function PayPage() {
  const ready = useHydrated();
  const router = useRouter();
  const { booking, setBooking, addTicket } = useStore();
  const [method, setMethod] = useState("upi");
  const [paying, setPaying] = useState(false);
  useEffect(() => { if (ready && !paying && (!booking || !booking.seats.length)) router.replace("/"); }, [ready, paying, booking, router]);
  if (!ready || !booking) return <p className="p-10 text-white/60">Loading...</p>;

  const movie = getMovie(booking.movieId)!;
  const theatre = findTheatre(booking.theatreId);
  const total = grandTotal(booking);

  const pay = () => {
    setPaying(true);
    // Demo payment: no real charge, just a short delay before issuing the ticket.
    setTimeout(() => {
      const id = "CV" + Math.random().toString(36).slice(2, 8).toUpperCase();
      addTicket({ id, booking, total, at: Date.now() });
      setBooking(null);
      router.replace(`/ticket/${id}`);
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-black">Review &amp; pay</h1>
      <div className="card space-y-2 p-5 text-sm">
        <p className="text-lg font-bold">{movie.title}</p>
        <p className="text-white/60">{theatre.name} · {booking.city} · {dayLabel(booking.day)} · {booking.time} · {booking.format}</p>
        <hr className="border-white/10" />
        <Row l={`Seats ${booking.seats.join(", ")}`} r={`₹${seatsTotal(booking)}`} />
        {Object.entries(booking.snacks).map(([id, q]) => {
          const s = snacks.find((x) => x.id === id)!;
          return <Row key={id} l={`${s.name} × ${q}`} r={`₹${s.price * q}`} />;
        })}
        <Row l="Convenience fee" r={`₹${FEE}`} />
        <hr className="border-white/10" />
        <div className="flex justify-between text-lg font-bold"><span>Total</span><span>₹{total}</span></div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[["upi", "UPI"], ["card", "Card"], ["wallet", "Wallet"]].map(([id, l]) => (
          <button key={id} onClick={() => setMethod(id)} className={`btn ${method === id ? "btn-brand" : "btn-ghost"}`}>{l}</button>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/40">Demo only. No real payment is taken and no details are collected.</p>

      <div className="mt-6 flex gap-2">
        <button className="btn btn-ghost" onClick={() => router.push("/book/snacks")}>Back</button>
        <button disabled={paying} className="btn btn-brand flex-1 disabled:opacity-60" onClick={pay}>{paying ? "Processing..." : `Pay ₹${total}`}</button>
      </div>
    </div>
  );
}

function Row({ l, r }: { l: string; r: string }) {
  return <div className="flex justify-between"><span>{l}</span><span>{r}</span></div>;
}
