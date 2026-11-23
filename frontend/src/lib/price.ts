// Ticket prices. Plain functions with no React, so the server uses exactly the same maths as the pages.
import { findTheatre, seatPricesFor, snackMenu } from "./catalog";
import { getLayout, seatPriceIn, type Layout } from "./layouts";
import type { Booking } from "./store";

type Priced = Pick<Booking, "theatreId" | "seats" | "snacks">;

export const FEE = 30;
const priced = new Map<string, Layout>();
/** A theatre's seat layout with that theatre's own section prices (set in the admin panel). */
export function layoutFor(b: Pick<Booking, "theatreId">): Layout {
  const theatre = findTheatre(b.theatreId);
  const base = getLayout(theatre.layout);
  const own = seatPricesFor(theatre.id);
  if (!own || !Object.keys(own).length) return base;
  const key = `${theatre.id}|${theatre.layout}|${JSON.stringify(own)}`;
  let l = priced.get(key);
  if (!l) {
    const rows = base.rows.map((r) => ({ ...r, price: own[r.section] ?? r.price }));
    const byId = new Map(rows.flatMap((r) => r.seats.map((s) => [s.id, r] as const)));
    const legend: Layout["legend"] = [];
    for (const r of rows) if (!legend.some((x) => x.name === r.section)) legend.push({ kind: r.kind, name: r.section, price: r.price });
    l = { ...base, rows, byId, legend };
    priced.set(key, l);
  }
  return l;
}
export const seatPrice = (b: Pick<Booking, "theatreId">, id: string) => seatPriceIn(layoutFor(b), id);
export const seatsTotal = (b: Priced) => b.seats.reduce((s, id) => s + seatPrice(b, id), 0);
export const snacksTotal = (b: Priced) => Object.entries(b.snacks).reduce((s, [id, q]) => s + (snackMenu().find((x) => x.id === id)?.price ?? 0) * q, 0);
export const grandTotal = (b: Priced) => seatsTotal(b) + snacksTotal(b) + (b.seats.length ? FEE : 0);
