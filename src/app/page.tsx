"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { Button, Card, CardHeader, EmptyState, ScorePill, Spinner, StatusBadge, inputClass } from "@/components/ui";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/statuses";
import { clientFetch, formatDate, formatDateTime } from "@/lib/format";

interface Lead {
  _id: string;
  name: string;
  playerName?: string;
  sport?: string;
  team?: string;
  graduationYear?: number;
  status: LeadStatus;
  score?: number;
  gameId?: string | null;
  email?: string;
}

interface Game {
  _id: string;
  title: string;
  date?: string | null;
}

interface FetchReport {
  created: Lead[];
  discovered: number;
  skipped: Array<{ name: string; reason: string }>;
  queries: string[];
  failedQueries: string[];
  searchedUrls: number;
  sources: Array<{ title: string; url: string }>;
  pageFetchFailures: Array<{ url: string; reason: string }>;
  targets: string[];
  windowLabel: string;
  linkedGame: { id: string; title: string; date: string } | null;
  linkedGameWithinWindow: boolean;
}

type MatchSort = "off" | "earliest" | "latest";

const MATCH_SORT_LABELS: Record<MatchSort, string> = {
  off: "Sort by match date",
  earliest: "Match date · earliest",
  latest: "Match date · latest",
};

const MATCH_SORT_NEXT: Record<MatchSort, MatchSort> = {
  off: "earliest",
  earliest: "latest",
  latest: "off",
};

const RECENT_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date | number): number {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(value: Date | number): number {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function matchTime(game: Game | undefined): number | null {
  if (!game?.date) return null;
  const t = new Date(game.date).getTime();
  return Number.isNaN(t) ? null : t;
}

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [games, setGames] = useState<Map<string, Game>>(new Map());
  const [matchSort, setMatchSort] = useState<MatchSort>("off");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState("");
  const [minScore, setMinScore] = useState("");
  const [applied, setApplied] = useState<Record<string, string>>({});

  const [fetching, setFetching] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [fetchReport, setFetchReport] = useState<FetchReport | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<Record<string, string>>>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ created: unknown[]; skipped: unknown[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (applied.q) params.set("q", applied.q);
      if (applied.sport) params.set("sport", applied.sport);
      if (applied.status) params.set("status", applied.status);
      if (applied.minScore) params.set("minScore", applied.minScore);
      const data = await clientFetch<{ leads: Lead[] }>(`/api/leads?${params.toString()}`);
      const g = await clientFetch<{ games: Game[] }>("/api/games?limit=500");
      setLeads(data.leads);
      setGames(new Map(g.games.map((x) => [x._id, x])));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
      return false;
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    // Fetch-on-mount: initial load intentionally sets loading state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleFetch() {
    setFetching(true);
    setFetchError(null);
    setFetchReport(null);
    try {
      const report = await clientFetch<FetchReport>("/api/leads/fetch", {
        method: "POST",
        body: JSON.stringify({ windowDays: RECENT_WINDOW_DAYS }),
      });
      setFetchReport(report);
      setFetchedAt(new Date());
      // The lead list is stale once new leads land, and active filters can hide
      // them — clear filters and reload so the results are actually visible.
      if (Object.keys(applied).some((key) => applied[key])) {
        setQ("");
        setSport("");
        setStatus("");
        setMinScore("");
        setApplied({}); // clears -> mount effect reloads the unfiltered list
      } else {
        await load();
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Lead fetch failed");
    } finally {
      setFetching(false);
    }
  }

  const sortedLeads = useMemo(() => {
    if (matchSort === "off") return leads;
    const dir = matchSort === "earliest" ? 1 : -1;
    return [...leads].sort((a, b) => {
      const aTime = matchTime(a.gameId ? games.get(a.gameId) : undefined);
      const bTime = matchTime(b.gameId ? games.get(b.gameId) : undefined);
      if (aTime === null) return bTime === null ? 0 : 1;
      if (bTime === null) return -1;
      return (aTime - bTime) * dir;
    });
  }, [leads, games, matchSort]);

  // Calendar days, not a rolling 168 hours: a game played at midnight on the
  // boundary day still counts, which matches how the fetch window is built.
  const recentWindow = useMemo(() => {
    if (!fetchedAt) return null;
    const windowEnd = endOfDay(fetchedAt);
    const windowStart = startOfDay(
      new Date(windowEnd - (RECENT_WINDOW_DAYS - 1) * DAY_MS)
    );
    return { windowStart, windowEnd };
  }, [fetchedAt]);

  const newestGameDate = useMemo(() => {
    let newest: number | null = null;
    for (const game of games.values()) {
      const t = matchTime(game);
      if (t !== null && (newest === null || t > newest)) newest = t;
    }
    return newest;
  }, [games]);

  const recentGameLeads = useMemo(() => {
    if (!recentWindow) return [];
    const { windowStart, windowEnd } = recentWindow;
    return leads
      .map((lead) => {
        const game = lead.gameId ? games.get(lead.gameId) : undefined;
        const time = matchTime(game);
        if (time === null || time < windowStart || time > windowEnd) return null;
        return { lead, game: game as Game, time };
      })
      .filter((entry): entry is { lead: Lead; game: Game; time: number } => entry !== null)
      .sort((a, b) => b.time - a.time);
  }, [leads, games, recentWindow]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setApplied({ q: q.trim(), sport, status, minScore });
  }

  function clearFilters() {
    setQ("");
    setSport("");
    setStatus("");
    setMinScore("");
    setApplied({});
  }

  function handleFile(file: File) {
    setImportError(null);
    setImported(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0) {
          setImportError(`CSV parse issues: ${res.errors.slice(0, 3).map((e) => e.message).join("; ")}`);
        }
        const rows = res.data.filter((r) => r && Object.values(r as object).some(Boolean));
        setCsvPreview(rows);
        setCsvColumns(res.meta.fields ?? []);
        setShowImport(true);
      },
      error: (err) => setImportError(err.message),
    });
  }

  async function runImport() {
    setImporting(true);
    setImportError(null);
    try {
      const data = await clientFetch<{ created: unknown[]; skipped: unknown[] }>("/api/leads/import", {
        method: "POST",
        body: JSON.stringify({ rows: csvPreview }),
      });
      setImported(data);
      setShowImport(false);
      setApplied((prev) => ({ ...prev }));
      await load();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="container-shell space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Leads</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Potential clients for player-specific recruiting/highlight videos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleFetch} disabled={fetching || loading}>
            {fetching ? <Spinner className="border-white/40 border-t-white" /> : "Fetch leads"}
          </Button>
          <Button
            variant={matchSort === "off" ? "secondary" : "primary"}
            onClick={() => setMatchSort((prev) => MATCH_SORT_NEXT[prev])}
          >
            {MATCH_SORT_LABELS[matchSort]}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Import CSV
          </Button>
          <Link href="/leads/new">
            <Button variant="primary">Add lead</Button>
          </Link>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      {fetchError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{fetchError}</div>
      ) : null}
      {fetching ? (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500">
          <Spinner /> Searching online sources, then extracting named players with AI…
        </div>
      ) : null}
      {imported ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Imported {imported.created.length} lead(s); {imported.skipped.length} skipped.
        </div>
      ) : null}

      {fetchReport ? (
        <Card>
          <CardHeader
            title="AI web fetch results"
            subtitle={`${fetchReport.created.length} saved · ${fetchReport.discovered} named individual${fetchReport.discovered === 1 ? "" : "s"} found · ${fetchReport.skipped.length} duplicate${fetchReport.skipped.length === 1 ? "" : "s"} skipped · ${fetchReport.searchedUrls} source page${fetchReport.searchedUrls === 1 ? "" : "s"} read`}
            action={
              <span className="whitespace-nowrap text-[11px] text-zinc-400">
                {fetchReport.queries.length} quer{fetchReport.queries.length === 1 ? "y" : "ies"}
                {fetchReport.failedQueries.length
                  ? ` · ${fetchReport.failedQueries.length} failed`
                  : ""}
              </span>
            }
          />

          {fetchReport.created.length === 0 ? (
            <EmptyState
              title="No new leads saved"
              note={
                fetchReport.discovered === 0
                  ? "No named individuals appeared in the pages that were read. Add games with team names or more Websites entries and fetch again."
                  : "Every named individual was already in the database."
              }
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {fetchReport.created.map((lead) => (
                <li key={lead._id}>
                  <Link
                    href={`/leads/${lead._id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-900">
                        {lead.playerName ? lead.playerName : lead.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        {[lead.name !== lead.playerName ? lead.name : null, lead.team, lead.sport]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="whitespace-nowrap text-[11px] uppercase text-amber-700">
                        needs verification
                      </span>
                      <StatusBadge status={lead.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-zinc-100 px-5 py-3 text-[11px] text-zinc-400">
            <div>
              Targets: {fetchReport.targets.length ? fetchReport.targets.join(" · ") : "—"}
            </div>
            <div>
              Queries: {fetchReport.queries.length ? fetchReport.queries.join("  |  ") : "—"}
            </div>
            {fetchReport.created.length > 0 ? (
              <div>
                {fetchReport.linkedGame
                  ? fetchReport.linkedGameWithinWindow
                    ? `Linked to newest game in window: ${fetchReport.linkedGame.title} (unverified — the source page did not name a game)`
                    : `Linked to newest game: ${fetchReport.linkedGame.title}, played ${formatDate(
                        fetchReport.linkedGame.date
                      )} — outside the ${RECENT_WINDOW_DAYS}-day window, so these leads show in the list but not the “Played in the last ${RECENT_WINDOW_DAYS} days” card`
                  : "No dated game found, so these leads were not linked to a game."}
              </div>
            ) : null}
            {fetchReport.sources.length ? (
              <details>
                <summary className="cursor-pointer">
                  {fetchReport.sources.length} source page{fetchReport.sources.length === 1 ? "" : "s"} read
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {fetchReport.sources.map((s) => (
                    <li key={s.url} className="truncate">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline underline-offset-2 hover:text-zinc-600"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {fetchReport.pageFetchFailures.length ? (
              <details>
                <summary className="cursor-pointer">
                  {fetchReport.pageFetchFailures.length} page{fetchReport.pageFetchFailures.length === 1 ? "" : "s"} could not be read
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {fetchReport.pageFetchFailures.map((f) => (
                    <li key={f.url} className="truncate">
                      {f.url} — {f.reason}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div>
              Names and URLs are copied verbatim from those pages and nothing else.
              Email, phone, and social handles are never invented — verify each lead
              before outreach.
            </div>
          </div>
        </Card>
      ) : null}

      {fetchedAt ? (
        <Card>
          <CardHeader
            title={`Played in the last ${RECENT_WINDOW_DAYS} days`}
            subtitle={
              recentWindow
                ? `${recentGameLeads.length} lead${recentGameLeads.length === 1 ? "" : "s"} linked to a game played between ${formatDate(new Date(recentWindow.windowStart).toISOString())} and ${formatDate(new Date(recentWindow.windowEnd).toISOString())} · newest match first`
                : undefined
            }
            action={
              <span className="whitespace-nowrap text-[11px] text-zinc-400">
                Fetched {formatDateTime(fetchedAt.toISOString())}
              </span>
            }
          />
          {recentGameLeads.length === 0 ? (
            <EmptyState
              title={`No games played in the last ${RECENT_WINDOW_DAYS} days`}
              note={
                newestGameDate !== null
                  ? `Newest game on file was played ${formatDate(new Date(newestGameDate).toISOString())}, which is outside this window. Record a game in the last ${RECENT_WINDOW_DAYS} days, or link a lead to it, then fetch again.`
                  : "Record a game, or link a lead to one, then fetch again."
              }
            />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentGameLeads.map(({ lead, game }) => (
                <li key={lead._id}>
                  <Link
                    href={`/leads/${lead._id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-900">
                        {lead.playerName ? lead.playerName : lead.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        {[lead.team, lead.sport].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="flex min-w-0 shrink-0 items-center gap-3">
                      <span className="hidden max-w-[200px] truncate text-xs text-zinc-500 md:block" title={game.title}>
                        {game.title}
                      </span>
                      <span className="whitespace-nowrap text-xs text-zinc-500">{formatDate(game.date)}</span>
                      <ScorePill score={lead.score} />
                      <StatusBadge status={lead.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card>
        <form onSubmit={applyFilters} className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_160px_200px_140px_auto]">
          <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, player, team, email…" />
          <input className={inputClass} value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Sport (soccer)" />
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select className={inputClass} value={minScore} onChange={(e) => setMinScore(e.target.value)}>
            <option value="">Any score</option>
            <option value="75">High potential (75+)</option>
            <option value="50">50+</option>
            <option value="0">0+ (all)</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" variant="primary">Filter</Button>
            <Button type="button" variant="ghost" onClick={clearFilters}>Clear</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Lead list"
          subtitle={`${leads.length} lead${leads.length === 1 ? "" : "s"} · Scores are internal prioritization only`}
        />
        {loading ? (
          <div className="flex items-center justify-center py-14"><Spinner /></div>
        ) : leads.length === 0 ? (
          <EmptyState title="No leads match" note="Adjust filters, add a lead, or import a CSV." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="px-5 py-3 font-medium">Lead</th>
                  <th className="px-3 py-3 font-medium">Sport</th>
                  <th className="px-3 py-3 font-medium">Team</th>
                  <th className="px-3 py-3 font-medium">Grad</th>
                  <th className="px-3 py-3 font-medium">Game</th>
                  <th className="px-3 py-3 font-medium">Match date</th>
                  <th className="px-3 py-3 font-medium">Score</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sortedLeads.map((l) => (
                  <tr key={l._id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3">
                      <Link href={`/leads/${l._id}`} className="font-medium text-zinc-900 hover:underline">
                        {l.playerName ? l.playerName : l.name}
                      </Link>
                      {l.playerName ? <div className="mt-0.5 text-xs text-zinc-400">{l.name}</div> : null}
                    </td>
                    <td className="px-3 py-3 capitalize text-zinc-600">{l.sport || "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-3 text-zinc-600">{l.team || "—"}</td>
                    <td className="px-3 py-3 text-zinc-600">{l.graduationYear || "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-3 text-zinc-600">
                      {l.gameId ? games.get(l.gameId)?.title || "Linked" : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-zinc-600">
                      {l.gameId ? formatDate(games.get(l.gameId)?.date) : "—"}
                    </td>
                    <td className="px-3 py-3"><ScorePill score={l.score} /></td>
                    <td className="px-3 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/leads/${l._id}`} className="text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matchSort !== "off" ? (
              <p className="border-t border-zinc-100 px-5 py-3 text-[11px] text-zinc-400">
                Sorted by linked match date · leads without a match date are listed last.
              </p>
            ) : null}
          </div>
        )}
      </Card>

      {showImport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">CSV preview</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {csvPreview.length} row(s) · normalize &amp; validate before importing
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowImport(false)} disabled={importing}>Cancel</Button>
                <Button variant="primary" onClick={runImport} disabled={importing}>
                  {importing ? <Spinner className="border-white/40 border-t-white" /> : `Import ${csvPreview.length}`}
                </Button>
              </div>
            </div>
            {importError ? <div className="border-b border-rose-200 bg-rose-50 px-5 py-2 text-sm text-rose-700">{importError}</div> : null}
            <div className="overflow-auto px-5 py-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-zinc-400">
                    {csvColumns.slice(0, 8).map((c) => (
                      <th key={c} className="max-w-[140px] truncate px-2 py-1.5 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {csvPreview.slice(0, 30).map((row, i) => (
                    <tr key={i}>
                      {csvColumns.slice(0, 8).map((c) => (
                        <td key={c} className="max-w-[140px] truncate px-2 py-1.5 text-zinc-600">{row[c] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvPreview.length > 30 ? (
                <div className="pt-2 text-[11px] text-zinc-400">…and {csvPreview.length - 30} more rows</div>
              ) : null}
            </div>
            <div className="border-t border-zinc-100 px-5 py-3 text-[11px] text-zinc-400">
              Supported columns: name, playerName, sport, team, graduationYear, position, email, socialUrl, profileUrl, gameUrl, notes, source.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}