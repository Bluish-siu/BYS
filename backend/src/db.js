// Opens the SQLite database and creates it from database/schema.sql + seed.sql on first run.
// Uses Node's built-in SQLite driver, so the backend has no npm dependencies.
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseDir = path.resolve(backendDir, "../database");

export function openDb(file = process.env.DB_PATH ?? "../database/pickmyseat.db") {
  const dbPath = file === ":memory:" ? file : path.resolve(backendDir, file);
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(readFileSync(path.join(databaseDir, "schema.sql"), "utf8"));
  // Databases created before payments existed: add the new booking columns.
  let cols = new Set(db.prepare("PRAGMA table_info(bookings)").all().map((c) => c.name));
  // Databases from before shows had real dates stored "days from today" in a "day" column.
  if (cols.has("day") && !cols.has("show_date")) {
    db.exec("ALTER TABLE bookings RENAME COLUMN day TO show_date");
    cols = new Set(db.prepare("PRAGMA table_info(bookings)").all().map((c) => c.name));
  }
  for (const [name, type] of [["expires_at", "TEXT"], ["payment_order_id", "TEXT"], ["payment_id", "TEXT"]])
    if (!cols.has(name)) db.exec(`ALTER TABLE bookings ADD COLUMN ${name} ${type}`);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_order ON bookings(payment_order_id)");
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM movies").get();
  if (n === 0) db.exec(readFileSync(path.join(databaseDir, "seed.sql"), "utf8"));
  return db;
}

// `npm run db:reset` deletes the database file so the next start rebuilds it from the seed.
if (process.argv.includes("--reset")) {
  const dbPath = path.resolve(backendDir, process.env.DB_PATH ?? "../database/pickmyseat.db");
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) if (existsSync(f)) rmSync(f);
  openDb().close();
  console.log("Database reset:", dbPath);
}
