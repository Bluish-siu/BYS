// Checks the India-time date rules the website uses. Run from the project folder:  npm run test:dates
import { test } from "node:test";
import assert from "node:assert/strict";
import { bookableDates, dateLabel, hasStarted, istDate } from "../src/lib/dates.ts";

const at = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h, mi); // UTC time

test("today is India's date, not the server's (UTC)", () => {
  assert.equal(istDate(0, at(2026, 11, 24, 18, 29)), "2026-11-24"); // 11:59 PM in India
  assert.equal(istDate(0, at(2026, 11, 24, 18, 30)), "2026-11-25"); // 12:00 AM in India, still the 24th in UTC
  assert.equal(istDate(2, at(2026, 12, 30, 20, 0)), "2027-01-02");
});

test("five dates are on sale, starting today", () => {
  assert.deepEqual(bookableDates(at(2026, 11, 24, 6, 0)), ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"]);
});

test("a show has started once its time has passed, in India time", () => {
  const ninePmIst = at(2026, 11, 24, 15, 30);
  assert.equal(hasStarted("2026-11-24", "18:55", ninePmIst), true);
  assert.equal(hasStarted("2026-11-24", "21:00", ninePmIst), true, "starting right now counts as started");
  assert.equal(hasStarted("2026-11-24", "23:00", ninePmIst), false);
  assert.equal(hasStarted("2026-11-25", "07:00", ninePmIst), false, "tomorrow's morning show is still open");
  assert.equal(hasStarted("2026-11-23", "23:00", ninePmIst), true, "yesterday is always over");
});

test("the same show keeps the same date after midnight", () => {
  // Booked at 9 PM on the 24th for "tomorrow"; checked again at 12:30 AM.
  const booked = istDate(1, at(2026, 11, 24, 15, 30));
  assert.equal(booked, "2026-11-25");
  assert.equal(istDate(0, at(2026, 11, 24, 19, 0)), booked, "after midnight that date is today, so it is the same show");
});

test("labels", () => {
  const now = at(2026, 11, 24, 6, 0);
  assert.equal(dateLabel("2026-11-24", true, now), "Today");
  assert.equal(dateLabel("2026-11-25", true, now), "Tomorrow");
  assert.match(dateLabel("2026-11-26", true, now), /26 Nov/);
});
