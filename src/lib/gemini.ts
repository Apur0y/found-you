import "server-only";
import type { ZodType } from "zod";
import {
  commandPlanSchema,
  gameAnalysisSchema,
  outreachResultSchema,
  researchResultSchema,
  safeParseJson,
  scoreResultSchema,
  type CommandPlan,
  type GameAnalysis,
  type OutreachResult,
  type ResearchResult,
  type ScoreResult,
} from "@/lib/schemas";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export function isGeminiConfigured(): boolean {
  return GEMINI_API_KEY.length > 0;
}

export async function testGemini(): Promise<{
  status: "ok" | "error" | "missing";
  detail?: string;
}> {
  if (!isGeminiConfigured()) return { status: "missing" };
  try {
    await generateContent(
      "You are a health check.",
      "Reply with the single word ok.",
      { json: false }
    );
    return { status: "ok" };
  } catch (e) {
    return {
      status: "error",
      detail: e instanceof Error ? e.message.slice(0, 300) : "unknown error",
    };
  }
}

async function generateContent(
  system: string,
  user: string,
  opts?: { json?: boolean }
): Promise<string> {
  if (!isGeminiConfigured()) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local and restart the server."
    );
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      ...(opts?.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const payload = (await res.json()) as {
        error?: { message?: string; status?: string };
      };
      detail = [payload.error?.status, payload.error?.message]
        .filter(Boolean)
        .join(": ");
    } catch {
      // body was not JSON — ignore
    }
    throw new Error(detail || `Gemini API error ${res.status}`);
  }
  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

async function parseJson<T>(schema: ZodType<T>, raw: string): Promise<T> {
  const parsed = safeParseJson(schema, raw);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

// Keep the AI payloads small: only the fields relevant to games, teams,
// players and parents. No contact scraping, no social profiles.
function slimLead(lead: unknown): Record<string, unknown> {
  const l = (lead ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of [
    "playerName",
    "name",
    "contactType",
    "sport",
    "position",
    "team",
    "graduationYear",
    "gameId",
    "status",
    "notes",
  ]) {
    if (l[key] !== undefined) out[key] = l[key];
  }
  return out;
}

function slimGame(game: unknown): Record<string, unknown> | null {
  const g = (game ?? {}) as Record<string, unknown>;
  if (!g || Object.keys(g).length === 0) return null;
  const out: Record<string, unknown> = {};
  for (const key of [
    "title",
    "url",
    "date",
    "sport",
    "teamA",
    "teamB",
    "graduationYear",
    "source",
    "notes",
  ]) {
    if (g[key] !== undefined) out[key] = g[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// analyzeGame — metadata only. Never claims to have watched the video.
// ---------------------------------------------------------------------------

export async function analyzeGame(input: {
  title: string;
  sport?: string;
  date?: string;
  teamA?: string;
  teamB?: string;
  graduationYear?: number;
  url?: string;
  source?: string;
  notes?: string;
}): Promise<GameAnalysis> {
  const user = `Analyze this game using ONLY the metadata below. You have NOT watched any video; do not invent players, scores, or places.

Title: ${input.title}
Sport: ${input.sport || "unknown"}
Date: ${input.date || "unknown"}
Team A: ${input.teamA || "unknown"}
Team B: ${input.teamB || "unknown"}
Graduation year: ${input.graduationYear ?? "unknown"}
Source: ${input.source || "unknown"}
Notes: ${input.notes || "none"}

Return JSON only:
{ "sport": string|null, "gender": string|null, "graduationYear": number|null, "teamA": string|null, "teamB": string|null, "gameType": "full_game"|"highlights"|"unknown"|null, "recruitingRelevant": boolean, "reason": string, "summary": string, "confidence": "low"|"medium"|"high" }`;

  const system =
    "You are a sports video metadata analyst. Only analyze supplied metadata, never unseen video. When absent, return null. JSON only.";

  const text = await generateContent(system, user, { json: true });
  return parseJson(gameAnalysisSchema, text);
}

// ---------------------------------------------------------------------------
// scoreLead
// ---------------------------------------------------------------------------

const SCORING_SIGNALS = [
  { label: "Full game available", points: 25 },
  { label: "Recent game", points: 15 },
  { label: "Youth/recruiting age group", points: 20 },
  { label: "Player identifiable", points: 15 },
  { label: "Public player information", points: 10 },
  { label: "Recruiting activity signal", points: 10 },
  { label: "No obvious highlight video", points: 5 },
];

export async function scoreLead(input: {
  lead: unknown;
  game?: { title: string; url?: string; date?: string | Date | null; analysis?: unknown } | null;
}): Promise<ScoreResult> {
  const user = `Score this lead 0-100 as an INTERNAL priority (not a factual measure of the athlete).

Lead:
${JSON.stringify(slimLead(input.lead))}

Game (metadata only, video not watched):
${JSON.stringify(slimGame(input.game))}

Signals to consider:
${SCORING_SIGNALS.map((s) => `- ${s.label}: +${s.points}`).join("\n")}

Rules: never invent missing facts; unknown facts score nothing.
Return JSON only: { "score": number (0-100), "confidence": "low"|"medium"|"high", "reasons": string[], "recommendedAction": string }`;

  const system =
    "You are a conservative lead-prioritization assistant for a sports video editing business. Never invent facts. JSON only.";

  const text = await generateContent(system, user, { json: true });
  return parseJson(scoreResultSchema, text);
}

// ---------------------------------------------------------------------------
// researchLead — organizes supplied public info into FACT / SIGNAL / UNKNOWN
// ---------------------------------------------------------------------------

export async function researchLead(input: {
  lead: unknown;
  game?: { title: string; url?: string; source?: string } | null;
  suppliedInfo: string;
}): Promise<ResearchResult> {
  const user = `Organize supplied info about a lead into FACT -> INFERENCE -> UNKNOWN.

Lead:
${JSON.stringify(slimLead(input.lead))}

Game:
${JSON.stringify(slimGame(input.game))}

Supplied public info (paste from game broadcasts, team pages, or parent-provided details):
"""
${input.suppliedInfo || "(none supplied)"}
"""

Rules:
- knownInformation: facts present in the supplied text or lead record; restate them closely.
- possibleSignals: things that seem likely but need verification.
- missingInformation: important facts NOT known; never guess them.
- whyThisLead: why this lead may need a recruiting/highlight video, grounded in facts only.
- suggestedAngle: one conservative outreach angle using available full-game footage.

Return JSON only:
{ "knownInformation": string[], "possibleSignals": string[], "missingInformation": string[], "whyThisLead": string, "suggestedAngle": string }`;

  const system =
    "You separate verified facts from inference and unknowns. Never fabricate names, contact details, or recruiting status. JSON only.";

  const text = await generateContent(system, user, { json: true });
  return parseJson(researchResultSchema, text);
}

// ---------------------------------------------------------------------------
// generateOutreach
// ---------------------------------------------------------------------------

export async function generateOutreach(input: {
  lead: unknown;
  game?: { title: string; url?: string } | null;
  serviceDescription: string;
  research?: unknown;
}): Promise<OutreachResult> {
  const user = `Write a short, natural message (max ~90 words) selling a highlight-video service to this lead.

Lead:
${JSON.stringify(slimLead(input.lead))}

Game:
${JSON.stringify(slimGame(input.game))}

Research notes:
${JSON.stringify(input.research ?? null)}

Service: ${input.serviceDescription}

Rules:
- Do NOT imply you watched the athlete play unless the lead record says so.
- No generic flattery, hype, or unverifiable claims.
- Reference only details above (sport, player, team, grad year, game).
- One paragraph plus one soft closing line. No fake names, emails, or phone numbers.

Return JSON only: { "message": string }`;

  const system =
    "You write honest, non-spammy outreach for a sports video editing service. Never fabricate facts. JSON only.";

  const text = await generateContent(system, user, { json: true });
  return parseJson(outreachResultSchema, text);
}

// ---------------------------------------------------------------------------
// interpretCommand — maps natural language to a CONTROLLED action plan.
// The plan is validated with Zod; it is never a raw query or executable code.
// ---------------------------------------------------------------------------

export async function interpretCommand(command: string): Promise<CommandPlan> {
  const today = new Date().toISOString().slice(0, 10);
  const user = `Today: ${today}. Convert this command into a controlled action plan.
Command: "${command}"

Actions (pick one): show_leads | show_games | score_leads | generate_messages | analyze_games
Filters (only if implied): { "sport": string, "team": string, "status": [lead statuses], "minScore": number, "maxScore": number, "createdWithinDays": number, "hasGame": boolean, "hasOutreachMessage": boolean, "hasEmail": boolean, "graduationYear": number, "limit": number }

Examples:
"high-potential soccer leads" -> { "action": "show_leads", "filters": { "sport": "soccer", "minScore": 75 }, "explanation": "..." }
"leads not contacted yet" -> { "action": "show_leads", "filters": { "status": ["new","qualified","message_ready","approved"] }, "explanation": "..." }

Rules: only filters listed above; never emit queries or code.
Return JSON only: { "action": string, "filters": object, "explanation": string }`;

  const system =
    "You map natural-language commands to a strictly controlled JSON action plan. No queries or code. JSON only.";

  const text = await generateContent(system, user, { json: true });
  return parseJson(commandPlanSchema, text);
}