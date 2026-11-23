// Server-only accounts: sign-in with an email address or Indian mobile number and a password.
// Passwords are stored as scrypt hashes. The session is a signed, HttpOnly cookie (no session table needed).
import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "pms_session";
const DAYS = 30;

export type User = { id: string; name: string; email: string | null; phone: string | null; role: "user" | "admin"; email_verified: boolean; session_version: number };

// AUTH_SECRET signs the cookie. Without it, a secret is derived from DATABASE_URL, which is private too.
const secret = () => process.env.AUTH_SECRET?.trim() || createHash("sha256").update("pickmyseat-session|" + (process.env.DATABASE_URL ?? "")).digest("hex");

/** "Email or mobile number" -> which column it belongs to, or an error. Mobile numbers are stored as 10 digits. */
export function parseLogin(input: unknown): { email: string } | { phone: string } | { error: string } {
  const v = String(input ?? "").trim();
  if (v.includes("@")) {
    const email = v.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 120 ? { email } : { error: "Enter a valid email address" };
  }
  const digits = v.replace(/[\s-]/g, "").replace(/^(\+91|91(?=\d{10}$)|0)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? { phone: digits } : { error: "Enter a valid email or 10-digit mobile number" };
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await scrypt(pw, salt, 32)).toString("base64")}`;
}

export async function passwordOk(pw: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await scrypt(pw, Buffer.from(salt, "base64"), want.length);
  return timingSafeEqual(want, got);
}

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

// Cookie value: userId.sessionVersion.expiry.signature. Changing the password bumps the account's
// session version, which signs out every other phone and browser.
function readSession(req: Request): { id: string; ver: number } | null {
  const raw = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [id, ver, exp, mac] = decodeURIComponent(raw).split(".");
  if (!id || !ver || !exp || !mac || Number(exp) < Date.now() / 1000) return null;
  const want = Buffer.from(sign(`${id}.${ver}.${exp}`));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? { id, ver: Number(ver) } : null;
}

/** The signed-in user for this request, or null. */
export async function currentUser(req: Request): Promise<User | null> {
  const s = readSession(req);
  if (!s || !sql || !/^[0-9a-f-]{36}$/.test(s.id)) return null;
  const [u] = await sql<User[]>`SELECT id, name, email, phone, role, email_verified, session_version FROM users WHERE id = ${s.id}`;
  return u && u.session_version === s.ver ? u : null;
}

/** Finds an account by email or mobile number (as typed on the sign-in page). */
export async function findUser(login: { email: string } | { phone: string }) {
  const [u] = "email" in login
    ? await sql!<(User & { password_hash: string })[]>`SELECT id, name, email, phone, role, email_verified, session_version, password_hash FROM users WHERE email = ${login.email}`
    : await sql!<(User & { password_hash: string })[]>`SELECT id, name, email, phone, role, email_verified, session_version, password_hash FROM users WHERE phone = ${login.phone}`;
  return u ?? null;
}

// ---------- One-time codes (verify email, reset password) ----------

const codeHash = (userId: string, purpose: string, code: string) => createHmac("sha256", secret()).update(`${userId}|${purpose}|${code}`).digest("hex");

/** Makes a 6-digit code valid for 10 minutes, or returns null if one was sent less than a minute ago. */
export async function newCode(userId: string, purpose: "verify" | "reset"): Promise<string | null> {
  const [recent] = await sql!`SELECT 1 FROM auth_codes WHERE user_id = ${userId} AND purpose = ${purpose} AND created_at > now() - interval '60 seconds'`;
  if (recent) return null;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await sql!`INSERT INTO auth_codes (user_id, purpose, code_hash, expires_at)
             VALUES (${userId}, ${purpose}, ${codeHash(userId, purpose, code)}, now() + interval '10 minutes')
             ON CONFLICT (user_id, purpose) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0, created_at = now(), expires_at = excluded.expires_at`;
  return code;
}

/** Checks a code. After 5 wrong tries a new code is needed. A correct code is used up. */
export async function checkCode(userId: string, purpose: "verify" | "reset", code: unknown): Promise<"ok" | "wrong" | "expired"> {
  const [row] = await sql!`UPDATE auth_codes SET attempts = attempts + 1 WHERE user_id = ${userId} AND purpose = ${purpose}
                           RETURNING code_hash, attempts, expires_at < now() AS expired`;
  if (!row || row.expired || row.attempts > 5) return "expired";
  const want = Buffer.from(row.code_hash as string);
  const got = Buffer.from(codeHash(userId, purpose, String(code ?? "").trim()));
  if (want.length !== got.length || !timingSafeEqual(want, got)) return "wrong";
  await sql!`DELETE FROM auth_codes WHERE user_id = ${userId} AND purpose = ${purpose}`;
  return "ok";
}

/** "shraddha@gmail.com" -> "sh••••••a@gmail.com": shows where a code went without revealing the address. */
export const maskEmail = (e: string) => e.replace(/^(.{2})(.*)(.@.*)$/, (_m, a: string, b: string, c: string) => a + "•".repeat(Math.min(6, b.length)) + c);

const cookieAttrs = (req: Request) => `Path=/; HttpOnly; SameSite=Lax${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;

export function sessionCookie(req: Request, user: Pick<User, "id" | "session_version">) {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  const value = `${user.id}.${user.session_version}.${exp}`;
  return `${COOKIE}=${encodeURIComponent(`${value}.${sign(value)}`)}; Max-Age=${DAYS * 86400}; ${cookieAttrs(req)}`;
}

export const clearCookie = (req: Request) => `${COOKIE}=; Max-Age=0; ${cookieAttrs(req)}`;

export const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, emailVerified: u.email_verified });

/** For admin routes: the admin user, or a ready 401/403 response. */
export async function requireAdmin(req: Request): Promise<{ user: User } | { res: Response }> {
  if (!sql) return { res: Response.json({ error: "The database is not set up" }, { status: 503 }) };
  const user = await currentUser(req);
  if (!user) return { res: Response.json({ error: "Please sign in" }, { status: 401 }) };
  if (user.role !== "admin") return { res: Response.json({ error: "Admins only" }, { status: 403 }) };
  return { user };
}
