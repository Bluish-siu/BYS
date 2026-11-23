// Creates the PickMySeat tables in the Postgres database named by DATABASE_URL (frontend/.env.local).
// Run from the project folder:  npm run db:pg
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = process.env.DATABASE_URL ?? env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL is not set in frontend/.env.local");

const sql = postgres(url, { ssl: "require", prepare: false, max: 1, onnotice: () => {} });
await sql.unsafe(readFileSync(new URL("../../database/schema.sql", import.meta.url), "utf8"));
const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
console.log("Tables:", tables.map((t) => t.table_name).join(", "));
await sql.end();
