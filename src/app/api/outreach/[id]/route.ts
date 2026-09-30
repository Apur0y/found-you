import { connectDB } from "@/lib/mongodb";
import { Outreach, type OutreachDoc } from "@/models/Outreach";
import { Lead } from "@/models/Lead";
import { apiError, serialize } from "@/lib/server";
import { isValidObjectId } from "mongoose";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid outreach id", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid payload");

  const outreach = await Outreach.findById(id);
  if (!outreach) return apiError("Outreach not found", 404);

  if (typeof body.message === "string" && body.message.trim()) {
    outreach.message = body.message.trim();
  }
  if (typeof body.channel === "string") {
    outreach.channel = ["email", "facebook", "instagram", "other"].includes(
      body.channel
    )
      ? (body.channel as OutreachDoc["channel"])
      : "other";
  }
  if (typeof body.status === "string") {
    if (!["draft", "approved", "sent", "replied"].includes(body.status)) {
      return apiError("Invalid outreach status");
    }
    outreach.status = body.status;
    if (body.status === "sent" && !outreach.sentAt) outreach.sentAt = new Date();
  }

  await outreach.save();

  // Keep the lead's stored message in sync when the user edits it.
  const lead = await Lead.findById(outreach.leadId);
  if (lead) {
    lead.outreachMessage = outreach.message;
    if (outreach.status === "sent") lead.status = "contacted";
    if (outreach.status === "replied") lead.status = "replied";
    if (outreach.status === "approved") {
      if (lead.status === "message_ready") lead.status = "approved";
    }
    await lead.save();
  }

  return Response.json({ outreach: serialize(outreach), lead: lead ? serialize(lead) : null });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid outreach id", 404);
  const outreach = await Outreach.findByIdAndDelete(id);
  if (!outreach) return apiError("Outreach not found", 404);
  return Response.json({ ok: true });
}