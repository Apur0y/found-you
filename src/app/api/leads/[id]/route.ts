import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { Outreach } from "@/models/Outreach";
import { apiError, normalizeUrl, parseOptionalInt, queryFilter, serialize } from "@/lib/server";
import { leadStatusSchema } from "@/lib/schemas";
import { isValidObjectId, Types } from "mongoose";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid lead id", 404);
  const lead = await Lead.findById(id);
  if (!lead) return apiError("Lead not found", 404);
  let game = null;
  if (lead.gameId) {
    const g = await Game.findById(lead.gameId);
    if (g) game = serialize(g);
  }
  return Response.json({ lead: serialize(lead), game });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid lead id", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid payload");

  const lead = await Lead.findById(id);
  if (!lead) return apiError("Lead not found", 404);

  const allowed: Record<string, (v: unknown) => unknown> = {
    name: (v) => String(v).trim(),
    playerName: (v) => (v ? String(v) : undefined),
    contactType: (v) => (v ? String(v) : undefined),
    sport: (v) => (v ? String(v) : undefined),
    position: (v) => (v ? String(v) : undefined),
    team: (v) => (v ? String(v) : undefined),
    graduationYear: parseOptionalInt,
    email: (v) => (v ? String(v) : undefined),
    socialUrl: (v) => normalizeUrl(v as string),
    profileUrl: (v) => normalizeUrl(v as string),
    gameId: (v) => (v ? String(v) : null),
    source: (v) => (v ? String(v) : undefined),
    notes: (v) => (v ? String(v) : undefined),
    outreachMessage: (v) => (v ? String(v) : undefined),
    verifiedInformation: (v) => (Array.isArray(v) ? v : undefined),
    inferredInformation: (v) => (Array.isArray(v) ? v : undefined),
    missingInformation: (v) => (Array.isArray(v) ? v : undefined),
    evidence: (v) => (Array.isArray(v) ? v : undefined),
    research: (v) => (typeof v === "object" && v ? v : undefined),
  };

  if (typeof body.status === "string") {
    const parsed = leadStatusSchema.safeParse(body.status);
    if (!parsed.success) return apiError("Invalid status");
    lead.status = parsed.data;
  }

  for (const [key, converter] of Object.entries(allowed)) {
    if (key in body) {
      const raw = body[key];
      const converted = converter(raw);
      (lead as unknown as Record<string, unknown>)[key] = converted;
    }
  }

  await lead.save();
  return Response.json({ lead: serialize(lead) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid lead id", 404);
  const lead = await Lead.findByIdAndDelete(id);
  if (!lead) return apiError("Lead not found", 404);
  await Outreach.deleteMany(
    queryFilter({ leadId: new Types.ObjectId(id) })
  );
  return Response.json({ ok: true });
}