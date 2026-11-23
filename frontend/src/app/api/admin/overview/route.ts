import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// Sales dashboard: revenue, tickets, customers, best-selling movies, the last 14 days, and recent bookings.
// ?q= searches bookings by ticket id, customer name, email or mobile number.
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  const db = sql!;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const like = `%${q}%`;
  const [totals, byMovie, byDay, users, recent] = await Promise.all([
    db`SELECT coalesce(sum(total), 0)::int AS revenue, count(*)::int AS bookings, coalesce(sum(jsonb_array_length(seats)), 0)::int AS tickets,
              coalesce(sum(total) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date), 0)::int AS today
       FROM bookings WHERE status = 'confirmed'`,
    db`SELECT movie_id, sum(total)::int AS revenue, sum(jsonb_array_length(seats))::int AS tickets
       FROM bookings WHERE status = 'confirmed' GROUP BY movie_id ORDER BY revenue DESC`,
    db`SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(sum(b.total), 0)::int AS revenue
       FROM generate_series((now() AT TIME ZONE 'Asia/Kolkata')::date - 13, (now() AT TIME ZONE 'Asia/Kolkata')::date, interval '1 day') AS d
       LEFT JOIN bookings b ON b.status = 'confirmed' AND (b.created_at AT TIME ZONE 'Asia/Kolkata')::date = d::date
       GROUP BY d ORDER BY d`,
    db`SELECT count(*)::int AS n FROM users`,
    db`SELECT b.id, b.movie_id, b.theatre_id, b.city, b.show_time, b.format, b.seats, b.total, b.status, b.payment_id, b.created_at,
              u.name AS customer, coalesce(u.email, u.phone) AS contact
       FROM bookings b LEFT JOIN users u ON u.id = b.user_id
       WHERE b.status = 'confirmed' AND (${q} = '' OR b.id ILIKE ${like} OR u.name ILIKE ${like} OR u.email ILIKE ${like} OR u.phone ILIKE ${like})
       ORDER BY b.created_at DESC LIMIT 100`,
  ]);
  return Response.json({ ...totals[0], customers: users[0].n, byMovie, byDay, recent });
}
