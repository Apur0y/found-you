import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";
import { Lead } from "@/models/Lead";
import { apiError, normalizeUrl, parseOptionalInt, queryFilter, serialize } from "@/lib/server";
import { isValidObjectId, Types } from "mongoose";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid game id", 404);
  const game = await Game.findById(id);
  if (!game) return apiError("Game not found", 404);
  return Response.json({ game: serialize(game) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid game id", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid payload");

  const game = await Game.findById(id);
  if (!game) return apiError("Game not found", 404);

  const allowed: Record<string, (v: unknown) => unknown> = {
    title: (v) => String(v).trim(),
    sport: (v) => (v ? String(v).toLowerCase() : undefined),
    gender: (v) => (v ? String(v).toLowerCase() : undefined),
    date: (v) => (v ? new Date(v as string) : null),
    teamA: (v) => (v ? String(v) : undefined),
    teamB: (v) => (v ? String(v) : undefined),
    graduationYear: parseOptionalInt,
    url: (v) => normalizeUrl(v as string),
    source: (v) => (v ? String(v) : undefined),
    notes: (v) => (v ? String(v) : undefined),
  };

  for (const [key, converter] of Object.entries(allowed)) {
    if (key in body) {
      (game as unknown as Record<string, unknown>)[key] = converter(body[key]);
    }
  }

  await game.save();
  return Response.json({ game: serialize(game) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid game id", 404);
  const game = await Game.findByIdAndDelete(id);
  if (!game) return apiError("Game not found", 404);

  await Lead.updateMany(
    queryFilter({ gameId: new Types.ObjectId(id) }),
    { $set: { gameId: null } }
  );
  return Response.json({ ok: true });
}