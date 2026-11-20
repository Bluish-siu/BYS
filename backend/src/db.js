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
