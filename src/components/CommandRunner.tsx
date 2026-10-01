"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, ScorePill, StatusBadge, Spinner, EmptyState } from "@/components/ui";
import { clientFetch, formatDate } from "@/lib/format";

const SUGGESTIONS = [
  "Find high-potential soccer leads",
  "Analyze my new games",
  "Prepare outreach for basketball leads",
  "Show leads with full games but no identified highlight",
  "Generate messages for qualified leads",
  "Show leads I haven't contacted yet",
];

interface CommandResponse {
  plan: { action: string; filters: Record<string, unknown>; explanation: string };
  explanation: string;
  result?: { action: string; leadIds: string[]; count: number; note?: string };
  leads?: Array<Record<string, unknown> & { _id: string; name: string }>;
  games?: Array<Record<string, unknown> & { _id: string; title: string }>;
}

export function CommandRunner({ compact = false }: { compact?: boolean }) {
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(cmd?: string) {
    const input = cmd ?? command;
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await clientFetch<CommandResponse>("/api/ai/command", {
        method: "POST",
        body: JSON.stringify({ command: input.trim() }),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={compact ? "" : "mb-6"}>
      <div className="p-5">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Try: “Show me high-potential basketball leads from the last 7 days”"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
          />
          <Button type="submit" variant="primary" disabled={loading || !command.trim()}>
            {loading ? <Spinner className="border-white/40 border-t-white" /> : "Run"}
          </Button>
        </form>
        {!compact && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setCommand(s);
                  run(s);
                }}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-900"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {compact ? (
        result ? (
          <div className="border-t border-zinc-100 px-5 py-3 text-sm">
            <span className="text-zinc-500">Plan:</span>{" "}
            <span className="text-zinc-900">{result.explanation}</span>
            {result.leads ? (
              <Link
                href="/"
                className="ml-2 text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
              >
                {result.leads.length} lead{result.leads.length === 1 ? "" : "s"} matched →
              </Link>
            ) : null}
            {result.games ? (
              <span className="ml-2 text-xs text-zinc-400">
                {result.games.length} game{result.games.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        ) : null
      ) : (
        <>
          {error ? (
            <div className="border-t border-zinc-100 px-5 py-3 text-sm text-rose-600">{error}</div>
          ) : null}
          {result ? (
            <div className="border-t border-zinc-100">
              <div className="px-5 py-3 text-sm">
                <span className="text-zinc-500">Plan:</span>{" "}
                <span className="text-zinc-900">{result.explanation}</span>
              </div>
              {result.result?.note ? (
                <div className="border-t border-zinc-100 px-5 py-2 text-xs text-emerald-700">
                  {result.result.note}
                </div>
              ) : null}
              {result.leads ? (
                <div className="border-t border-zinc-100">
                  {result.leads.length === 0 ? (
                    <EmptyState title="No leads matched the filters" />
                  ) : (
                    <ul className="divide-y divide-zinc-100">
                      {result.leads.map((l) => (
                        <li key={l._id as string}>
                          <Link
                            href={`/leads/${l._id as string}`}
                            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-zinc-900">{l.name as string}</div>
                              <div className="mt-0.5 truncate text-xs text-zinc-500">
                                {[l.playerName, l.team, l.sport].filter(Boolean).join(" · ") || "—"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <ScorePill score={l.score as number} />
                              <StatusBadge status={l.status as never} />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
              {result.games ? (
                <div className="border-t border-zinc-100">
                  {result.games.length === 0 ? (
                    <EmptyState title="No games matched the filters" />
                  ) : (
                    <ul className="divide-y divide-zinc-100">
                      {result.games.map((g) => (
                        <li key={g._id as string}>
                          <Link
                            href={`/games`}
                            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-zinc-50"
                          >
                            <span className="truncate text-sm font-medium text-zinc-900">{g.title as string}</span>
                            <span className="shrink-0 text-xs text-zinc-500">
                              {formatDate(g.date as string | undefined)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}