import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";
import { apiError, normalizeUrl, parseOptionalInt, serialize } from "@/lib/server";

export async function GET(request: Request) {
  await connectDB();
  const url = new URL(request.url);
  const analyzed = url.searchParams.get("analyzed");
  const q = url.searchParams.get("q")?.trim();
  const limit = parseOptionalInt(url.searchParams.get("limit")) ?? 100;

  const filter: Record<string, unknown> = {};
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { teamA: { $regex: q, $options: "i" } },
      { teamB: { $regex: q, $options: "i" } },
      { source: { $regex: q, $options: "i" } },
    ];
  }
  if (analyzed === "true") filter["analysis.recruitingRelevant"] = { $exists: true };
  if (analyzed === "false") filter["analysis.recruitingRelevant"] = { $exists: false };

  const games = await Game.find(filter).sort({ createdAt: -1 }).limit(limit);
  return Response.json({ games: serialize(games) });
}

export async function POST(request: Request) {
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid payload");

  const title = String(body.title ?? "").trim();
  if (!title) return apiError("title is required");

  const game = await Game.create({
    title,
    sport: body.sport ? String(body.sport).toLowerCase() : undefined,
    gender: body.gender ? String(body.gender).toLowerCase() : undefined,
    date: body.date ? new Date(body.date) : null,
    teamA: body.teamA ? String(body.teamA) : undefined,
    teamB: body.teamB ? String(body.teamB) : undefined,
    graduationYear: parseOptionalInt(body.graduationYear),
    url: normalizeUrl(body.url),
    source: body.source ? String(body.source) : undefined,
    notes: body.notes ? String(body.notes) : undefined,
  });

  return Response.json({ game: serialize(game) }, { status: 201 });
}