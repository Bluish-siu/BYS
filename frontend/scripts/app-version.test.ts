// Checks how the website decides that the Android app is out of date. Run from the project folder: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { appVersion, isOlder } from "../src/lib/app-version.ts";

test("reads the app version from the user agent", () => {
  assert.equal(appVersion("Mozilla/5.0 (Linux; Android 14; wv) Chrome/131 Mobile Safari/537.36 PickMySeatApp/1.2"), "1.2");
  assert.equal(appVersion("Mozilla/5.0 (Windows NT 10.0) Chrome/131"), null, "a normal browser is not the app");
});

test("compares versions number by number", () => {
  assert.equal(isOlder("1.2", "1.3"), true);
  assert.equal(isOlder("1.3", "1.3"), false);
  assert.equal(isOlder("1.10", "1.9"), false, "1.10 is newer than 1.9");
  assert.equal(isOlder("1.3", "1.3.1"), true);
  assert.equal(isOlder("2.0", "1.9"), false);
});
