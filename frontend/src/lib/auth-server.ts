// Server-only accounts: sign-in with an email address or Indian mobile number and a password.
// Passwords are stored as scrypt hashes. The session is a signed, HttpOnly cookie (no session table needed).
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sql } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "pms_session";
const DAYS = 30;

export type User = { id: string; name: string; email: string | null; phone: string | null; role: "user" | "admin" };

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

function sessionUserId(req: Request): string | null {
  const raw = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [id, exp, mac] = decodeURIComponent(raw).split(".");
  if (!id || !exp || !mac || Number(exp) < Date.now() / 1000) return null;
  const want = Buffer.from(sign(`${id}.${exp}`));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

/** The signed-in user for this request, or null. */
export async function currentUser(req: Request): Promise<User | null> {
  const id = sessionUserId(req);
  if (!id || !sql || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const [u] = await sql<User[]>`SELECT id, name, email, phone, role FROM users WHERE id = ${id}`;
  return u ?? null;
}

const cookieAttrs = (req: Request) => `Path=/; HttpOnly; SameSite=Lax${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;

export function sessionCookie(req: Request, userId: string) {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  const value = `${userId}.${exp}`;
  return `${COOKIE}=${encodeURIComponent(`${value}.${sign(value)}`)}; Max-Age=${DAYS * 86400}; ${cookieAttrs(req)}`;
}

export const clearCookie = (req: Request) => `${COOKIE}=; Max-Age=0; ${cookieAttrs(req)}`;

export const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

/** For admin routes: the admin user, or a ready 401/403 response. */
export async function requireAdmin(req: Request): Promise<{ user: User } | { res: Response }> {
  if (!sql) return { res: Response.json({ error: "The database is not set up" }, { status: 503 }) };
  const user = await currentUser(req);
  if (!user) return { res: Response.json({ error: "Please sign in" }, { status: 401 }) };
  if (user.role !== "admin") return { res: Response.json({ error: "Admins only" }, { status: 403 }) };
  return { user };
}
