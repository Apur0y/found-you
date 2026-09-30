import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { apiError, serialize } from "@/lib/server";
import { researchLead } from "@/lib/gemini";
import { isValidObjectId } from "mongoose";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid lead id", 404);

  const body = await request.json().catch(() => ({}));
  const suppliedInfo = typeof body.info === "string" ? body.info : "";

  const leadDoc = await Lead.findById(id);
  if (!leadDoc) return apiError("Lead not found", 404);

  let game = null;
  if (leadDoc.gameId) game = await Game.findById(leadDoc.gameId);

  try {
    const result = await researchLead({
      lead: leadDoc.toObject(),
      game: game ? { title: game.title, url: game.url, source: game.source } : null,
      suppliedInfo,
    });

    leadDoc.verifiedInformation = result.knownInformation;
    leadDoc.inferredInformation = result.possibleSignals;
    leadDoc.missingInformation = result.missingInformation;
    leadDoc.research = {
      knownInformation: result.knownInformation,
      possibleSignals: result.possibleSignals,
      missingInformation: result.missingInformation,
      whyThisLead: result.whyThisLead,
      suggestedAngle: result.suggestedAngle,
    };
    await leadDoc.save();

    return Response.json({ lead: serialize(leadDoc) });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Research failed",
      502
    );
  }
}