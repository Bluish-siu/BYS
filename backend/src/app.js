// HTTP routes for the PickMySeat API. Plain node:http, JSON in and out.
import { randomBytes } from "node:crypto";

const MAX_SEATS = 10;
const HOLD_MINUTES = 10; // how long seats are held while the customer pays
const BOOKING_DAYS = 5;  // today + 4, like the website

// Dates and times are India Standard Time (UTC+5:30), whatever the server's own time zone is.
const IST_MS = 330 * 60_000;
export const istDate = (plus = 0, now = Date.now()) => {
  const d = new Date(now + IST_MS);
  d.setUTCDate(d.getUTCDate() + plus);
  return d.toISOString().slice(0, 10);
};
const istMinutes = (now = Date.now()) => { const d = new Date(now + IST_MS); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

export function createApp(db, { corsOrigin = "*", razorpay = null, now = () => Date.now() } = {}) {
  const q = {
    movies: db.prepare("SELECT * FROM movies ORDER BY rowid"),
    movie: db.prepare("SELECT * FROM movies WHERE id = ?"),
    cities: db.prepare("SELECT name FROM cities ORDER BY rowid"),
    theatres: db.prepare("SELECT * FROM theatres WHERE city = ? ORDER BY km"),
    theatre: db.prepare("SELECT * FROM theatres WHERE id = ?"),
    snacks: db.prepare("SELECT * FROM snacks ORDER BY rowid"),
    booked: db.prepare("SELECT seat_id FROM booked_seats WHERE show_key = ?"),
    taken: db.prepare("SELECT seat_id FROM booked_seats WHERE show_key = ? AND seat_id = ?"),
    insertBooking: db.prepare(`INSERT INTO bookings (id, movie_id, theatre_id, city, show_date, show_id, show_key, show_time, format, seats, snacks, total, status, expires_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    insertSeat: db.prepare("INSERT INTO booked_seats (show_key, seat_id, booking_id) VALUES (?, ?, ?)"),
    booking: db.prepare("SELECT * FROM bookings WHERE id = ?"),
    byOrder: db.prepare("SELECT * FROM bookings WHERE payment_order_id = ?"),
    setOrder: db.prepare("UPDATE bookings SET payment_order_id = ? WHERE id = ?"),
    confirm: db.prepare("UPDATE bookings SET status = 'confirmed', payment_id = ?, expires_at = NULL WHERE id = ? AND status = 'pending'"),
    remove: db.prepare("DELETE FROM bookings WHERE id = ?"),
    expire: db.prepare("DELETE FROM bookings WHERE status = 'pending' AND expires_at < datetime('now')"),
  };

  const theatreOut = (t) => ({ ...t, formats: t.formats.split(",") });
  const bookingOut = (b) => ({ ...b, seats: JSON.parse(b.seats), snacks: JSON.parse(b.snacks) });

  function validate(body) {
    const { movieId, theatreId, date, showId, seats, total } = body ?? {};
    if (!q.movie.get(movieId ?? "")) return "Unknown movie";
    if (!q.theatre.get(theatreId ?? "")) return "Unknown theatre";
    if (!Array.isArray(seats) || seats.length < 1 || seats.length > MAX_SEATS || !seats.every((s) => typeof s === "string" && /^[A-Z]{1,2}\d{1,3}$/.test(s)))
      return `Choose between 1 and ${MAX_SEATS} valid seats`;
    if (new Set(seats).size !== seats.length) return "Duplicate seats";
    if (typeof showId !== "string" || !showId) return "Invalid show";
    // Shows are identified by their real date, so a booking still matches its show after midnight.
    const t = now();
    if (typeof date !== "string" || !Array.from({ length: BOOKING_DAYS }, (_, i) => istDate(i, t)).includes(date)) return "Tickets for this date aren't on sale";
    const start = showId.match(/(\d{2}):(\d{2})$/); // generated show ids end in the 24-hour start time
    if (start && date === istDate(0, t) && Number(start[1]) * 60 + Number(start[2]) <= istMinutes(t)) return "This show has already started";
    if (!Number.isInteger(total) || total <= 0 || total > 500_000) return "Invalid total";
    return null;
  }

  /** Reserves the seats in one transaction. status "pending" holds them for HOLD_MINUTES. */
  function reserve(body, status) {
    const err = validate(body);
    if (err) return [400, { error: err }];
    const { movieId, theatreId, city, date, showId, time, format, seats, snacks = {}, total } = body;
    const showKey = `${movieId}|${showId}|${date}`;
    const id = "PMS" + randomBytes(4).toString("hex").toUpperCase();
    const expires = status === "pending" ? new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString().replace("T", " ").slice(0, 19) : null;
    db.exec("BEGIN IMMEDIATE");
    try {
      const clash = seats.filter((s) => q.taken.get(showKey, s));
      if (clash.length) { db.exec("ROLLBACK"); return [409, { error: "Some seats were just booked by someone else", taken: clash }]; }
      q.insertBooking.run(id, movieId, theatreId, String(city ?? ""), date, showId, showKey, String(time ?? ""), String(format ?? ""), JSON.stringify(seats), JSON.stringify(snacks), total, status, expires);
      for (const s of seats) q.insertSeat.run(showKey, s, id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return [201, bookingOut(q.booking.get(id))];
  }

  // Step 1 of a payment: hold the seats and open a Razorpay order for the amount.
  async function createOrder(body) {
    const [status, booking] = reserve(body, "pending");
    if (status !== 201) return [status, booking];
    try {
      const order = await razorpay.createOrder({
        amount: booking.total * 100, // paise
        receipt: booking.id,
        notes: { booking: booking.id, movie: booking.movie_id, seats: booking.seats.join(" ") },
      });
      q.setOrder.run(order.id, booking.id);
      return [201, { bookingId: booking.id, orderId: order.id, amount: order.amount, currency: order.currency, keyId: razorpay.keyId, holdMinutes: HOLD_MINUTES }];
    } catch (e) {
      q.remove.run(booking.id); // release the seats again
      console.error("Razorpay order failed:", e.message);
      return [502, { error: "Couldn't start the payment. Please try again." }];
    }
  }

  // Step 2: Razorpay calls the browser back; the browser sends the signed result here.
  function verifyPayment(body) {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body ?? {};
    if (!orderId || !paymentId || !signature) return [400, { error: "Missing payment details" }];
    if (!razorpay.verify(orderId, paymentId, signature)) return [400, { error: "Payment could not be verified" }];
    const b = q.byOrder.get(orderId);
    if (!b) return [410, { error: "Your seat hold expired before the payment finished. Any amount debited will be refunded." }];
    if (b.status === "confirmed") return [200, bookingOut(b)]; // same callback twice
    q.confirm.run(paymentId, b.id);
    return [200, bookingOut(q.booking.get(b.id))];
  }

  // The customer closed the payment window: release the held seats.
  function cancelPayment(body) {
    const b = q.byOrder.get(String(body?.orderId ?? ""));
    if (b?.status === "pending") q.remove.run(b.id);
    return [200, { released: Boolean(b && b.status === "pending") }];
  }

  async function route(method, url, body) {
    q.expire.run(); // drop seat holds whose payment window has passed
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent); // ["api", ...]
    if (parts[0] !== "api") return [404, { error: "Not found" }];
    const [, res, id, sub] = parts;

    if (method === "GET") {
      if (res === "health") return [200, { ok: true }];
      if (res === "movies" && !id) return [200, q.movies.all()];
      if (res === "movies" && id) { const m = q.movie.get(id); return m ? [200, m] : [404, { error: "Movie not found" }]; }
      if (res === "cities") return [200, q.cities.all().map((c) => c.name)];
      if (res === "theatres") return [200, q.theatres.all(url.searchParams.get("city") ?? "Mumbai").map(theatreOut)];
      if (res === "snacks") return [200, q.snacks.all()];
      if (res === "shows" && id && sub === "booked-seats") return [200, { showKey: id, seats: q.booked.all(id).map((r) => r.seat_id) }];
      if (res === "bookings" && id) { const b = q.booking.get(id); return b ? [200, bookingOut(b)] : [404, { error: "Booking not found" }]; }
      if (res === "payments" && id === "config") return [200, { razorpay: Boolean(razorpay), keyId: razorpay?.keyId ?? null, mode: razorpay ? "test" : "off" }];
    }
    if (method === "POST") {
      if (res === "bookings" && !id) {
        // With Razorpay on, tickets are only issued after a verified payment.
        if (razorpay) return [403, { error: "Payment required. Use /api/payments/order." }];
        return reserve(body, "confirmed");
      }
      if (res === "payments" && razorpay) {
        if (id === "order") return createOrder(body);
        if (id === "verify") return verifyPayment(body);
        if (id === "cancel") return cancelPayment(body);
      }
    }
    return [404, { error: "Not found" }];
  }

  return async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

    let status, payload;
    try {
      let body;
      if (req.method === "POST") {
        let raw = "";
        for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) throw Object.assign(new Error("Body too large"), { status: 413 }); }
        try { body = raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
      }
      [status, payload] = await route(req.method, new URL(req.url, "http://localhost"), body);
    } catch (e) {
      status = e.status ?? 500;
      payload = { error: e.status ? e.message : "Server error" };
      if (!e.status) console.error(e);
    }
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(payload));
  };
}
