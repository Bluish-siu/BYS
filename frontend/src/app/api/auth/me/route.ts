import { sql } from "@/lib/db";
import { currentUser, publicUser } from "@/lib/auth-server";
import { mailEnabled } from "@/lib/mail";

export const dynamic = "force-dynamic";

// Who is signed in. "enabled" is false when the site has no database, so the pages hide sign-in.
// "verifyRequired" is true when e-mail is set up: then an account must confirm its email before buying tickets.
export async function GET(req: Request) {
  if (!sql) return Response.json({ enabled: false, user: null, verifyRequired: false, mail: false });
  const u = await currentUser(req).catch(() => null);
  return Response.json({ enabled: true, user: u ? publicUser(u) : null, verifyRequired: mailEnabled, mail: mailEnabled });
}
