// Payment flow with a stand-in for Razorpay (no network): npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { verifySignature } from "../src/razorpay.js";

const SECRET = "test_secret";
let n = 0;
const fakeRazorpay = {
  keyId: "rzp_test_FAKE",
  createOrder: async ({ amount }) => ({ id: `order_TEST${++n}`, amount, currency: "INR" }),
  verify: (o, p, s) => verifySignature(SECRET, o, p, s),
};
const sign = (orderId, paymentId) => createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");

const db = openDb(":memory:");
const server = createServer(createApp(db, { razorpay: fakeRazorpay }));
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/api`;
const get = (p) => fetch(base + p).then(async (r) => [r.status, await r.json()]);
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => [r.status, await r.json()]);
const key = encodeURIComponent("ramayana|mum-icon-14:50|1");
const booking = { movieId: "ramayana", theatreId: "mum-icon", city: "Mumbai", day: 1, showId: "mum-icon-14:50", time: "02:50 PM", format: "IMAX", seats: ["K10", "K11"], snacks: {}, total: 2430 };

test("config reports test mode", async () => {
  const [, cfg] = await get("/payments/config");
  assert.deepEqual(cfg, { razorpay: true, keyId: "rzp_test_FAKE", mode: "test" });
});

test("direct booking is refused when payments are on", async () => {
  assert.equal((await post("/bookings", booking))[0], 403);
});

test("order holds seats, verified payment confirms the ticket", async () => {
  const [s1, order] = await post("/payments/order", booking);
  assert.equal(s1, 201);
  assert.equal(order.amount, 243000, "amount is sent to Razorpay in paise");
  assert.equal((await get(`/shows/${key}/booked-seats`))[1].seats.length, 2, "seats are held while paying");
  assert.equal((await post("/payments/order", booking))[0], 409, "someone else cannot grab held seats");

  assert.equal((await post("/payments/verify", { razorpay_order_id: order.orderId, razorpay_payment_id: "pay_X", razorpay_signature: "forged" }))[0], 400);

  const [s2, done] = await post("/payments/verify", { razorpay_order_id: order.orderId, razorpay_payment_id: "pay_OK1", razorpay_signature: sign(order.orderId, "pay_OK1") });
  assert.equal(s2, 200);
  assert.equal(done.status, "confirmed");
  assert.equal(done.payment_id, "pay_OK1");
  assert.equal(done.id, order.bookingId);
});

test("closing the payment window releases the seats", async () => {
  const b = { ...booking, seats: ["J1"] };
  const [, order] = await post("/payments/order", b);
  const [, res] = await post("/payments/cancel", { orderId: order.orderId });
  assert.equal(res.released, true);
  assert.ok(!(await get(`/shows/${key}/booked-seats`))[1].seats.includes("J1"));
});

test("an expired hold frees the seats and rejects a late payment", async () => {
  const b = { ...booking, seats: ["J5"] };
  const [, order] = await post("/payments/order", b);
  db.prepare("UPDATE bookings SET expires_at = datetime('now', '-1 minute') WHERE id = ?").run(order.bookingId);
  assert.ok(!(await get(`/shows/${key}/booked-seats`))[1].seats.includes("J5"));
  const [s] = await post("/payments/verify", { razorpay_order_id: order.orderId, razorpay_payment_id: "pay_LATE", razorpay_signature: sign(order.orderId, "pay_LATE") });
  assert.equal(s, 410);
});

test.after(() => server.close());
