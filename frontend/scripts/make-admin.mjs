// Gives an existing PickMySeat account admin rights (or takes them away with --remove).
// The person signs up on the website first. Then, from the project folder:
//   npm run make-admin -- someone@example.com
//   npm run make-admin -- 9876543210 --remove
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = process.env.DATABASE_URL ?? env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const who = process.argv[2]?.trim();
if (!url || !who) { console.log("Usage: npm run make-admin -- <email or mobile number> [--remove]"); process.exit(1); }
const role = process.argv.includes("--remove") ? "user" : "admin";
const phone = who.replace(/[\s-]/g, "").replace(/^(\+91|0)/, "");

const sql = postgres(url, { ssl: "require", prepare: false, max: 1 });
const rows = await sql`UPDATE users SET role = ${role} WHERE email = ${who.toLowerCase()} OR phone = ${phone} RETURNING name, coalesce(email, phone) AS login`;
console.log(rows.length ? `${rows[0].name} (${rows[0].login}) is now ${role === "admin" ? "an admin" : "a regular user"}.` : `No account found for ${who}. Sign up on the website first.`);
await sql.end();
