// HTTP routes for the PickMySeat API. Plain node:http, JSON in and out.
import { randomBytes } from "node:crypto";

const MAX_SEATS = 10;

export function createApp(db, { corsOrigin = "*" } = {}) {
  const q = {
    movies: db.prepare("SELECT * FROM movies ORDER BY rowid"),
    movie: db.prepare("SELECT * FROM movies WHERE id = ?"),
    cities: db.prepare("SELECT name FROM cities ORDER BY rowid"),
    theatres: db.prepare("SELECT * FROM theatres WHERE city = ? ORDER BY km"),
    theatre: db.prepare("SELECT * FROM theatres WHERE id = ?"),
    snacks: db.prepare("SELECT * FROM snacks ORDER BY rowid"),
    booked: db.prepare("SELECT seat_id FROM booked_seats WHERE show_key = ?"),
    taken: db.prepare("SELECT seat_id FROM booked_seats WHERE show_key = ? AND seat_id = ?"),
    insertBooking: db.prepare(`INSERT INTO bookings (id, movie_id, theatre_id, city, day, show_id, show_key, show_time, format, seats, snacks, total)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    insertSeat: db.prepare("INSERT INTO booked_seats (show_key, seat_id, booking_id) VALUES (?, ?, ?)"),
    booking: db.prepare("SELECT * FROM bookings WHERE id = ?"),
  };

  const theatreOut = (t) => ({ ...t, formats: t.formats.split(",") });
  const bookingOut = (b) => ({ ...b, seats: JSON.parse(b.seats), snacks: JSON.parse(b.snacks) });

  function createBooking(body) {
    const { movieId, theatreId, city, day, showId, time, format, seats, snacks = {}, total } = body ?? {};
    if (!q.movie.get(movieId ?? "")) return [400, { error: "Unknown movie" }];
    if (!q.theatre.get(theatreId ?? "")) return [400, { error: "Unknown theatre" }];
    if (!Array.isArray(seats) || seats.length < 1 || seats.length > MAX_SEATS || !seats.every((s) => typeof s === "string" && /^[A-Z]{1,2}\d{1,3}$/.test(s)))
      return [400, { error: `Choose between 1 and ${MAX_SEATS} valid seats` }];
    if (new Set(seats).size !== seats.length) return [400, { error: "Duplicate seats" }];
    if (!Number.isInteger(day) || day < 0 || day > 6 || typeof showId !== "string" || !showId) return [400, { error: "Invalid show" }];
    if (!Number.isInteger(total) || total <= 0) return [400, { error: "Invalid total" }];

    const showKey = `${movieId}|${showId}|${day}`;
    const id = "PMS" + randomBytes(4).toString("hex").toUpperCase();
    // One transaction: either every seat is reserved, or none are.
    db.exec("BEGIN IMMEDIATE");
    try {
      const clash = seats.filter((s) => q.taken.get(showKey, s));
      if (clash.length) { db.exec("ROLLBACK"); return [409, { error: "Some seats were just booked by someone else", taken: clash }]; }
      q.insertBooking.run(id, movieId, theatreId, String(city ?? ""), day, showId, showKey, String(time ?? ""), String(format ?? ""), JSON.stringify(seats), JSON.stringify(snacks), total);
      for (const s of seats) q.insertSeat.run(showKey, s, id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return [201, bookingOut(q.booking.get(id))];
  }

  async function route(method, url, body) {
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
    }
    if (method === "POST" && res === "bookings" && !id) return createBooking(body);
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
