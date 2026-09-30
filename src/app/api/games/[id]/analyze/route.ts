import { connectDB } from "@/lib/mongodb";
import { Game } from "@/models/Game";
import { apiError, serialize } from "@/lib/server";
import { analyzeGame } from "@/lib/gemini";
import { isValidObjectId } from "mongoose";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid game id", 404);

  const game = await Game.findById(id);
  if (!game) return apiError("Game not found", 404);

  try {
    // Metadata-only analysis. The model is explicitly told it has no video access.
    const analysis = await analyzeGame({
      title: game.title,
      sport: game.sport,
      date: game.date ? game.date.toISOString() : undefined,
      teamA: game.teamA,
      teamB: game.teamB,
      graduationYear: game.graduationYear,
      url: game.url,
      source: game.source,
      notes: game.notes,
    });

    game.analysis = {
      sport: analysis.sport ?? game.sport,
      gender: analysis.gender ?? game.gender,
      recruitingRelevant: analysis.recruitingRelevant,
      gameType: analysis.gameType ?? undefined,
      summary: analysis.summary || undefined,
      confidence: analysis.confidence,
      reason: analysis.reason || undefined,
      analyzedAt: new Date(),
      analysisBasis: "metadata",
    };
    if (analysis.sport) game.sport = analysis.sport;
    if (analysis.teamA) game.teamA = analysis.teamA;
    if (analysis.teamB) game.teamB = analysis.teamB;
    if (analysis.graduationYear) game.graduationYear = analysis.graduationYear;
    await game.save();

    return Response.json({ game: serialize(game), analysis });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Game analysis failed",
      502
    );
  }
}