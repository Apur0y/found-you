"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { Button, Card, CardHeader, EmptyState, ScorePill, Spinner, StatusBadge, inputClass } from "@/components/ui";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/statuses";
import { clientFetch } from "@/lib/format";

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
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [games, setGames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [sport, setSport] = useState("");
  const [status, setStatus] = useState("");
  const [minScore, setMinScore] = useState("");
  const [applied, setApplied] = useState<Record<string, string>>({});

  const [showImport, setShowImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<Record<string, string>>>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ created: unknown[]; skipped: unknown[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
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
      setGames(new Map(g.games.map((x) => [x._id, x.title])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    // Fetch-on-mount: initial load intentionally sets loading state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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
      {imported ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          Imported {imported.created.length} lead(s); {imported.skipped.length} skipped.
        </div>
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
                  <th className="px-3 py-3 font-medium">Score</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {leads.map((l) => (
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
                      {l.gameId ? games.get(l.gameId) || "Linked" : "—"}
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