import { sql } from "@/lib/db";
import { currentUser, publicUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// Who is signed in. "enabled" is false when the site has no database, so the pages hide sign-in.
export async function GET(req: Request) {
  if (!sql) return Response.json({ enabled: false, user: null });
  const u = await currentUser(req).catch(() => null);
  return Response.json({ enabled: true, user: u ? publicUser(u) : null });
}
