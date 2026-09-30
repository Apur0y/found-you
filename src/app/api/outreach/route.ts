import { connectDB } from "@/lib/mongodb";
import { Outreach } from "@/models/Outreach";
import { Lead } from "@/models/Lead";
import { apiError, queryFilter, serialize } from "@/lib/server";
import { isValidObjectId, Types } from "mongoose";

export async function GET(request: Request) {
  await connectDB();
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim();
  const leadId = url.searchParams.get("leadId")?.trim();

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (leadId) filter.leadId = leadId;

  const items = await Outreach.find(filter).sort({ updatedAt: -1 }).limit(200);
  const serialized = serialize(items) as Array<Record<string, unknown>>;

  const leadIds = serialized
    .map((o) => String(o.leadId))
    .filter((v) => v && isValidObjectId(v))
    .map((v) => new Types.ObjectId(v));
  const leads = leadIds.length
    ? await Lead.find(queryFilter({ _id: { $in: leadIds } }))
        .select(
          "name playerName sport team graduationYear status email socialUrl profileUrl"
        )
        .lean<Array<{ _id: Types.ObjectId } & Record<string, unknown>>>()
    : [];
  const leadMap = new Map(leads.map((l) => [l._id.toString(), l]));

  const out = serialized.map((o) => ({
    ...o,
    lead: leadMap.get(String(o.leadId)) ? serialize(leadMap.get(String(o.leadId))) : null,
  }));

  return Response.json({ outreach: out });
}

export async function POST(request: Request) {
  await connectDB();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid payload");

  const leadId = String(body.leadId ?? "");
  const message = String(body.message ?? "").trim();
  if (!leadId || !message) return apiError("leadId and message are required");

  const lead = await Lead.findById(leadId);
  if (!lead) return apiError("Lead not found", 404);

  const outreach = await Outreach.create({
    leadId: new Types.ObjectId(leadId),
    message,
    channel:
      ["email", "facebook", "instagram", "other"].includes(body.channel) &&
      body.channel
        ? body.channel
        : lead.email
          ? "email"
          : "other",
    status: "draft",
  } as unknown as never);

  return Response.json({ outreach: serialize(outreach) }, { status: 201 });
}