"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getMovie, movies, snacks, findTheatre } from "@/lib/data";
import { useStore } from "@/lib/store";
import {
  apiEnabled, cancelPayment, createBooking, createPaymentOrder, fetchPaymentConfig, loadRazorpay, verifyPayment,
  type PaymentConfig, type RazorpayResult,
} from "@/lib/api";
import { FEE, dayLabel, grandTotal, seatsTotal, useHydrated } from "@/lib/pricing";

type RazorpayInstance = { open: () => void; on: (event: string, cb: (r: { error: { description: string } }) => void) => void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

export default function PayPage() {
  const ready = useHydrated();
  const router = useRouter();
  const { booking, setBooking, addTicket } = useStore();
  const [method, setMethod] = useState("upi");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [checked, setChecked] = useState(false);
  const done = useRef(false);

  useEffect(() => { if (ready && !paying && !done.current && (!booking || !booking.seats.length)) router.replace("/"); }, [ready, paying, booking, router]);
  useEffect(() => {
    fetchPaymentConfig().then((c) => { setConfig(c); setChecked(true); if (c?.razorpay) loadRazorpay(); });
  }, []);
  if (!ready || !booking) return <p className="p-10 text-fg/60">Loading...</p>;

  const movie = getMovie(booking.movieId) ?? movies[0];
  const theatre = findTheatre(booking.theatreId);
  const total = grandTotal(booking);
  const razorpayOn = Boolean(config?.razorpay);

  const issue = (id: string, paymentId?: string) => {
    done.current = true;
    addTicket({ id, booking, total, at: Date.now(), paymentId });
    setBooking(null);
    router.replace(`/ticket/${id}`);
  };
  const fail = (msg: string) => { setPaying(false); setError(msg); };
  const seatsTaken = (taken?: string[]) => (taken?.length ? `Seat ${taken.join(", ")} was just booked by someone else. Please pick another seat.` : "");

  // Real Razorpay Checkout (test mode): server order -> Razorpay window -> server verifies the signature.
  const payWithRazorpay = async () => {
    const res = await createPaymentOrder(booking, total);
    if (!res.ok) return fail(seatsTaken(res.taken) || res.error);
    if (!(await loadRazorpay())) {
      await cancelPayment(res.order.orderId);
      return fail("Couldn't load Razorpay. Check your internet connection and try again.");
    }
    const { order } = res;
    const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "PickMySeat",
      description: `${movie.title} · ${booking.seats.length} ticket${booking.seats.length > 1 ? "s" : ""} · ${booking.seats.join(", ")}`,
      notes: { booking: order.bookingId },
      theme: { color: "#FF5A36" },
      timeout: order.holdMinutes * 60,
      handler: async (r: RazorpayResult) => {
        setError("");
        const v = await verifyPayment(r);
        if (v.ok) issue(v.id, v.paymentId);
        else fail(v.error);
      },
      modal: {
        confirm_close: true,
        ondismiss: async () => {
          if (done.current) return;
          await cancelPayment(order.orderId);
          fail("Payment cancelled. Your seats have been released.");
        },
      },
    });
    // A failed attempt (declined card, wrong OTP) stays inside the Razorpay window so the customer can retry.
    rzp.on("payment.failed", (r) => setError(`Payment failed: ${r.error.description}`));
    rzp.open();
  };

  const pay = async () => {
    setPaying(true);
    setError("");
    if (razorpayOn) return payWithRazorpay();
    // Demo payment: no real charge. With a backend, the server reserves the seats and issues the ticket id.
    await new Promise((r) => setTimeout(r, 800));
    if (!apiEnabled) return issue("PMS" + Math.random().toString(36).slice(2, 10).toUpperCase());
    const res = await createBooking(booking, total);
    if (res.ok) return issue(res.id);
    fail(seatsTaken(res.taken) || res.error);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-black">Review &amp; pay</h1>
        {razorpayOn && <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">TEST MODE</span>}
      </div>
      <div className="card space-y-2 p-5 text-sm">
        <p className="text-lg font-bold">{movie.title}</p>
        <p className="text-fg/60">{theatre.name} · {booking.city} · {dayLabel(booking.day)} · {booking.time} · {booking.format}</p>
        <hr className="border-fg/10" />
        <Row l={`Seats ${booking.seats.join(", ")}`} r={`₹${seatsTotal(booking)}`} />
        {Object.entries(booking.snacks).map(([id, q]) => {
          const s = snacks.find((x) => x.id === id)!;
          return <Row key={id} l={`${s.name} × ${q}`} r={`₹${s.price * q}`} />;
        })}
        <Row l="Convenience fee" r={`₹${FEE}`} />
        <hr className="border-fg/10" />
        <div className="flex justify-between text-lg font-bold"><span>Amount payable</span><span>₹{total}</span></div>
      </div>

      {razorpayOn ? (
        <div className="card mt-5 space-y-3 p-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Pay securely with Razorpay</span>
            <span className="text-xs text-fg/50">UPI · Cards · Netbanking · Wallets</span>
          </div>
          <p className="text-xs text-fg/50">Your seats are held for 10 minutes while you pay. Closing the payment window releases them.</p>
          <details className="rounded-lg bg-fg/5 p-3 text-xs text-fg/70">
            <summary className="cursor-pointer font-semibold text-fg/80">Test payment details</summary>
            <ul className="mt-2 space-y-1">
              <li>UPI: <code>success@razorpay</code> (or <code>failure@razorpay</code> to see a failed payment)</li>
              <li>Card: <code>4111 1111 1111 1111</code>, any future expiry, any CVV, any OTP</li>
              <li>Netbanking: pick any bank, then Success on Razorpay&apos;s test page</li>
            </ul>
            <p className="mt-2 text-fg/40">Test mode: no real money is charged.</p>
          </details>
        </div>
      ) : checked ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[["upi", "UPI"], ["card", "Card"], ["wallet", "Wallet"]].map(([id, l]) => (
              <button key={id} onClick={() => setMethod(id)} className={`btn ${method === id ? "btn-brand" : "btn-ghost"}`}>{l}</button>
            ))}
          </div>
          <p className="mt-2 text-xs text-fg/40">Demo only. No real payment is taken and no details are collected.</p>
        </>
      ) : null}

      {error && (
        <div className="mt-4 rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">
          {error} <button className="ml-1 font-semibold underline" onClick={() => router.push("/book/seats")}>Change seats</button>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button className="btn btn-ghost" onClick={() => router.push("/book/snacks")}>Back</button>
        <button disabled={paying || !checked} className="btn btn-brand flex-1 disabled:opacity-60" onClick={pay}>
          {paying ? (razorpayOn ? "Waiting for payment..." : "Processing...") : `Pay ₹${total}`}
        </button>
      </div>
      {razorpayOn && <p className="mt-3 text-center text-[11px] text-fg/40">Payments are processed by Razorpay. PickMySeat never sees your card or UPI details.</p>}
    </div>
  );
}

function Row({ l, r }: { l: string; r: string }) {
  return <div className="flex justify-between"><span>{l}</span><span>{r}</span></div>;
}
