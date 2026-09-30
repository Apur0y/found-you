import { connectDB } from "@/lib/mongodb";
import { Website } from "@/models/Website";
import { apiError, normalizeUrl, queryFilter, serialize } from "@/lib/server";
import { websiteCategorySchema } from "@/lib/schemas";

export async function GET(request: Request) {
  await connectDB();
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const sport = url.searchParams.get("sport")?.trim();

  const filter: Record<string, unknown> = {};
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { region: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { useCase: { $regex: q, $options: "i" } },
    ];
  }
  if (category && websiteCategorySchema.safeParse(category).success) {
    filter.category = category;
  }
  if (sport) filter.sports = new RegExp(`^${sport}$`, "i");

  const websites = await Website.find(queryFilter(filter)).sort({
    category: 1,
    name: 1,
  });
  return Response.json({ websites: serialize(websites) });
}

export async function POST(request: Request) {
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid payload");

  const name = String(body.name ?? "").trim();
  if (!name) return apiError("name is required");

  const url = normalizeUrl(String(body.url ?? ""));
  if (!url) return apiError("url is required");

  const categoryCheck = websiteCategorySchema.safeParse(body.category ?? "other");
  if (!categoryCheck.success) return apiError("Invalid category");

  const sports = Array.isArray(body.sports)
    ? body.sports.map((s: unknown) => String(s).trim().toLowerCase()).filter(Boolean)
    : [];

  const website = await Website.create({
    name,
    url,
    category: categoryCheck.data,
    sports,
    region: body.region ? String(body.region).trim() : "National",
    access: body.access ? String(body.access).trim() : "Free",
    description: body.description ? String(body.description) : "",
    useCase: body.useCase ? String(body.useCase) : "",
    notes: body.notes ? String(body.notes) : undefined,
  });

  return Response.json({ website: serialize(website) }, { status: 201 });
}
