import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { Outreach } from "@/models/Outreach";
import { serialize, queryFilter } from "@/lib/server";
import type { GameDTO, LeadDTO } from "@/types";
import { isValidObjectId, Types } from "mongoose";

export async function GET() {
  await connectDB();

  const [
    totalLeads,
    newLeads,
    highPotential,
    outreachPending,
    contacted,
    replied,
    converted,
    recentGames,
    recentLeads,
  ] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ status: "new" }),
    Lead.countDocuments({ score: { $gte: 75 } }),
    Lead.countDocuments({ status: { $in: ["message_ready", "approved"] } }),
    Lead.countDocuments({ status: "contacted" }),
    Lead.countDocuments({ status: "replied" }),
    Lead.countDocuments({ status: "converted" }),
    Game.find().sort({ createdAt: -1 }).limit(5),
    Lead.find().sort({ createdAt: -1 }).limit(8),
  ]);

  const gameIds = new Set<string>();
  recentLeads.forEach((l) => l.gameId && gameIds.add(l.gameId.toString()));
  const oid = (v: string) => (isValidObjectId(v) ? new Types.ObjectId(v) : null);
  const ids = [...gameIds].map(oid).filter((v): v is Types.ObjectId => v !== null);
  const games = ids.length
    ? await Game.find(queryFilter({ _id: { $in: ids } }))
        .select("title")
        .lean<Array<{ _id: Types.ObjectId; title: string }>>()
    : [];
  const gameMap = new Map(games.map((g) => [g._id.toString(), g]));

  const recentGamesDTO = serialize(recentGames) as GameDTO[];
  const recentLeadsDTO = serialize(recentLeads) as LeadDTO[];

  return Response.json({
    stats: {
      totalLeads,
      newLeads,
      highPotential,
      outreachPending,
      contacted,
      replied,
      converted,
    },
    recentGames: recentGamesDTO,
    recentLeads: recentLeadsDTO.map((l) => ({
      ...l,
      gameTitle:
        l.gameId && gameMap.get(l.gameId) ? gameMap.get(l.gameId)!.title : null,
    })),
    outreachCount: await Outreach.countDocuments({ status: "draft" }),
  });
}