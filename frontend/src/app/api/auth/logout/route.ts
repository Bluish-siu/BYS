import { clearCookie } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearCookie(req) } });
}
