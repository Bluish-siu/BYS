import { requireAdmin } from "@/lib/auth-server";
import { adminCatalog } from "@/lib/catalog-server";
import { layoutIds } from "@/lib/layouts";

export const dynamic = "force-dynamic";

// Everything the admin panel edits, including hidden movies and theatres, plus the seat layouts to choose from.
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("res" in a) return a.res;
  return Response.json({ ...(await adminCatalog()), layouts: layoutIds() });
}
