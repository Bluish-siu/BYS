import { useEffect, useState } from "react";

export { FEE, grandTotal, layoutFor, seatPrice, seatsTotal, snacksTotal } from "./price";

// The persisted store only exists on the client, so pages wait for this before reading it.
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}

/** The current time, updated every minute, so showtimes that start drop off the page on their own. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
