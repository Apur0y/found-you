import { connectDB, isMongoConfigured } from "@/lib/mongodb";
import { isGeminiConfigured, testGemini } from "@/lib/gemini";
import { Badge, Card, CardHeader } from "@/components/ui";

export const metadata = { title: "Settings · Game Mining" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let mongo = "missing";
  if (isMongoConfigured()) {
    try {
      await connectDB();
      mongo = "connected";
    } catch {
      mongo = "error";
    }
  }
  const gemini: Awaited<ReturnType<typeof testGemini>> = isGeminiConfigured()
    ? await testGemini()
    : { status: "missing" };
  const geminiLive = gemini.status === "ok";

  return (
    <div className="container-shell max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Integration status. Keys live in <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">.env.local</code> and never reach the browser.
        </p>
      </div>

      <Card>
        <CardHeader title="Environment" />
        <div className="divide-y divide-zinc-100">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-zinc-900">MongoDB</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {mongo === "connected" ? "Connected" : mongo === "missing" ? "MONGODB_URI not set" : "Connection failed"} · {isMongoConfigured() ? "configured" : "not configured"}
              </div>
            </div>
            <Badge tone={mongo === "connected" ? "green" : mongo === "missing" ? "zinc" : "red"}>
              {mongo === "connected" ? "Connected" : mongo === "missing" ? "Missing" : "Error"}
            </Badge>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-zinc-900">Gemini AI</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                Model: {process.env.GEMINI_MODEL || "gemini-3.6-flash"}
              </div>
              {gemini.status === "error" && gemini.detail ? (
                <div className="mt-1 max-w-md rounded bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                  {gemini.detail}
                </div>
              ) : gemini.status === "missing" ? (
                <div className="mt-1 text-xs text-zinc-400">
                  No GEMINI_API_KEY set — AI features will error until a valid key is configured
                  and the server is restarted.
                </div>
              ) : null}
            </div>
            <Badge tone={geminiLive ? "green" : gemini.status === "missing" ? "zinc" : "red"}>
              {gemini.status === "missing" ? "Not configured" : geminiLive ? "Live API" : "API error"}
            </Badge>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-zinc-900">AI behavior</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                All analysis, research, scoring, outreach and commands run against the live Gemini API.
                No offline fallback is used.
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-sm font-medium text-zinc-900">Service description</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {process.env.SERVICE_DESCRIPTION || "Turn full-game footage into clean player-specific recruiting highlight videos."}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Environment variables" />
        <div className="space-y-3 p-5">
          <CodeLine name="MONGODB_URI" value="mongodb+srv://…" />
          <CodeLine name="GEMINI_API_KEY" value="AIza…" />
          <CodeLine name="GEMINI_MODEL" value="gemini-2.5-flash (optional)" />
          <CodeLine name="SERVICE_DESCRIPTION" value="optional outreach service blurb" />
          <p className="text-xs text-zinc-400">
            Add these to <code className="rounded bg-zinc-100 px-1 py-0.5">.env.local</code> (copy from{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">.env.local.example</code>) and restart{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">npm run dev</code>.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Seed sample data" />
        <div className="p-5 text-sm text-zinc-600">
          <p>
            Run <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">npm run seed</code> to load
            sample games and leads so the dashboard works immediately. Analysis, scoring, research and
            outreach are generated live from the real APIs — no AI content is pre-fabricated.
          </p>
        </div>
      </Card>
    </div>
  );
}

function CodeLine({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <code className="w-40 shrink-0 rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800">{name}=</code>
      <code className="truncate rounded bg-zinc-50 px-2 py-1 text-xs text-zinc-500">{value}</code>
    </div>
  );
}