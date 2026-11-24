"use client";
import QRCode from "qrcode";
import { useState } from "react";
import { allMovies, findTheatre, getMovie } from "@/lib/catalog";
import { dateLabel } from "@/lib/dates";
import type { Ticket } from "@/lib/store";

type AppBridge = { saveImage?: (base64Png: string, fileName: string) => void };

/** Draws the ticket (with its QR code) as a phone-sized PNG. */
async function ticketImage(t: Ticket) {
  const b = t.booking;
  const movie = getMovie(b.movieId) ?? allMovies()[0];
  const theatre = findTheatre(b.theatreId);
  const W = 1080, H = 1700;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  // Rounded boxes (plain boxes on older phones without roundRect).
  const box = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); };
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const text = (s: string, x: number, y: number, size: number, weight = 400, color = "#16161A", align: CanvasTextAlign = "left") => {
    g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y);
  };
  // Paper background and a dark card, like the ticket on screen.
  g.fillStyle = "#F3EEE5"; g.fillRect(0, 0, W, H);
  text("PickMy", 80, 130, 64, 800);
  text("Seat", 80 + g.measureText("PickMy").width, 130, 64, 800, "#FF5A36");
  const grad = g.createLinearGradient(0, 180, W, 820);
  grad.addColorStop(0, `hsl(${movie.hue} 70% 30%)`); grad.addColorStop(0.7, "#16161A");
  g.fillStyle = grad; box(60, 180, W - 120, 660, 40);
  text(`${movie.lang.toUpperCase()} · ${b.format}`, 110, 260, 34, 600, "rgba(255,255,255,0.65)");
  // Title, wrapped to two lines if needed.
  g.font = `900 84px ${font}`;
  const words = movie.title.split(" "); let line = "", y = 360;
  for (const w of words) {
    if (g.measureText(line + w).width > W - 240 && line) { text(line.trim(), 110, y, 84, 900, "#fff"); line = ""; y += 92; }
    line += w + " ";
  }
  text(line.trim(), 110, y, 84, 900, "#fff");
  text(theatre.name, 110, y + 90, 38, 500, "rgba(255,255,255,0.8)");
  text(`${dateLabel(b.date)} · ${b.time}`, 110, y + 145, 44, 700, "#fff");
  text(`Seats  ${b.seats.join(", ")}`, 110, y + 215, 48, 800, "#FF8A6E");
  // QR code on white.
  const qr = await QRCode.toDataURL(`PICKMYSEAT|${t.id}|${b.seats.join(",")}`, { margin: 1, width: 620 });
  const img = await new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = qr; });
  g.fillStyle = "#fff"; box(W / 2 - 350, 900, 700, 700, 36);
  g.drawImage(img, W / 2 - 310, 940, 620, 620);
  text(`Booking ID ${t.id} · ₹${t.total}`, W / 2, 1650, 34, 600, "#5B5A57", "center");
  if (t.status === "cancelled") {
    g.save(); g.translate(W / 2, 1250); g.rotate(-0.3);
    text("CANCELLED", 0, 30, 120, 900, "rgba(255,90,54,0.85)", "center"); g.restore();
  }
  return c.toDataURL("image/png");
}

/** "Save ticket": to the Gallery in the Android app, or as a download in the browser. */
export default function SaveTicket({ ticket }: { ticket: Ticket }) {
  const [msg, setMsg] = useState("");
  const save = async () => {
    setMsg("");
    const png = await ticketImage(ticket);
    const name = `PickMySeat-${ticket.id}.png`;
    const app = (window as unknown as { PickMySeatApp?: AppBridge }).PickMySeatApp;
    if (app?.saveImage) { app.saveImage(png.split(",")[1], name); return; }
    const a = document.createElement("a");
    a.href = png; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg("Saved. Open it from your downloads at the entrance, even without internet.");
  };
  return (
    <>
      <button onClick={save} className="btn btn-ghost">
        <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v3h16v-3" /></svg>
        Save ticket
      </button>
      {msg && <p className="w-full text-xs text-fg/55">{msg}</p>}
    </>
  );
}
