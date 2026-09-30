import { connectDB } from "@/lib/mongodb";
import { Website } from "@/models/Website";
import { apiError, normalizeUrl, serialize } from "@/lib/server";
import { websiteCategorySchema } from "@/lib/schemas";
import { isValidObjectId } from "mongoose";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid website id", 404);
  const website = await Website.findById(id);
  if (!website) return apiError("Website not found", 404);
  return Response.json({ website: serialize(website) });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid website id", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("Invalid payload");

  const website = await Website.findById(id);
  if (!website) return apiError("Website not found", 404);

  if ("category" in body) {
    const check = websiteCategorySchema.safeParse(body.category);
    if (!check.success) return apiError("Invalid category");
    website.category = check.data;
  }

  const allowed: Record<string, (v: unknown) => unknown> = {
    name: (v) => String(v).trim(),
    url: (v) => normalizeUrl(v as string),
    region: (v) => String(v).trim(),
    access: (v) => String(v).trim(),
    description: (v) => String(v),
    useCase: (v) => String(v),
    notes: (v) => (v ? String(v) : undefined),
  };

  for (const [key, converter] of Object.entries(allowed)) {
    if (key in body) {
      (website as unknown as Record<string, unknown>)[key] = converter(body[key]);
    }
  }

  if ("sports" in body && Array.isArray(body.sports)) {
    website.sports = body.sports
      .map((s: unknown) => String(s).trim().toLowerCase())
      .filter(Boolean);
  }

  await website.save();
  return Response.json({ website: serialize(website) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  if (!isValidObjectId(id)) return apiError("Invalid website id", 404);
  const website = await Website.findByIdAndDelete(id);
  if (!website) return apiError("Website not found", 404);
  return Response.json({ ok: true });
}
