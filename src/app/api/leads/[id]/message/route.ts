import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { Outreach } from "@/models/Outreach";
import { apiError, serialize } from "@/lib/server";
import { generateOutreach } from "@/lib/gemini";
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

  const serviceDescription =
    process.env.SERVICE_DESCRIPTION ||
    "Turn full-game footage into clean player-specific recruiting highlight videos.";

  try {
    const result = await generateOutreach({
      lead: leadDoc.toObject(),
      game: game ? { title: game.title, url: game.url } : null,
      research: leadDoc.research ?? null,
      serviceDescription,
    });

    leadDoc.outreachMessage = result.message;
    if (leadDoc.status === "new") leadDoc.status = "message_ready";
    await leadDoc.save();

    let outreach = await Outreach.findOne({ leadId: leadDoc._id }).sort({
      createdAt: -1,
    });
    if (outreach) {
      outreach.message = result.message;
      outreach.status = "draft";
      await outreach.save();
    } else {
      outreach = await Outreach.create({
        leadId: leadDoc._id,
        message: result.message,
        channel: leadDoc.email ? "email" : "other",
        status: "draft",
      } as never);
    }

    return Response.json({
      lead: serialize(leadDoc),
      outreach: serialize(outreach),
    });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Message generation failed",
      502
    );
  }
}