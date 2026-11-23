// End-to-end test of PickMySeat's API against the real database, then removes everything it created.
//
// 1. Build and start the site with e-mail in log mode (from frontend/):
//      npm run build
//      MAIL_DEV=log npx next start -p 3001          (PowerShell: $env:MAIL_DEV="log"; npx next start -p 3001)
// 2. In another terminal, from the project folder:   npm run test:e2e
//
// Needs DATABASE_URL and the Razorpay test keys in frontend/.env.local. Payments are simulated by signing
// Razorpay's result with the test secret, exactly as Razorpay does; no real payment is made.
import { createHash, createHmac } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = readFileSync(path.join(here, "../.env.local"), "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1].trim().replace(/^["']|["']$/g, "");
const DB = get("DATABASE_URL");
const sql = postgres(DB, { ssl: "require", prepare: false, max: 1, onnotice: () => {} });
const B = process.env.E2E_URL ?? "http://localhost:3001";
const IST = 330 * 60_000;
const istDate = (plus = 0) => { const d = new Date(Date.now() + IST); d.setUTCDate(d.getUTCDate() + plus); return d.toISOString().slice(0, 10); };

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "PASS" : "FAIL", m); };
/** A browser: keeps its own sign-in cookie. */
const client = () => {
  let cookie = "";
  const call = async (p, method = "GET", body, form) => {
    const r = await fetch(B + "/api" + p, {
      method, redirect: "manual",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), cookie },
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });
    const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return [r.status, await r.json().catch(() => ({})), r.headers.get("location")];
  };
  call.cookie = () => cookie;
  call.setCookie = (c) => { cookie = c; };
  return call;
};
// Same secret and hash as src/lib/auth-server.ts, so the test can plant a known code instead of reading e-mail.
const secret = get("AUTH_SECRET") || createHash("sha256").update("pickmyseat-session|" + DB).digest("hex");
const plantCode = (userId, purpose, code) => sql`INSERT INTO auth_codes (user_id, purpose, code_hash, expires_at)
  VALUES (${userId}, ${purpose}, ${createHmac("sha256", secret).update(`${userId}|${purpose}|${code}`).digest("hex")}, now() + interval '10 minutes')
  ON CONFLICT (user_id, purpose) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0, created_at = now(), expires_at = excluded.expires_at`;
const sign = (orderId, paymentId) => createHmac("sha256", get("RAZORPAY_KEY_SECRET")).update(`${orderId}|${paymentId}`).digest("hex");
const priceOf = (r) => Number(r.error?.match(/₹(\d+)/)?.[1]);

const tag = Date.now().toString(36);
const mail = (who) => `${who}-${tag}@test.pickmyseat.dev`;
const phone = "9" + String(Date.now()).slice(-9);
const admin = client(), cust = client(), other = client(), anon = client();
let movieId = "";

try {
  // ---------- Catalogue ----------
  let [s, r] = await anon("/catalog");
  ok(s === 200 && r.live && r.movies.length >= 8 && r.snacks.length >= 4, `catalogue from the database: ${r.movies?.length} movies, ${r.theatres?.length} theatres, ${r.snacks?.length} snacks`);
  [s, r] = await anon("/auth/me"); ok(r.enabled && r.mail, "accounts on, e-mail codes on (MAIL_DEV=log)");

  // ---------- Accounts: sign up, confirm email, sign in, forgot password ----------
  [s, r] = await admin("/auth/signup", "POST", { name: "Test Admin", email: mail("admin"), password: "adminpass123" }); ok(s === 201, "admin signs up");
  [s, r] = await admin("/admin/overview"); ok(s === 403, "a new account can't open the admin panel");
  execSync(`node "${path.join(here, "make-admin.mjs")}" ${mail("admin")}`);
  [s, r] = await admin("/auth/me"); ok(r.user?.role === "admin", "make-admin gives admin rights");
  await sql`UPDATE users SET email_verified = true WHERE email = ${mail("admin")}`;

  [s, r] = await cust("/auth/signup", "POST", { name: "Test Customer", email: mail("cust"), phone: `+91 ${phone}`, password: "short" }); ok(s === 400, "short password refused");
  [s, r] = await cust("/auth/signup", "POST", { name: "Test Customer", email: mail("cust"), phone: `+91 ${phone}`, password: "custpass123" });
  const custId = r.user?.id;
  ok(s === 201 && r.user.phone === phone && r.user.emailVerified === false && r.verify === true, "customer signs up with email and mobile; a code is e-mailed");
  [s, r] = await anon("/auth/signup", "POST", { name: "Dup", email: mail("cust").toUpperCase(), password: "custpass123" }); ok(s === 409, "same email again refused");
  [s, r] = await anon("/auth/signup", "POST", { name: "Dup", email: mail("dup"), phone, password: "custpass123" }); ok(s === 409 && /mobile/.test(r.error), "same mobile number again refused");
  [s, r] = await client()("/auth/login", "POST", { login: `0${phone}`, password: "custpass123" }); ok(s === 200 && r.user.id === custId, "sign in with the mobile number");
  [s, r] = await client()("/auth/login", "POST", { login: mail("cust"), password: "wrongpass1" }); ok(s === 401, "wrong password refused");

  // ---------- Admin sets up a test movie with its own showtimes ----------
  [s, r] = await admin("/admin/movies", "POST", { title: `ZZ Test Movie ${tag}`, lang: "Testlang", genre: "Testgenre", year: 2026, rating: 7.5, duration: "2h", trailer: "https://youtu.be/T0Uduwg2W2w" });
  movieId = r.id; ok(s === 200 && movieId, `admin adds a movie (${movieId})`);
  [s, r] = await admin("/admin/shows", "POST", { movieId, theatreId: "mum-icon", time: "23:30", format: "IMAX" }); ok(s === 200, "admin adds a 11:30 PM IMAX show");
  [s, r] = await admin("/admin/shows", "POST", { movieId, theatreId: "mum-icon", time: "00:01", format: "IMAX" });
  [s, r] = await anon("/catalog");
  const show = r.shows.find((x) => x.movieId === movieId && x.time === "23:30");
  const early = r.shows.find((x) => x.movieId === movieId && x.time === "00:01");
  ok(show && early && r.movies.find((m) => m.id === movieId)?.trailer === "T0Uduwg2W2w", "new movie, trailer and shows are in the public catalogue");
  const tomorrow = istDate(1);
  const base = { movieId, theatreId: "mum-icon", city: "Mumbai", date: tomorrow, showId: show.id, snacks: {} };
  const showKey = encodeURIComponent(`${movieId}|${show.id}|${tomorrow}`);
  // Two neighbouring seats that aren't pre-sold.
  let pair = null;
  for (const row of "DEFGHJ") for (let n = 5; n < 14 && !pair; n++) {
    const [st, rr] = await admin("/payments/order", "POST", { ...base, seats: [row + n, row + (n + 1)], total: 1 });
    if (st === 409 && /₹\d+/.test(rr.error ?? "")) pair = [row + n, row + (n + 1)];
  }

  // ---------- Booking rules ----------
  [s, r] = await anon("/payments/order", "POST", { ...base, seats: pair, total: 1 }); ok(s === 401, "booking without signing in refused");
  [s, r] = await cust("/payments/order", "POST", { ...base, seats: pair, total: 1 }); ok(s === 403 && r.verify, "booking before confirming the email refused");
  [s, r] = await cust("/auth/verify", "POST", { code: "000000" }); ok(s === 410 || s === 400, "wrong code refused");
  await plantCode(custId, "verify", "246810");
  [s, r] = await cust("/auth/verify", "POST", { code: "246810" }); ok(s === 200 && r.user.emailVerified, "correct code confirms the email");
  [s, r] = await cust("/payments/order", "POST", { ...base, seats: pair, total: 1 }); const price = priceOf(r); ok(s === 409 && price > 0, `tampered price refused; server price ₹${price}`);
  [s, r] = await cust("/payments/order", "POST", { ...base, date: istDate(-1), seats: pair, total: 1 }); ok(s === 409 && /on sale/.test(r.error), "yesterday refused");
  [s, r] = await cust("/payments/order", "POST", { ...base, date: istDate(0), showId: early.id, seats: pair, total: 1 }); ok(s === 409 && /already started/.test(r.error), "a show that has started refused");

  // ---------- Prices an admin sets ----------
  const [, cat] = await anon("/catalog");
  const theatreLayout = cat.theatres.find((t) => t.id === "mum-icon").layout;
  [s, r] = await admin("/admin/prices", "POST", { theatreId: "mum-icon", prices: { "Picture Perfect": 1999 } });
  ok(s === 200, `admin sets Picture Perfect to ₹1999 at PVR ICON (${theatreLayout} layout)`);
  [s, r] = await anon("/catalog"); ok(r.seatPrices["mum-icon"]?.["Picture Perfect"] === 1999, "new seat price in the catalogue");
  await admin("/admin/prices", "POST", { theatreId: "mum-icon", prices: { "Picture Perfect": 1650 } }); // back to normal
  [s, r] = await anon("/catalog"); ok(!r.seatPrices["mum-icon"]?.["Picture Perfect"], "setting the usual price removes the change");
  [s, r] = await admin("/admin/snacks", "POST", { name: `Test Samosa ${tag}`, price: 99, emoji: "🥟" }); const snackId = r.id;
  [s, r] = await cust("/payments/order", "POST", { ...base, seats: pair, snacks: { [snackId]: 2 }, total: 1 });
  ok(priceOf(r) === price + 198, `new snack (₹99 × 2) counted by the server: ₹${priceOf(r)}`);
  await admin("/admin/snacks", "POST", { id: snackId, name: "Test Samosa", price: 99, active: false });

  // ---------- Admin blocks seats ----------
  [s, r] = await admin("/admin/blocks", "POST", { movieId, theatreId: "mum-icon", date: tomorrow, showId: show.id, seats: ["E1", "E2", "E3"] });
  const blockId = r.id; ok(s === 200 && blockId?.startsWith("BLK"), "admin blocks E1-E3");
  [s, r] = await cust("/payments/order", "POST", { ...base, seats: ["E2"], total: 0 });
  [s, r] = await cust("/payments/order", "POST", { ...base, seats: ["E2"], total: priceOf(r) }); ok(s === 409 && r.taken?.includes("E2"), "customer can't buy a blocked seat");

  // ---------- Pay (in-page flow), then abandon-and-retry ----------
  [s, r] = await cust("/payments/order", "POST", { ...base, seats: pair, total: price }); const first = r; ok(s === 201 && r.amount === price * 100, `order for ₹${price}; seats held`);
  [s, r] = await cust("/payments/order", "POST", { ...base, seats: pair, total: price }); const order = r;
  ok(s === 201 && order.orderId !== first.orderId, "trying again replaces your own unfinished attempt (no 'seat taken' on yourself)");
  [s, r] = await other("/auth/signup", "POST", { name: "Other Person", email: mail("other"), password: "otherpass123" });
  await sql`UPDATE users SET email_verified = true WHERE email = ${mail("other")}`;
  [s, r] = await other("/payments/order", "POST", { ...base, seats: pair, total: price }); ok(s === 409, "someone else can't take seats you're paying for");
  const payId = "pay_e2e" + tag;
  [s, r] = await cust("/payments/verify", "POST", { razorpay_order_id: order.orderId, razorpay_payment_id: payId, razorpay_signature: "forged" }); ok(s === 400, "forged Razorpay signature refused");
  [s, r] = await cust("/payments/verify", "POST", { razorpay_order_id: order.orderId, razorpay_payment_id: payId, razorpay_signature: sign(order.orderId, payId) });
  const ticketId = r.id; ok(s === 200 && ticketId === order.bookingId, `payment confirmed: ticket ${ticketId}`);
  [s, r] = await cust("/me/tickets"); ok(r.tickets?.[0]?.id === ticketId && r.tickets[0].booking.date === tomorrow, "ticket saved to the account with its real date");
  [s, r] = await other("/me/tickets"); ok(!r.tickets.some((t) => t.id === ticketId), "other accounts don't see it");
  [s, r] = await anon(`/bookings/${ticketId}`); ok(s === 200 && r.mine === false && r.status === "confirmed", "shared link opens for anyone, without Cancel");
  [s, r] = await cust(`/bookings/${ticketId}`); ok(r.mine === true, "the owner sees it as theirs");

  // ---------- Pay (redirect flow, used in the Android app) ----------
  let seat3 = null, p3 = 0;
  for (const row of "KLMN") for (let n = 2; n < 20 && !seat3; n++) {
    const [st, rr] = await cust("/payments/order", "POST", { ...base, seats: [row + n], total: 0 });
    if (st === 409 && /₹\d+/.test(rr.error ?? "")) { seat3 = [row + n]; p3 = priceOf(rr); }
  }
  [s, r] = await cust("/payments/order", "POST", { ...base, seats: seat3, total: p3 });
  if (s === 201) {
    const o3 = r;
    const failForm = new URLSearchParams({ "error[code]": "BAD_REQUEST_ERROR", "error[description]": "Card declined (test)", "error[metadata]": JSON.stringify({ order_id: o3.orderId }) });
    let [st, , loc] = await anon("/payments/callback", "POST", undefined, failForm);
    ok(st === 303 && loc?.includes("/book/pay?failed=Card%20declined"), "failed redirect payment goes back to the pay page with the reason");
    [, r] = await anon(`/shows/${showKey}/booked-seats`); ok(!r.seats.includes(seat3[0]), "and releases the held seat");
    [st, r] = await cust("/payments/order", "POST", { ...base, seats: seat3, total: p3 }); const o4 = r;
    const okForm = new URLSearchParams({ razorpay_payment_id: "pay_e2eB" + tag, razorpay_order_id: o4.orderId, razorpay_signature: sign(o4.orderId, "pay_e2eB" + tag) });
    [st, , loc] = await anon("/payments/callback", "POST", undefined, okForm);
    ok(st === 303 && loc?.endsWith(`/ticket/${o4.bookingId}?paid=1`), "successful redirect payment opens the ticket");
  } else ok(false, `couldn't start the redirect test (${s} ${r.error})`);

  // ---------- Check-in at the entrance ----------
  [s, r] = await admin("/admin/checkin", "POST", { code: `PICKMYSEAT|${ticketId}|${pair.join(",")}` });
  ok(s === 409 && r.result === "wrong-day", "ticket for tomorrow: 'wrong day' warning");
  [s, r] = await admin("/admin/checkin", "POST", { code: ticketId, force: true }); ok(s === 200 && r.result === "ok", "admin lets them in anyway");
  [s, r] = await admin("/admin/checkin", "POST", { code: ticketId }); ok(s === 409 && r.result === "used", "second scan: already used");
  [s, r] = await admin("/admin/checkin", "POST", { code: "PMS00000000" }); ok(s === 404, "unknown ticket refused");
  [s, r] = await cust("/admin/checkin", "POST", { code: ticketId }); ok(s === 403, "customers can't check tickets in");
  [s, r] = await cust(`/bookings/${ticketId}/cancel`, "POST"); ok(s === 409 && /used/.test(r.error), "a used ticket can't be cancelled");

  // ---------- Cancellation and refunds ----------
  // A paid ticket: Razorpay refuses to refund this simulated payment, so nothing must change.
  await sql`UPDATE bookings SET checked_in_at = NULL WHERE id = ${ticketId}`;
  [s, r] = await cust(`/bookings/${ticketId}/cancel`, "POST"); ok(s === 502 && /Razorpay/.test(r.error), "if Razorpay can't refund, the cancel is refused");
  [s, r] = await anon(`/bookings/${ticketId}`); ok(r.status === "confirmed", "and the ticket stays valid");
  // An unpaid ticket (demo booking): cancel frees the seats.
  await sql`UPDATE bookings SET payment_id = NULL WHERE id = ${ticketId}`;
  [s, r] = await other(`/bookings/${ticketId}/cancel`, "POST"); ok(s === 404, "nobody else can cancel your ticket");
  [s, r] = await cust(`/bookings/${ticketId}/cancel`, "POST"); ok(s === 200, "customer cancels");
  [s, r] = await anon(`/bookings/${ticketId}`); ok(r.status === "cancelled", "ticket shows as cancelled");
  [s, r] = await anon(`/shows/${showKey}/booked-seats`); ok(!r.seats.includes(pair[0]), "its seats are on sale again");
  [s, r] = await admin("/admin/checkin", "POST", { code: ticketId }); ok(r.result === "cancelled", "a cancelled ticket can't get in");
  [s, r] = await cust(`/bookings/${ticketId}/cancel`, "POST"); ok(s === 409, "can't cancel twice");
  [s, r] = await admin(`/admin/overview?q=${mail("cust")}`); ok(r.recent.some((b) => b.id === ticketId && b.status === "cancelled"), "admin sees the cancellation");

  // ---------- Admin: customers ----------
  [s, r] = await admin(`/admin/users?q=${mail("cust")}`); ok(r.users?.[0]?.email_verified === true && r.users[0].phone === phone, "admin finds the customer");
  [s, r] = await admin("/admin/users", "POST", { id: custId, action: "reset" }); const temp = r.password;
  ok(s === 200 && /^[a-z]+-[a-z]+-\d{4}$/.test(temp), "admin gives a temporary password");
  [s, r] = await cust("/auth/me"); ok(r.user === null, "the reset signs the customer out everywhere");
  [s, r] = await cust("/auth/login", "POST", { login: mail("cust"), password: temp }); ok(s === 200, "they sign in with the temporary password");

  // ---------- Forgot password by e-mail ----------
  const stale = cust.cookie();
  [s, r] = await anon("/auth/forgot", "POST", { login: phone }); ok(s === 200 && r.mail && r.sentTo?.includes("•"), `reset code e-mailed to ${r.sentTo}`);
  [s, r] = await anon("/auth/forgot", "POST", { login: "9000000001" }); ok(s === 200 && r.sentTo === null, "unknown number: same answer, nothing revealed");
  await plantCode(custId, "reset", "135790");
  [s, r] = await anon("/auth/reset", "POST", { login: mail("cust"), code: "999999", password: "brandnew123" }); ok(s === 400, "wrong reset code refused");
  await plantCode(custId, "reset", "135790");
  [s, r] = await cust("/auth/reset", "POST", { login: mail("cust"), code: "135790", password: "brandnew123" }); ok(s === 200, "new password set with the code");
  const old = client(); old.setCookie(stale);
  [s, r] = await old("/auth/me"); ok(r.user === null, "devices signed in before the reset are signed out");
  [s, r] = await client()("/auth/login", "POST", { login: mail("cust"), password: "brandnew123" }); ok(s === 200, "sign in with the new password");

  // ---------- Reviews ----------
  [s, r] = await cust("/reviews", "POST", { movieId, rating: 4, comment: "Great test" }); ok(s === 200, "customer reviews the movie");
  [s, r] = await other("/reviews", "POST", { movieId, rating: 5 });
  [s, r] = await anon(`/reviews?movie=${movieId}`); ok(r.count === 2 && r.avg === 4.5, `audience rating ${r.avg} from ${r.count} reviews`);
  [s, r] = await client()("/reviews", "POST", { movieId, rating: 5 }); ok(s === 401, "review without signing in refused");

  // ---------- Release the block ----------
  [s, r] = await admin(`/admin/blocks?id=${blockId}`, "DELETE"); [, r] = await anon(`/shows/${showKey}/booked-seats`); ok(!r.seats.includes("E2"), "admin releases the blocked seats");
} catch (e) {
  fail++;
  console.log("FAIL test stopped:", e.message);
} finally {
  if (movieId) await sql`DELETE FROM bookings WHERE movie_id = ${movieId}`;
  await sql`DELETE FROM movies WHERE id LIKE 'zz-test-movie-%'`;
  await sql`DELETE FROM snacks WHERE name LIKE 'Test Samosa%'`;
  await sql`DELETE FROM users WHERE email LIKE '%@test.pickmyseat.dev'`;
  await sql.end();
  console.log(`\n${pass} passed, ${fail} failed (test data removed)`);
  process.exit(fail ? 1 : 0);
}
