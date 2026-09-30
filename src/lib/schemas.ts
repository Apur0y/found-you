import { z } from "zod";
import { LEAD_STATUSES } from "@/lib/statuses";
import { WEBSITE_CATEGORIES } from "@/lib/websites";

export const leadStatusSchema = z.enum(LEAD_STATUSES);

export const websiteCategorySchema = z.enum(WEBSITE_CATEGORIES);

export const gameAnalysisSchema = z.object({
  sport: z.string().nullable().default(null),
  gender: z.string().nullable().default(null),
  graduationYear: z.number().int().nullable().default(null),
  teamA: z.string().nullable().default(null),
  teamB: z.string().nullable().default(null),
  gameType: z.string().nullable().default(null),
  recruitingRelevant: z.boolean().default(false),
  reason: z.string().default(""),
  summary: z.string().default(""),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
});

export type GameAnalysis = z.infer<typeof gameAnalysisSchema>;

export const scoreResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  confidence: z.enum(["low", "medium", "high"]),
  reasons: z.array(z.string()).default([]),
  recommendedAction: z.string().default(""),
});

export type ScoreResult = z.infer<typeof scoreResultSchema>;

export const researchResultSchema = z.object({
  knownInformation: z.array(z.string()).default([]),
  possibleSignals: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  whyThisLead: z.string().default(""),
  suggestedAngle: z.string().default(""),
});

export type ResearchResult = z.infer<typeof researchResultSchema>;

export const outreachResultSchema = z.object({
  message: z.string().min(1),
});

export type OutreachResult = z.infer<typeof outreachResultSchema>;

export const COMMAND_ACTIONS = [
  "show_leads",
  "show_games",
  "score_leads",
  "generate_messages",
  "analyze_games",
] as const;

export const commandFiltersSchema = z.object({
  sport: z.string().optional(),
  team: z.string().optional(),
  status: z.array(leadStatusSchema).optional(),
  minScore: z.number().min(0).max(100).optional(),
  maxScore: z.number().min(0).max(100).optional(),
  createdWithinDays: z.number().int().positive().max(3650).optional(),
  hasGame: z.boolean().optional(),
  hasOutreachMessage: z.boolean().optional(),
  hasEmail: z.boolean().optional(),
  graduationYear: z.number().int().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export type CommandFilters = z.infer<typeof commandFiltersSchema>;

export const commandPlanSchema = z.object({
  action: z.enum(COMMAND_ACTIONS),
  filters: commandFiltersSchema.default({}),
  explanation: z.string().default(""),
});

export type CommandPlan = z.infer<typeof commandPlanSchema>;

export function safeParseJson<T>(
  schema: z.ZodType<T>,
  raw: string
): { ok: true; data: T } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    // Attempt to extract the first JSON object from noisy output
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: "AI returned non-JSON output" };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { ok: false, error: "AI returned invalid JSON" };
    }
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `AI response failed validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    };
  }
  return { ok: true, data: result.data };
}
