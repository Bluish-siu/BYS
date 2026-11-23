// Server-only connection to the PickMySeat Postgres database (Supabase), from DATABASE_URL.
// Without DATABASE_URL the site still runs, but bookings are not stored and seats are not locked.
import postgres from "postgres";

const url = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { pmsSql?: Sql };

/** The shared client, or null when no database is set up. Use Supabase's session pooler (port 5432): the transaction pooler (6543) can stall when several queries are sent together. */
export const sql: Sql | null = url
  ? (g.pmsSql ??= postgres(url, { ssl: "require", prepare: false, max: 2, idle_timeout: 20, connect_timeout: 10 }))
  : null;
