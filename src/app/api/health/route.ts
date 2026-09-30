import { connectDB, isMongoConfigured } from "@/lib/mongodb";
import { isGeminiConfigured, testGemini } from "@/lib/gemini";

export async function GET() {
  let mongoStatus: "configured" | "connected" | "error" | "missing" = "missing";
  if (isMongoConfigured()) {
    try {
      await connectDB();
      mongoStatus = "connected";
    } catch {
      mongoStatus = "error";
    }
  }
  const gemini = isGeminiConfigured()
    ? await testGemini()
    : { status: "missing" as const };
  return Response.json({
    gemini: {
      ...gemini,
      configured: isGeminiConfigured(),
    },
    mongo: { status: mongoStatus, configured: isMongoConfigured() },
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
    serviceDescription:
      process.env.SERVICE_DESCRIPTION ||
      "Turn full-game footage into clean player-specific recruiting highlight videos.",
  });
}