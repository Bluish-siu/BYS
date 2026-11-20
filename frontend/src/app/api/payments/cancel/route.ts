export const dynamic = "force-dynamic";

// Without a database on the hosted site there is no seat hold to release. The full backend/ server does release seats.
export function POST() {
  return Response.json({ released: false });
}
