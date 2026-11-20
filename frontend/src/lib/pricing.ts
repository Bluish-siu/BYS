import { snacks, findTheatre } from "./data";
import { getLayout, seatPriceIn } from "./layouts";
import type { Booking } from "./store";
import { useEffect, useState } from "react";

export const layoutFor = (b: Booking) => getLayout(findTheatre(b.theatreId).layout);
export const seatPrice = (b: Booking, id: string) => seatPriceIn(layoutFor(b), id);
export const seatsTotal = (b: Booking) => b.seats.reduce((s, id) => s + seatPrice(b, id), 0);
export const snacksTotal = (b: Booking) => Object.entries(b.snacks).reduce((s, [id, q]) => s + (snacks.find((x) => x.id === id)?.price ?? 0) * q, 0);
export const FEE = 30;
export const grandTotal = (b: Booking) => seatsTotal(b) + snacksTotal(b) + (b.seats.length ? FEE : 0);

// The persisted store only exists on the client, so pages wait for this before reading it.
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}

export const dayLabel = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};
