import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { apiError, serialize } from "@/lib/server";
import { scoreLead } from "@/lib/gemini";
import { isValidObjectId } from "mongoose";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid lead id", 404);

  const leadDoc = await Lead.findById(id);
  if (!leadDoc) return apiError("Lead not found", 404);

  let game = null;
  if (leadDoc.gameId) game = await Game.findById(leadDoc.gameId);

  try {
    const result = await scoreLead({
      lead: leadDoc.toObject(),
      game: game
        ? { title: game.title, url: game.url, date: game.date, analysis: game.analysis }
        : null,
    });

    leadDoc.score = result.score;
    leadDoc.scoreReasons = result.reasons;
    leadDoc.confidence = result.confidence;
    leadDoc.recommendedAction = result.recommendedAction;
    await leadDoc.save();

    return Response.json({ lead: serialize(leadDoc), score: result });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Lead scoring failed",
      502
    );
  }
}