import { connectDB } from "@/lib/mongodb";
import { Lead, type LeadDoc } from "@/models/Lead";
import { apiError, normalizeUrl, parseOptionalInt } from "@/lib/server";
import { leadStatusSchema } from "@/lib/schemas";
import type { LeadStatus } from "@/lib/statuses";

export async function POST(request: Request) {
  await connectDB();
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
    return apiError("rows[] is required");
  }

  const results: {
    created: { name: string; id?: string }[];
    skipped: { row: number; reason: string }[];
  } = { created: [], skipped: [] };

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i];
    if (typeof row !== "object" || row === null) {
      results.skipped.push({ row: i, reason: "Row is not an object" });
      continue;
    }
    const name = String(row.name ?? "").trim();
    if (!name) {
      results.skipped.push({ row: i, reason: "Missing name" });
      continue;
    }
    const status: LeadStatus = leadStatusSchema.safeParse(row.status).success
      ? (row.status as LeadStatus)
      : "new";

    const normalized = {
      name,
      playerName: row.playerName ? String(row.playerName) : undefined,
      contactType: ["parent", "athlete", "coach", "team", "agency", "unknown"].includes(
        String(row.contactType || "")
      )
        ? (String(row.contactType) as NonNullable<LeadDoc["contactType"]>)
        : ("unknown" as const),
      sport: row.sport ? String(row.sport).toLowerCase() : undefined,
      position: row.position ? String(row.position) : undefined,
      team: row.team ? String(row.team) : undefined,
      graduationYear: parseOptionalInt(row.graduationYear),
      email: row.email && String(row.email).includes("@") ? String(row.email).toLowerCase() : undefined,
      socialUrl: normalizeUrl(row.socialUrl),
      profileUrl: normalizeUrl(row.profileUrl),
      source: row.source ? String(row.source) : "csv",
      notes: row.notes ? String(row.notes) : undefined,
      status,
    };

    if (!normalized.email && !normalized.socialUrl && !normalized.profileUrl) {
      results.skipped.push({ row: i, reason: "No contact or profile URL" });
      continue;
    }

    const created = await Lead.create(normalized);
    results.created.push({ name, id: created._id.toString() });
  }

  return Response.json(results, { status: 201 });
}