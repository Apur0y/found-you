import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { Website } from "@/models/Website";
import { apiError, serialize } from "@/lib/server";
import { discoverLeads, isGeminiConfigured, isSearchGroundingAvailable, searchGrounded } from "@/lib/gemini";
import { fetchPages, type FetchedPage } from "@/lib/pages";
import type { DiscoveredLead } from "@/lib/schemas";

const MAX_QUERIES = 4;
const MAX_GROUNDED_HITS = 12;
const MAX_PAGE_FETCHES = 10;
const MAX_CREATED = 10;
const DEFAULT_WINDOW_DAYS = 7;

const DEFAULT_SERVICE =
  "Turn full-game footage into clean player-specific recruiting highlight videos.";

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Search queries come from operator-owned data only: the Websites source
 * directory and games played recently. Nothing here is user-supplied free text.
 */
function buildQueries(
  websites: Array<{
    name: string;
    category: string;
    sports: string[];
    region: string;
    useCase: string;
  }>,
  games: Array<{ title: string; sport?: string; teamA?: string; teamB?: string }>
): { queries: string[]; targets: string[] } {
  const queries: string[] = [];
  const targets: string[] = [];

  for (const game of games) {
    if (queries.length >= MAX_QUERIES) break;
    const teams = [game.teamA, game.teamB].filter(Boolean).join(" vs ");
    if (!teams) continue;
    const sport = game.sport ? `${game.sport} ` : "";
    queries.push(`"${teams}" ${sport}roster players parents`);
    targets.push(`Athletes named by sources covering ${game.title}`);
  }

  for (const site of websites) {
    if (queries.length >= MAX_QUERIES) break;
    const sport = site.sports[0];
    const region = site.region && site.region !== "National" ? site.region : "";
    const parts = [site.name, site.category.replace(/_/g, " ")];
    if (sport) parts.push(sport);
    if (region) parts.push(region);
    const query = `${parts.join(" ")} players parents ${site.useCase || "recruiting"}`
      .replace(/\s+/g, " ")
      .trim();
    if (query.length < 20) continue;
    queries.push(query);
    targets.push(`${site.name} (${site.category}${region ? `, ${region}` : ""})`);
  }

  return { queries: [...new Set(queries)], targets };
}

function toLeadDoc(lead: DiscoveredLead, windowLabel: string) {
  const playerName = lead.playerName.trim();
  const contactName = lead.contactName.trim();
  return {
    name: contactName || playerName,
    playerName,
    contactType: lead.contactType,
    sport: lead.sport.trim() || undefined,
    team: lead.team.trim() || undefined,
    position: lead.position.trim() || undefined,
    graduationYear: lead.graduationYear ?? undefined,
    profileUrl: lead.sourceUrl,
    source: "ai-web-fetch",
    status: "new" as const,
    verifiedInformation: [],
    inferredInformation: lead.whyThisLead ? [lead.whyThisLead] : [],
    missingInformation: [
      "No contact email, phone, or social profile has been verified yet.",
    ],
    evidence: [
      {
        text: lead.whyThisLead
          ? `Named by a public source as a recruiting-video prospect: ${lead.whyThisLead}`
          : "Named by a public source as a recruiting-video prospect.",
        kind: "ai_inferred" as const,
        source: lead.sourceUrl,
      },
    ],
    notes: `AI web fetch · ${windowLabel} · source: ${lead.sourceTitle || lead.sourceUrl}`,
  };
}

export async function POST(request: Request) {
  await connectDB();
  if (!isGeminiConfigured()) {
    return apiError("GEMINI_API_KEY is not configured", 503);
  }

  const body = await request.json().catch(() => null);
  const windowDays = Math.min(
    Math.max(Number(body?.windowDays) || DEFAULT_WINDOW_DAYS, 1),
    90
  );
  const limit = Math.min(
    Math.max(Number(body?.limit) || MAX_CREATED, 1),
    MAX_CREATED
  );

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const windowLabel = `games played within ${windowDays} day(s) ending ${since
    .toISOString()
    .slice(0, 10)}`;

  try {
    const [websites, games] = await Promise.all([
      Website.find().sort({ createdAt: -1 }).limit(12),
      Game.find({
        $or: [{ date: { $gte: since } }, { createdAt: { $gte: since } }],
      })
        .sort({ date: -1 })
        .limit(8),
    ]);

    const { queries, targets } = buildQueries(
      serialize<Array<Parameters<typeof buildQueries>[0][number]>>(websites),
      games.map((g) => ({
        title: g.title,
        sport: g.sport,
        teamA: g.teamA,
        teamB: g.teamB,
      }))
    );

    if (queries.length === 0) {
      return apiError(
        "No sources to search. Add games with team names, or add entries to the Websites directory.",
        422
      );
    }

    const candidateUrls: string[] = [];
    const seenUrlKeys = new Set<string>();
    const failedQueries: string[] = [];

    // Probe once per request so a transient upstream failure cannot trigger a
    // probe per query.
    let groundingOk = false;
    try {
      groundingOk = await isSearchGroundingAvailable();
    } catch {
      groundingOk = false;
    }

    if (groundingOk) {
      for (const query of queries) {
        try {
          const hits = await searchGrounded(query);
          for (const hit of hits) {
            const key = hit.url.replace(/#.*$/, "").replace(/\/+$/, "");
            if (seenUrlKeys.has(key)) continue;
            seenUrlKeys.add(key);
            candidateUrls.push(hit.url);
            if (candidateUrls.length >= MAX_GROUNDED_HITS) break;
          }
        } catch {
          failedQueries.push(query);
        }
        if (candidateUrls.length >= MAX_GROUNDED_HITS) break;
      }
    }

    // If grounding didn't return any candidate URLs, fall back to the operator-
    // owned Websites list. Pages that fetch successfully will be the substrate.
    for (const site of websites) {
      if (candidateUrls.length >= MAX_PAGE_FETCHES) break;
      const key = site.url.replace(/#.*$/, "").replace(/\/+$/, "");
      if (seenUrlKeys.has(key)) continue;
      seenUrlKeys.add(key);
      candidateUrls.push(site.url);
    }

    if (candidateUrls.length === 0) {
      return apiError(
        `No candidate pages to read${failedQueries.length ? ` (${failedQueries.length} quer${failedQueries.length === 1 ? "y" : "ies"} failed)` : ""}.`,
        502
      );
    }

    const { pages, failures } = await fetchPages(
      candidateUrls.slice(0, MAX_PAGE_FETCHES)
    );

    if (pages.length === 0) {
      return apiError(
        `Failed to fetch any candidate pages${failures.length ? ` (${failures.length} failed)` : ""}.`,
        502
      );
    }

    const discovery = await discoverLeads({
      pages: pages.map((p: FetchedPage) => ({
        url: p.url,
        title: p.title,
        text: p.text,
      })),
      targets,
      serviceDescription: process.env.SERVICE_DESCRIPTION || DEFAULT_SERVICE,
      maxLeads: limit * 2,
    });

    // Dedupe against stored leads on normalized player name.
    const existing = await Lead.find({}, { playerName: 1, name: 1 }).limit(5000);
    const seenNames = new Set<string>();
    for (const doc of existing) {
      const key = normalizeName(doc.playerName || doc.name || "");
      if (key) seenNames.add(key);
    }

    const created: DiscoveredLead[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];
    for (const lead of discovery.leads) {
      if (created.length >= limit) break;
      const key = normalizeName(lead.playerName);
      if (!key) continue;
      if (seenNames.has(key)) {
        skipped.push({ name: lead.playerName, reason: "already in database" });
        continue;
      }
      seenNames.add(key);
      created.push(lead);
    }

    const savedDocs = created.length
      ? await Lead.insertMany(created.map((lead) => toLeadDoc(lead, windowLabel)))
      : [];

    return Response.json(
      {
        created: serialize(savedDocs),
        discovered: discovery.leads.length,
        skipped,
        queries,
        failedQueries,
        searchedUrls: pages.length,
        sources: pages.map((p) => ({ title: p.title, url: p.url })),
        targets,
        windowLabel,
        pageFetchFailures: failures,
      },
      { status: created.length > 0 ? 201 : 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lead fetch failed";
    return apiError(message, 502);
  }
}