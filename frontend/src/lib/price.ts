// Ticket prices. Plain functions with no React, so the server uses exactly the same maths as the pages.
import { snacks } from "./data";
import { findTheatre } from "./catalog";
import { getLayout, seatPriceIn } from "./layouts";
import type { Booking } from "./store";

type Priced = Pick<Booking, "theatreId" | "seats" | "snacks">;

export const FEE = 30;
export const layoutFor = (b: Pick<Booking, "theatreId">) => getLayout(findTheatre(b.theatreId).layout);
export const seatPrice = (b: Pick<Booking, "theatreId">, id: string) => seatPriceIn(layoutFor(b), id);
export const seatsTotal = (b: Priced) => b.seats.reduce((s, id) => s + seatPrice(b, id), 0);
export const snacksTotal = (b: Priced) => Object.entries(b.snacks).reduce((s, [id, q]) => s + (snacks.find((x) => x.id === id)?.price ?? 0) * q, 0);
export const grandTotal = (b: Priced) => seatsTotal(b) + snacksTotal(b) + (b.seats.length ? FEE : 0);
