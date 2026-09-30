import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { Outreach } from "@/models/Outreach";
import { queryFilter, apiError, serialize } from "@/lib/server";
import { interpretCommand, scoreLead, generateOutreach, analyzeGame } from "@/lib/gemini";
import { buildLeadFilter, describePlan } from "@/lib/commands";
import { Types } from "mongoose";

const BATCH_LIMIT = 10;

export async function POST(request: Request) {
  await connectDB();
  const body = await request.json().catch(() => null);
  const command = typeof body?.command === "string" ? body.command.trim() : "";
  if (!command) return apiError("command is required");

  try {
    const plan = await interpretCommand(command);
    const filter = buildLeadFilter(plan.filters);
    const results: { action: string; leadIds: string[]; count: number; note?: string } = {
      action: plan.action,
      leadIds: [],
      count: 0,
    };

    if (plan.action === "show_games") {
      const games = await Game.find(filter)
        .sort({ createdAt: -1 })
        .limit(plan.filters.limit ?? 20);
      return Response.json({
        plan,
        explanation: describePlan(plan),
        games: serialize(games),
      });
    }

    if (plan.action === "analyze_games") {
      const games = await Game.find({ "analysis.recruitingRelevant": { $exists: false } })
        .sort({ createdAt: -1 })
        .limit(BATCH_LIMIT);
      let analyzed = 0;
      for (const game of games) {
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
          recruitingRelevant: analysis.recruitingRelevant,
          gameType: analysis.gameType ?? undefined,
          summary: analysis.summary || undefined,
          confidence: analysis.confidence,
          analyzedAt: new Date(),
          analysisBasis: "metadata",
        };
        if (analysis.sport) game.sport = analysis.sport;
        await game.save();
        analyzed++;
      }
      return Response.json({
        plan,
        explanation: describePlan(plan),
        result: { analyzed, total: games.length },
      });
    }

    // lead-based actions
    const docs = await Lead.find(filter)
      .sort({ score: -1, createdAt: -1 })
      .limit(plan.filters.limit ?? 50);
    results.count = docs.length;
    results.leadIds = docs.map((d) => d._id.toString());

    if (plan.action === "score_leads" && docs.length > 0) {
      const target = docs.slice(0, BATCH_LIMIT);
      for (const doc of target) {
        let game = null;
        if (doc.gameId) game = await Game.findById(doc.gameId);
        const result = await scoreLead({
          lead: doc.toObject(),
          game: game
            ? { title: game.title, url: game.url, date: game.date, analysis: game.analysis }
            : null,
        });
        doc.score = result.score;
        doc.scoreReasons = result.reasons;
        doc.confidence = result.confidence;
        doc.recommendedAction = result.recommendedAction;
        doc.status = result.recommendedAction.includes("outreach") && doc.status === "new"
          ? "qualified"
          : doc.status;
        await doc.save();
      }
      results.note = `Scored ${target.length} leads (batch limit ${BATCH_LIMIT}).`;
    }

    if (plan.action === "generate_messages" && docs.length > 0) {
      const target = docs.slice(0, BATCH_LIMIT);
      const serviceDescription =
        process.env.SERVICE_DESCRIPTION ||
        "Turn full-game footage into clean player-specific recruiting highlight videos.";
      let generated = 0;
      for (const doc of target) {
        let game = null;
        if (doc.gameId) game = await Game.findById(doc.gameId);
        const result = await generateOutreach({
          lead: doc.toObject(),
          game: game ? { title: game.title, url: game.url } : null,
          research: doc.research ?? null,
          serviceDescription,
        });
        doc.outreachMessage = result.message;
        if (doc.status === "new" || doc.status === "qualified")
          doc.status = "message_ready";
        await doc.save();

        const exists = await Outreach.findOne({ leadId: doc._id }).sort({ createdAt: -1 });
        if (exists) {
          exists.message = result.message;
          exists.status = "draft";
          await exists.save();
        } else {
          await Outreach.create({
            leadId: doc._id,
            message: result.message,
            channel: doc.email ? "email" : "other",
            status: "draft",
          } as never);
        }
        generated++;
      }
      results.note = `Generated messages for ${generated} leads (batch limit ${BATCH_LIMIT}).`;
    }

    const finalDocs = await Lead.find(
      queryFilter({
        _id: { $in: results.leadIds.map((v) => new Types.ObjectId(v)) },
      })
    ).sort({ score: -1, createdAt: -1 });
    return Response.json({
      plan,
      explanation: describePlan(plan),
      result: results,
      leads: serialize(finalDocs),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Command execution failed";
    return apiError(message, 502);
  }
}