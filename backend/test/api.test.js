// Runs the API against an in-memory database: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { openDb } from "../src/db.js";
import { createApp, istDate } from "../src/app.js";

const server = createServer(createApp(openDb(":memory:")));
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/api`;
const get = (p) => fetch(base + p).then(async (r) => [r.status, await r.json()]);
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => [r.status, await r.json()]);

const booking = { movieId: "ramayana", theatreId: "mum-icon", city: "Mumbai", date: istDate(1), showId: "mum-icon-10:45", time: "10:45 AM", format: "IMAX", seats: ["N6", "N7"], snacks: { cola: 1 }, total: 5720 };

test("catalogue endpoints", async () => {
  const [s1, movies] = await get("/movies");
  assert.equal(s1, 200);
  assert.ok(movies.length >= 1);
  const [, theatres] = await get("/theatres?city=Mumbai");
  assert.ok(theatres.every((t) => Array.isArray(t.formats)));
  const [s2] = await get("/movies/not-a-movie");
  assert.equal(s2, 404);
});

test("booking reserves seats and blocks double booking", async () => {
  const [s1, b] = await post("/bookings", booking);
  assert.equal(s1, 201);
  assert.match(b.id, /^PMS[0-9A-F]{8}$/);
  assert.deepEqual(b.seats, ["N6", "N7"]);

  const key = encodeURIComponent(`ramayana|mum-icon-10:45|${istDate(1)}`);
  const [, booked] = await get(`/shows/${key}/booked-seats`);
  assert.deepEqual(booked.seats.sort(), ["N6", "N7"]);

  const [s2, clash] = await post("/bookings", { ...booking, seats: ["N7", "N8"] });
  assert.equal(s2, 409);
  assert.deepEqual(clash.taken, ["N7"]);

  const [, after] = await get(`/shows/${key}/booked-seats`);
  assert.equal(after.seats.length, 2, "a failed booking must not reserve any seat");

  const [s3, fetched] = await get(`/bookings/${b.id}`);
  assert.equal(s3, 200);
  assert.equal(fetched.total, 5720);
});

test("rejects bad input", async () => {
  assert.equal((await post("/bookings", { ...booking, movieId: "nope" }))[0], 400);
  assert.equal((await post("/bookings", { ...booking, seats: [] }))[0], 400);
  assert.equal((await post("/bookings", { ...booking, seats: ["A1", "A1"] }))[0], 400);
  assert.equal((await post("/bookings", { ...booking, total: -5 }))[0], 400);
});

test.after(() => server.close());
