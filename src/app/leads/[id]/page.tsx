import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { LeadDetailClient } from "@/components/LeadDetailClient";
import { serialize } from "@/lib/server";
import type { GameDTO } from "@/types";

export const metadata = { title: "Lead · Game Mining" };

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  const lead = await Lead.findById(id);
  if (!lead) notFound();

  let game: GameDTO | null = null;
  if (lead.gameId) {
    const g = await Game.findById(lead.gameId);
    if (g) game = serialize(g) as unknown as GameDTO;
  }

  return <LeadDetailClient lead={serialize(lead)} game={game} />;
}