import "server-only";
import type { CommandPlan, CommandFilters } from "@/lib/schemas";
import type { LeadDoc } from "@/models/Lead";

/**
 * Controlled command execution layer.
 * AI output is validated by Zod (commandPlanSchema) and then translated into a
 * fixed, hand-written set of Mongo filter shapes. The AI can never emit raw
 * queries, operators, field paths, or code.
 */
export function buildLeadFilter(f: CommandFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (f.sport) filter.sport = new RegExp(`^${escapeRegex(f.sport)}$`, "i");
  if (f.team) filter.team = new RegExp(escapeRegex(f.team), "i");
  if (f.status && f.status.length > 0) filter.status = { $in: f.status };
  if (typeof f.minScore === "number" || typeof f.maxScore === "number") {
    const range: Record<string, number> = {};
    if (typeof f.minScore === "number") range.$gte = f.minScore;
    if (typeof f.maxScore === "number") range.$lte = f.maxScore;
    filter.score = range;
  }
  if (typeof f.createdWithinDays === "number") {
    filter.createdAt = {
      $gte: new Date(Date.now() - f.createdWithinDays * 864e5),
    };
  }
  if (f.hasGame === true) filter.gameId = { $ne: null };
  if (f.hasGame === false) filter.$or = [{ gameId: null }, { gameId: { $exists: false } }];
  if (f.hasOutreachMessage === true) filter.outreachMessage = { $exists: true, $ne: null };
  if (f.hasOutreachMessage === false)
    filter.$or = [{ outreachMessage: null }, { outreachMessage: { $exists: false } }];
  if (f.hasEmail === true) filter.email = { $exists: true, $ne: "" };
  if (typeof f.graduationYear === "number") filter.graduationYear = f.graduationYear;

  return filter;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ExecutedPlan {
  plan: CommandPlan;
  leadIds: string[];
  count: number;
}

export function describePlan(plan: CommandPlan): string {
  const parts: string[] = [plan.explanation || plan.action];
  const f = plan.filters;
  if (f.sport) parts.push(`sport = ${f.sport}`);
  if (f.team) parts.push(`team contains "${f.team}"`);
  if (f.status?.length) parts.push(`status in [${f.status.join(", ")}]`);
  if (typeof f.minScore === "number") parts.push(`score >= ${f.minScore}`);
  if (typeof f.maxScore === "number") parts.push(`score <= ${f.maxScore}`);
  if (f.createdWithinDays)
    parts.push(`createdAt >= last ${f.createdWithinDays} days`);
  if (f.hasGame === true) parts.push("has linked game");
  if (f.hasGame === false) parts.push("no linked game");
  if (f.hasOutreachMessage === true) parts.push("has drafted message");
  if (f.hasOutreachMessage === false) parts.push("no drafted message");
  if (f.hasEmail === true) parts.push("has email");
  if (typeof f.graduationYear === "number")
    parts.push(`graduationYear = ${f.graduationYear}`);
  return parts.join(" · ");
}

export function leadMatchesSimple(
  lead: Pick<LeadDoc, "sport" | "status" | "score" | "createdAt" | "gameId" | "outreachMessage" | "email" | "graduationYear" | "team">,
  f: CommandFilters
): boolean {
  if (f.sport && (lead.sport ?? "").toLowerCase() !== f.sport.toLowerCase())
    return false;
  if (
    f.team &&
    !(lead.team ?? "").toLowerCase().includes(f.team.toLowerCase())
  )
    return false;
  if (f.status?.length && !f.status.includes(lead.status)) return false;
  if (typeof f.minScore === "number" && (lead.score ?? -1) < f.minScore)
    return false;
  if (typeof f.maxScore === "number" && (lead.score ?? 0) > f.maxScore)
    return false;
  if (
    f.createdWithinDays &&
    lead.createdAt.getTime() <
      Date.now() - f.createdWithinDays * 864e5
  )
    return false;
  if (f.hasGame === true && !lead.gameId) return false;
  if (f.hasGame === false && lead.gameId) return false;
  if (f.hasOutreachMessage === true && !lead.outreachMessage) return false;
  if (f.hasOutreachMessage === false && lead.outreachMessage) return false;
  if (f.hasEmail === true && !lead.email) return false;
  if (
    typeof f.graduationYear === "number" &&
    lead.graduationYear !== f.graduationYear
  )
    return false;
  return true;
}
