"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Spinner, inputClass } from "@/components/ui";
import { clientFetch, formatDate } from "@/lib/format";

interface Game {
  _id: string;
  title: string;
  sport?: string;
  date?: string | null;
  teamA?: string;
  teamB?: string;
  gender?: string;
  graduationYear?: number;
  url?: string;
  source?: string;
  notes?: string;
  analysis?: {
    recruitingRelevant?: boolean;
    gameType?: string;
    summary?: string;
    confidence?: string;
    analyzedAt?: string;
    analysisBasis?: string;
    reason?: string;
  };
  createdAt: string;
}

const EMPTY_FORM = {
  title: "",
  sport: "",
  gender: "",
  date: "",
  teamA: "",
  teamB: "",
  graduationYear: "",
  url: "",
  source: "Manual",
  notes: "",
};

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search ? `?q=${encodeURIComponent(search)}` : "";
      const data = await clientFetch<{ games: Game[] }>(`/api/games${q}`);
      setGames(data.games);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load games");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // Fetch-on-mount: initial load intentionally sets loading state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function addGame(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await clientFetch<{ game: Game }>("/api/games", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setGames((prev) => [data.game, ...prev]);
      setForm(EMPTY_FORM);
      setNotice("Game added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add game");
    } finally {
      setBusy(false);
    }
  }

  async function analyze(id: string) {
    setAnalyzingId(id);
    setError(null);
    try {
      const data = await clientFetch<{ game: Game }>(`/api/games/${id}/analyze`, {
        method: "POST",
      });
      setGames((prev) => prev.map((g) => (g._id === id ? data.game : g)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  }

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="container-shell space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Log full-game footage you find. AI analysis is metadata-only — it never claims to have watched the video.
        </p>
      </div>

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <Card>
        <CardHeader title="Add a game" subtitle='Example: 2027 Girls Soccer — ABC Academy vs XYZ Elite' />
        <form onSubmit={addGame} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Game title *">
                <input className={inputClass} value={form.title} onChange={set("title")} placeholder="2027 Girls Soccer — ABC Academy vs XYZ Elite" required />
              </Field>
            </div>
            <Field label="Sport">
              <input className={inputClass} value={form.sport} onChange={set("sport")} placeholder="soccer" />
            </Field>
            <Field label="Gender">
              <input className={inputClass} value={form.gender} onChange={set("gender")} placeholder="female" />
            </Field>
            <Field label="Date">
              <input type="date" className={inputClass} value={form.date} onChange={set("date")} />
            </Field>
            <Field label="Team A">
              <input className={inputClass} value={form.teamA} onChange={set("teamA")} placeholder="ABC Academy" />
            </Field>
            <Field label="Team B">
              <input className={inputClass} value={form.teamB} onChange={set("teamB")} placeholder="XYZ Elite" />
            </Field>
            <Field label="Grad year">
              <input type="number" className={inputClass} value={form.graduationYear} onChange={set("graduationYear")} placeholder="2027" />
            </Field>
            <Field label="Game URL" hint="e.g. YouTube link">
              <input className={inputClass} value={form.url} onChange={set("url")} placeholder="https://..." />
            </Field>
            <Field label="Source">
              <input className={inputClass} value={form.source} onChange={set("source")} placeholder="YouTube" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Notes">
                <textarea className={inputClass} value={form.notes} onChange={set("notes")} rows={2} />
              </Field>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={busy || !form.title.trim()}>
              {busy ? <Spinner className="border-white/40 border-t-white" /> : "Add game"}
            </Button>
            <Button variant="ghost" onClick={() => setForm(EMPTY_FORM)}>Clear</Button>
            <div className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
              <input className={inputClass + " !w-64"} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, teams, source…" />
            </div>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Games" subtitle={`${games.length} game${games.length === 1 ? "" : "s"}`} />
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : games.length === 0 ? (
          <EmptyState title="No games yet" note="Add your first game above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-3 py-3 font-medium">Sport</th>
                  <th className="px-3 py-3 font-medium">Grad</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium">Analysis</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {games.map((g) => (
                  <tr key={g._id} className="hover:bg-zinc-50">
                    <td className="max-w-[260px] px-5 py-3">
                      <div className="truncate font-medium text-zinc-900" title={g.title}>
                        {g.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-zinc-400">
                        {[g.teamA, g.teamB].filter(Boolean).join(" vs ")}
                      </div>
                    </td>
                    <td className="px-3 py-3 capitalize text-zinc-600">{g.sport || "—"}</td>
                    <td className="px-3 py-3 text-zinc-600">{g.graduationYear || "—"}</td>
                    <td className="px-3 py-3 text-zinc-600">{formatDate(g.date)}</td>
                    <td className="px-3 py-3 text-zinc-600">{g.source || "—"}</td>
                    <td className="px-3 py-3">
                      {g.analysis?.recruitingRelevant === undefined ? (
                        <span className="text-xs text-zinc-400">Not analyzed</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge tone={g.analysis.recruitingRelevant ? "green" : "zinc"}>
                            {g.analysis.recruitingRelevant ? "Relevant" : "Not relevant"}
                          </Badge>
                          <span className="text-[10px] uppercase text-zinc-400">{g.analysis.confidence}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {g.analysis?.recruitingRelevant === undefined ? (
                        <Button variant="secondary" className="!px-2.5" onClick={() => analyze(g._id)} disabled={analyzingId === g._id}>
                          {analyzingId === g._id ? <Spinner /> : "Analyze"}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}