import Link from "next/link";
import type { GameDTO, LeadDTO } from "@/types";
import { Lead } from "@/models/Lead";
import { Game } from "@/models/Game";
import { Card, CardHeader, EmptyState, ScorePill, StatusBadge, Button } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { isMongoConfigured, connectDB } from "@/lib/mongodb";
import { CommandRunner } from "@/components/CommandRunner";

export const metadata = { title: "Dashboard · Game Mining" };
export const dynamic = "force-dynamic";

async function loadDashboard() {
  if (!isMongoConfigured()) return null;
  await connectDB();

  const [
    totalLeads,
    newLeads,
    highPotential,
    outreachPending,
    contacted,
    replied,
    converted,
    recentGames,
    recentLeads,
  ] = await Promise.all([
    Lead.countDocuments(),
    Lead.countDocuments({ status: "new" }),
    Lead.countDocuments({ score: { $gte: 75 } }),
    Lead.countDocuments({ status: { $in: ["message_ready", "approved"] } }),
    Lead.countDocuments({ status: "contacted" }),
    Lead.countDocuments({ status: "replied" }),
    Lead.countDocuments({ status: "converted" }),
    Game.find().sort({ createdAt: -1 }).limit(5),
    Lead.find().sort({ createdAt: -1 }).limit(8),
  ]);

  return {
    stats: {
      totalLeads,
      newLeads,
      highPotential,
      outreachPending,
      contacted,
      replied,
      converted,
    },
    recentGames: JSON.parse(JSON.stringify(recentGames)) as GameDTO[],
    recentLeads: JSON.parse(JSON.stringify(recentLeads)) as LeadDTO[],
  };
}

export default async function DashboardPage() {
  const data = await loadDashboard();

  if (!data) {
    return (
      <div className="container-shell">
        <Card className="mx-auto max-w-lg">
          <div className="p-8 text-center">
            <h1 className="text-lg font-semibold text-zinc-900">MongoDB not configured</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Set <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">MONGODB_URI</code>{" "}
              in <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">.env.local</code>,
              then run <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">npm run seed</code>{" "}
              to load sample data.
            </p>
            <div className="mt-4">
              <Link href="/settings">
                <Button variant="primary">Open settings</Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const s = data.stats;
  const stats = [
    { label: "Total Leads", value: s.totalLeads },
    { label: "New Leads", value: s.newLeads },
    { label: "High-Potential (75+)", value: s.highPotential },
    { label: "Outreach Pending", value: s.outreachPending },
    { label: "Contacted", value: s.contacted },
    { label: "Replied", value: s.replied },
    { label: "Converted", value: s.converted },
  ];

  return (
    <div className="container-shell space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Find evidence of a potential recruiting-video need and prioritize qualified leads.
          </p>
        </div>
      </div>

      <CommandRunner compact />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {stats.map((stat) => (
          <Card key={stat.label} className="px-4 py-3">
            <div className="text-2xl font-semibold text-zinc-900">{stat.value}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {stat.label}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent discovered games"
            action={
              <Link href="/games" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                View all
              </Link>
            }
          />
          {data.recentGames.length === 0 ? (
            <EmptyState title="No games yet" note="Add a game from the Games page." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.recentGames.map((g) => (
                <li key={g._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900">{g.title}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {[g.sport, g.graduationYear ? `Class of ${g.graduationYear}` : null, g.source]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">{formatDate(g.date as string | undefined)}</div>
                    {g.analysis?.recruitingRelevant ? (
                      <div className="mt-0.5 text-[11px] text-emerald-700">Recruiting relevant</div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent leads"
            action={
              <Link href="/leads" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                View all
              </Link>
            }
          />
          {data.recentLeads.length === 0 ? (
            <EmptyState title="No leads yet" note="Add leads from the Leads page or import a CSV." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {data.recentLeads.map((l) => (
                <li key={l._id}>
                  <Link
                    href={`/leads/${l._id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-900">{l.name}</div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        {[l.playerName, l.team, l.sport].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ScorePill score={l.score} />
                      <StatusBadge status={l.status as never} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}