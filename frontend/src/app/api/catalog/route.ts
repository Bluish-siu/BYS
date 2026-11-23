import { dbCatalog } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

// The public catalogue: movies, theatres, admin-set showtimes and audience ratings.
export async function GET() {
  try {
    return Response.json(await dbCatalog());
  } catch (e) {
    console.error("catalog failed:", (e as Error).message);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
}
