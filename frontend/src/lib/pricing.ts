import { useEffect, useState } from "react";

export { FEE, grandTotal, layoutFor, seatPrice, seatsTotal, snacksTotal } from "./price";

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
