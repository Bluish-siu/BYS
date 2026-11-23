"use client";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { allMovies, findTheatre, getMovie } from "@/lib/catalog";
import { useCatalog } from "@/lib/use-catalog";
import type { Ticket } from "@/lib/store";
import { dateLabel } from "@/lib/dates";

export default function TicketCard({ ticket, link = false }: { ticket: Ticket; link?: boolean }) {
  const [qr, setQr] = useState("");
  useCatalog();
  const b = ticket.booking;
  const movie = getMovie(b.movieId) ?? allMovies()[0];
  const showDate = dateLabel(b.date);
  const theatre = findTheatre(b.theatreId);
  useEffect(() => {
    QRCode.toDataURL(`PICKMYSEAT|${ticket.id}|${b.seats.join(",")}`, { margin: 1, width: 220 }).then(setQr);
  }, [ticket.id, b.seats]);

  const body = (
    <div className="card flex overflow-hidden">
      <div className="flex-1 p-5 text-white" style={{ background: `linear-gradient(135deg, hsl(${movie.hue} 70% 30%), #16161A 70%)` }}>
        <p className="text-xs uppercase tracking-widest text-white/60">{movie.lang} · {b.format}</p>
        <p className="text-2xl font-black">{movie.title}</p>
        <p className="mt-2 text-sm text-white/70">{theatre.name}, {b.city}</p>
        <p className="text-sm text-white/70">{showDate} · {b.time}</p>
        <p className="mt-3 text-sm">Seats: <b>{b.seats.join(", ")}</b></p>
        <p className="mt-1 text-xs text-white/50">Booking ID {ticket.id} · ₹{ticket.total}</p>
        {ticket.paymentId && <p className="text-xs text-white/50">Paid via Razorpay (test) · {ticket.paymentId}</p>}
      </div>
      <div className="grid w-40 place-items-center bg-white p-2">
        {qr ? <img src={qr} alt={`QR for ${ticket.id}`} className="w-full" /> : null}
      </div>
    </div>
  );
  return link ? <Link href={`/ticket/${ticket.id}`}>{body}</Link> : body;
}
