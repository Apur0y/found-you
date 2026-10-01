import "server-only";
import type { ZodType } from "zod";
import {
  commandPlanSchema,
  discoveredLeadsSchema,
  gameAnalysisSchema,
  outreachResultSchema,
  researchResultSchema,
  safeParseJson,
  scoreResultSchema,
  type CommandPlan,
  type DiscoveredLead,
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

async function generateContentOnce(
  system: string,
  user: string,
  opts?: { json?: boolean; maxOutputTokens?: number; tools?: unknown[] }
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
      maxOutputTokens: opts?.maxOutputTokens ?? 2048,
      ...(opts?.json ? { responseMimeType: "application/json" } : {}),
    },
    ...(opts?.tools?.length ? { tools: opts.tools } : {}),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
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
    throw new GeminiError(detail || `Gemini API error ${res.status}`, res.status);
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

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
  }
}

/**
 * Retries transient upstream failures. Flash models spike under load and the
 * free tier is frequently rate limited; both are worth another attempt. Auth
 * and malformed-request errors are not retried.
 */
async function generateContent(
  system: string,
  user: string,
  opts?: { json?: boolean; maxOutputTokens?: number; tools?: unknown[] }
): Promise<string> {
  const RETRYABLE = new Set([429, 500, 502, 503, 504]);
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await generateContentOnce(system, user, opts);
    } catch (err) {
      lastError = err;
      const status = err instanceof GeminiError ? err.status : 0;
      if (!RETRYABLE.has(status) || attempt === 2) throw err;
      await new Promise((resolve) =>
        setTimeout(resolve, 800 * Math.pow(2, attempt))
      );
    }
  }

  throw lastError;
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
// Grounding with Google Search — OPTIONAL capability.
//
// Search grounding needs its own quota tier, so it returns 429 on keys whose
// project has no billing enabled. `isSearchGroundingAvailable` probes once and
// caches the answer; callers fall back to operator-supplied URLs when it is
// unavailable, so the fetch feature works on either kind of key.
//
// Note: grounding is silently disabled when JSON output is requested, so this
// path is only used for URL discovery — page text is fetched separately and the
// structuring call is a plain JSON request without tools.
// ---------------------------------------------------------------------------

let groundingProbe: Promise<boolean> | null = null;

/**
 * Only a quota/scope problem counts as "grounding unavailable". A transient
 * overload must not permanently disable the capability, so the probe result is
 * only cached once it succeeds or fails for a non-retryable reason.
 */
export function isSearchGroundingAvailable(): Promise<boolean> {
  groundingProbe ??= generateContent(
    "You are a search probe.",
    "Reply with the single word ok.",
    { json: false, maxOutputTokens: 8, tools: [{ google_search: {} }] }
  )
    .then(() => true)
    .catch((err) => {
      const status = err instanceof GeminiError ? err.status : 0;
      if (status === 429 || status === 403) {
        return false;
      }
      groundingProbe = null; // retry the probe next time
      throw err;
    });
  return groundingProbe;
}

export interface GroundedHit {
  title: string;
  url: string;
}

export async function searchGrounded(query: string): Promise<GroundedHit[]> {
  if (!(await isSearchGroundingAvailable())) return [];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `List the most useful public web pages for this query. One line per page: the page title, then the URL.\nQuery: ${query}`,
              },
            ],
          },
        ],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
      signal: AbortSignal.timeout(45_000),
    }
  );
  if (!res.ok) throw new Error(`Gemini search error ${res.status}`);

  const payload = (await res.json()) as {
    candidates?: {
      groundingMetadata?: {
        groundingChunks?: {
          web?: { uri?: string; title?: string };
        }[];
      };
    }[];
  };

  const chunks = payload.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const hits: GroundedHit[] = [];
  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const key = url.replace(/#.*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ title: chunk.web?.title || url, url });
  }
  return hits;
}

// ---------------------------------------------------------------------------
// discoverLeads — structures live web page text into lead candidates.
// Only called with text the server already fetched, so every returned
// sourceUrl can be checked against the real page set by the caller.
// ---------------------------------------------------------------------------

export interface DiscoveryPageResult {
  title: string;
  url: string;
  text: string;
  snippet?: string;
}

export interface DiscoveryResult {
  leads: DiscoveredLead[];
}

export async function discoverLeads(input: {
  pages: DiscoveryPageResult[];
  targets: string[];
  serviceDescription: string;
  maxLeads?: number;
}): Promise<DiscoveryResult> {
  const allowedUrls = new Set(input.pages.map((r) => r.url));
  const block = input.pages
    .map((r, i) => `[${i + 1}] URL: ${r.url}\nTITLE: ${r.title}\nTEXT:\n${r.text}`)
    .join("\n\n---\n\n");

  const user = `Below are public web page texts for sports recruiting-video prospecting.

What the business sells: ${input.serviceDescription}

Focus areas requested by the operator:
${input.targets.map((t) => `- ${t}`).join("\n")}

PAGE TEXTS
"""
${block}
"""

Extract individual people who could be contacted about recruiting/highlight video work.

Hard rules:
- Only output a person whose full name appears verbatim in the page texts above. Never guess or reconstruct names.
- sourceUrl MUST be copied exactly from one of the numbered pages above.
- Never invent email addresses, phone numbers, or social handles. Leave contactName empty unless a parent/guardian/coach name appears verbatim in the text.
- contactName is a publicly listed parent, guardian, coach, or the athlete themselves — not a contact method.
- graduationYear only when a class year or birth year is stated in the text; otherwise null.
- Roster, rankings, all-star, and team-schedule pages ARE good sources: if the text names individual athletes (even with only a rank and position), extract them.
- Skip only pages that name no individual at all: homepages, navigation, forums, shops, and sports-business commentary.
- At most ${input.maxLeads ?? 10} leads. Fewer is better than padding.

Return JSON only:
{ "leads": [ { "playerName": string, "contactName": string, "contactType": "parent"|"athlete"|"coach"|"team"|"unknown", "sport": string, "team": string, "position": string, "graduationYear": number|null, "sourceUrl": string, "sourceTitle": string, "whyThisLead": string, "confidence": "low"|"medium"|"high" } ] }`;

  const system =
    "You extract lead candidates from real search results. Every name and URL must come from the supplied text. Never fabricate. JSON only.";

  const text = await generateContent(system, user, { json: true, maxOutputTokens: 8192 });
  const parsed = await parseJson(discoveredLeadsSchema, text);

  // Hard guarantee: discard anything not traceable to a fetched URL.
  return {
    leads: parsed.leads.filter((lead) => allowedUrls.has(lead.sourceUrl)),
  };
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