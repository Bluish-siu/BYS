// Shows are booked by their real date (India time), and started shows can't be booked: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openDb } from "../src/db.js";
import { createApp, istDate } from "../src/app.js";

// 24 Nov 2026, 9:00 PM in India (15:30 UTC). The clock can be moved by changing `clock`.
let clock = Date.UTC(2026, 10, 24, 15, 30);
const server = createServer(createApp(openDb(":memory:"), { now: () => clock }));
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/api`;
const get = (p) => fetch(base + p).then(async (r) => [r.status, await r.json()]);
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => [r.status, await r.json()]);
const show = (showId, date, seats) => ({ movieId: "ramayana", theatreId: "mum-icon", city: "Mumbai", date, showId, time: "", format: "IMAX", seats, snacks: {}, total: 1000 });

test("India date, whatever the server's time zone", () => {
  assert.equal(istDate(0, Date.UTC(2026, 10, 24, 18, 29)), "2026-11-24"); // 11:59 PM in India
  assert.equal(istDate(0, Date.UTC(2026, 10, 24, 18, 30)), "2026-11-25"); // midnight in India, still the 24th in UTC
  assert.equal(istDate(1, Date.UTC(2026, 11, 31, 20, 0)), "2027-01-02");
});

test("a show that has started can't be booked", async () => {
  const [s, r] = await post("/bookings", show("mum-icon-18:55", "2026-11-24", ["A1"]));
  assert.equal(s, 400);
  assert.match(r.error, /already started/);
  const [s2] = await post("/bookings", show("mum-icon-23:00", "2026-11-24", ["A1"])); // later tonight: fine
  assert.equal(s2, 201);
});

test("dates in the past or too far ahead aren't on sale", async () => {
  assert.equal((await post("/bookings", show("mum-icon-23:00", "2026-11-23", ["A2"])))[0], 400);
  assert.equal((await post("/bookings", show("mum-icon-23:00", "2026-11-29", ["A2"])))[0], 400);
});

test("a booking made tonight for tomorrow still holds its seats after midnight", async () => {
  const tomorrow = "2026-11-25";
  const [s] = await post("/bookings", show("mum-icon-18:55", tomorrow, ["B5", "B6"]));
  assert.equal(s, 201);
  clock = Date.UTC(2026, 10, 24, 19, 0); // 12:30 AM in India: it is now the 25th
  const key = encodeURIComponent(`ramayana|mum-icon-18:55|${tomorrow}`);
  assert.deepEqual((await get(`/shows/${key}/booked-seats`))[1].seats.sort(), ["B5", "B6"], "same show, same seats");
  const [s2, r2] = await post("/bookings", show("mum-icon-18:55", tomorrow, ["B6"]));
  assert.equal(s2, 409, "the seat can't be sold again");
  assert.deepEqual(r2.taken, ["B6"]);
  server.close();
});
