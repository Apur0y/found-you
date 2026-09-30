import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { apiError, normalizeUrl, parseOptionalInt, serialize } from "@/lib/server";
import { leadStatusSchema } from "@/lib/schemas";
import { LEAD_STATUSES } from "@/lib/statuses";

export async function GET(request: Request) {
  await connectDB();
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const sport = url.searchParams.get("sport")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const minScore = parseOptionalInt(url.searchParams.get("minScore"));
  const hasGame = url.searchParams.get("hasGame");
  const sortRaw = url.searchParams.get("sort") || "createdAt";
  const limit = parseOptionalInt(url.searchParams.get("limit")) ?? 200;

  const filter: Record<string, unknown> = {};
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { playerName: { $regex: q, $options: "i" } },
      { team: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }
  if (sport) filter.sport = new RegExp(`^${sport}$`, "i");
  if (status && LEAD_STATUSES.includes(status as never)) filter.status = status;
  if (typeof minScore === "number") filter.score = { $gte: minScore };
  if (hasGame === "true") filter.gameId = { $ne: null };
  if (hasGame === "false") filter.$or = [{ gameId: null }, { gameId: { $exists: false } }];

  const sort: Record<string, 1 | -1> =
    sortRaw === "score" ? { score: -1 } : { createdAt: -1 };

  const leads = await Lead.find(filter).sort(sort).limit(limit);
  return Response.json({ leads: serialize(leads) });
}

export async function POST(request: Request) {
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid payload");

  const name = String(body.name ?? "").trim();
  if (!name) return apiError("name is required");

  const statusCheck = leadStatusSchema.safeParse(body.status ?? "new");
  if (!statusCheck.success) return apiError("Invalid status");

  const lead = await Lead.create({
    name,
    playerName: body.playerName ? String(body.playerName) : undefined,
    contactType: body.contactType || "unknown",
    sport: body.sport ? String(body.sport) : undefined,
    position: body.position ? String(body.position) : undefined,
    team: body.team ? String(body.team) : undefined,
    graduationYear: parseOptionalInt(body.graduationYear),
    email: body.email ? String(body.email) : undefined,
    socialUrl: normalizeUrl(body.socialUrl),
    profileUrl: normalizeUrl(body.profileUrl),
    gameId: body.gameId || undefined,
    source: body.source ? String(body.source) : undefined,
    notes: body.notes ? String(body.notes) : undefined,
    verifiedInformation: body.verifiedInformation ?? [],
    evidence: body.evidence ?? [],
    status: statusCheck.data,
  });

  return Response.json({ lead: serialize(lead) }, { status: 201 });
}