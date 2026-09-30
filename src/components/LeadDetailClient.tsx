"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  ScorePill,
  Spinner,
  StatusBadge,
  inputClass,
} from "@/components/ui";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/statuses";
import type { GameDTO, LeadDTO, OutreachDTO } from "@/types";
import { clientFetch, formatDate, formatDateTime } from "@/lib/format";

export function LeadDetailClient({
  lead: initialLead,
  game,
}: {
  lead: LeadDTO;
  game: GameDTO | null;
}) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadDTO>(initialLead);
  const [message, setMessage] = useState(initialLead.outreachMessage ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [researchInfo, setResearchInfo] = useState("");
  const [outreachHistory, setOutreachHistory] = useState<OutreachDTO[]>([]);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceKind, setEvidenceKind] = useState<
    "verified" | "ai_inferred" | "user_entered"
  >("verified");
  const [evidenceSource, setEvidenceSource] = useState("");

  const loadHistory = useCallback(async (leadId: string) => {
    try {
      const data = await clientFetch<{ outreach: OutreachDTO[] }>(
        `/api/outreach?leadId=${leadId}`
      );
      setOutreachHistory(data.outreach);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: initial history load intentionally sets state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory(initialLead._id);
  }, [initialLead._id, loadHistory]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy("patch");
      setError(null);
      setNotice(null);
      try {
        const data = await clientFetch<{ lead: LeadDTO | null }>(
          `/api/leads/${lead._id}`,
          { method: "PATCH", body: JSON.stringify(body) }
        );
        if (data.lead) {
          setLead((prev) => ({ ...prev, ...data.lead }));
          if (typeof body.outreachMessage === "string")
            setMessage(data.lead!.outreachMessage ?? "");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setBusy(null);
      }
    },
    [lead._id]
  );

  async function runScore() {
    setBusy("score");
    setError(null);
    setNotice(null);
    try {
      const data = await clientFetch<{ lead: LeadDTO }>(
        `/api/leads/${lead._id}/score`,
        { method: "POST" }
      );
      setLead((prev) => ({ ...prev, ...data.lead }));
      setNotice("Score updated via Gemini.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setBusy(null);
    }
  }

  async function runResearch() {
    setBusy("research");
    setError(null);
    setNotice(null);
    try {
      const data = await clientFetch<{ lead: LeadDTO }>(
        `/api/leads/${lead._id}/research`,
        { method: "POST", body: JSON.stringify({ info: researchInfo }) }
      );
      setLead((prev) => ({ ...prev, ...data.lead }));
      setNotice("Research updated via Gemini.");
      setResearchInfo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateMessage() {
    setBusy("message");
    setError(null);
    setNotice(null);
    try {
      const data = await clientFetch<{
        lead: LeadDTO;
        outreach: OutreachDTO;
      }>(`/api/leads/${lead._id}/message`, { method: "POST" });
      setLead((prev) => ({ ...prev, ...data.lead }));
      setMessage(data.lead.outreachMessage ?? "");
      setNotice("Message draft generated via Gemini.");
      await loadHistory(lead._id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    await patch({ status: "approved" });
    setNotice("Approved — message is ready for you to send manually.");
  }

  async function markContacted() {
    await patch({ status: "contacted" });
    setNotice("Marked contacted.");
  }

  async function setStatus(status: LeadStatus) {
    await patch({ status });
  }

  async function addEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!evidenceText.trim()) return;
    const item = {
      text: evidenceText.trim(),
      kind: evidenceKind,
      source: evidenceSource.trim() || undefined,
    };
    await patch({ evidence: [...(lead.evidence ?? []), item] });
    setEvidenceText("");
    setEvidenceSource("");
    setShowEvidenceForm(false);
  }

  async function deleteLead() {
    if (!confirm("Delete this lead and its outreach history?")) return;
    setBusy("delete");
    try {
      await clientFetch(`/api/leads/${lead._id}`, { method: "DELETE" });
      router.push("/leads");
    } finally {
      setBusy(null);
    }
  }

  const contactLines = [
    lead.email && { label: "Email", value: lead.email, url: `mailto:${lead.email}` },
    lead.socialUrl && { label: "Social", value: lead.socialUrl, url: lead.socialUrl },
    lead.profileUrl && { label: "Profile", value: lead.profileUrl, url: lead.profileUrl },
  ].filter(Boolean) as Array<{ label: string; value: string; url: string }>;

  return (
    <div className="container-shell space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-900">
              {lead.playerName || lead.name}
            </h1>
            <StatusBadge status={lead.status} />
            <ScorePill score={lead.score} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {[lead.team, lead.sport && `Sport: ${lead.sport}`, lead.position && `Position: ${lead.position}`, lead.graduationYear && `Class of ${lead.graduationYear}`]
              .filter(Boolean)
              .join(" · ")}
            {lead.score ? " · Internal score, not a factual measurement" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={lead.status}
            onChange={(e) => setStatus(e.target.value as LeadStatus)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <Button variant="danger" onClick={deleteLead} disabled={busy === "delete"}>
            Delete
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title="Lead information"
              subtitle={`Created ${formatDateTime(lead.createdAt)} · Updated ${formatDateTime(lead.updatedAt)}`}
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Info label="Player" value={lead.playerName} />
              <Info label="Contact" value={lead.name} />
              <Info label="Contact type" value={lead.contactType ?? "unknown"} />
              <Info label="Sport" value={lead.sport} />
              <Info label="Position" value={lead.position} />
              <Info label="Team" value={lead.team} />
              <Info label="Graduation year" value={lead.graduationYear ? String(lead.graduationYear) : undefined} />
              <Info label="Source" value={lead.source} />
              <Info label="Score" value={typeof lead.score === "number" ? `${lead.score}/100` : undefined} />
              <Info label="Recommended action" value={lead.recommendedAction} />
            </div>
            {contactLines.length > 0 ? (
              <div className="border-t border-zinc-100 px-5 py-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Contact &amp; profiles</h3>
                <div className="space-y-1.5">
                  {contactLines.map((c) => (
                    <a key={c.label} href={c.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-sky-700 hover:underline">
                      {c.label}: {c.value}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {lead.notes ? (
              <div className="border-t border-zinc-100 px-5 py-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Notes</h3>
                <p className="whitespace-pre-wrap text-sm text-zinc-600">{lead.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Game" subtitle="Linked game footage" />
            {game ? (
              <div className="space-y-4 p-5">
                <div>
                  <div className="text-sm font-medium text-zinc-900">{game.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {[game.sport, game.gender, game.graduationYear ? `Class of ${game.graduationYear}` : null]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {formatDate(game.date)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {game.url ? (
                    <a href={game.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-700 hover:underline">
                      Open game →
                    </a>
                  ) : null}
                  <Link href="/games" className="text-sm text-zinc-500 hover:text-zinc-900">
                    Manage games
                  </Link>
                </div>
                {game.analysis ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={game.analysis.recruitingRelevant ? "green" : "zinc"}>
                        {game.analysis.recruitingRelevant ? "Recruiting relevant" : "Not recruiting relevant"}
                      </Badge>
                      {game.analysis.gameType ? <span>{game.analysis.gameType}</span> : null}
                      <span className="uppercase">{game.analysis.confidence}</span>
                      <span className="text-zinc-400">· metadata-only analysis</span>
                    </div>
                    {game.analysis.summary ? (
                      <p className="mt-2">{game.analysis.summary}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">Game has not been analyzed yet.</p>
                )}
              </div>
            ) : (
              <EmptyState
                title="No game linked"
                note="Link this lead to a game to unlock scoring and outreach signals."
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Evidence"
              subtitle="FACT (verified) vs AI INFERENCE vs USER-ENTERED — never mixed"
              action={
                <Button variant="secondary" className="!px-2.5" onClick={() => setShowEvidenceForm((v) => !v)}>
                  + Add evidence
                </Button>
              }
            />
            {showEvidenceForm ? (
              <form onSubmit={addEvidence} className="space-y-3 p-5">
                <Field label="Evidence text">
                  <textarea className={inputClass} rows={2} value={evidenceText} onChange={(e) => setEvidenceText(e.target.value)} placeholder='e.g. "Facebook post names Jordan as starting forward in the Oct 4 game"' />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Kind">
                    <select className={inputClass} value={evidenceKind} onChange={(e) => setEvidenceKind(e.target.value as never)}>
                      <option value="verified">Verified fact</option>
                      <option value="ai_inferred">AI inference</option>
                      <option value="user_entered">User-entered</option>
                    </select>
                  </Field>
                  <Field label="Source (optional)">
                    <input className={inputClass} value={evidenceSource} onChange={(e) => setEvidenceSource(e.target.value)} placeholder="FB post, roster, scout note…" />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={!evidenceText.trim()}>Add item</Button>
                  <Button variant="ghost" onClick={() => setShowEvidenceForm(false)}>Cancel</Button>
                </div>
              </form>
            ) : null}
            {lead.evidence && lead.evidence.length > 0 ? (
              <ul className="divide-y divide-zinc-100">
                {lead.evidence.map((ev, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0 text-sm text-zinc-700">{ev.text}</div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={ev.kind === "verified" ? "green" : ev.kind === "ai_inferred" ? "amber" : "blue"}>
                        {ev.kind.replace(/_/g, " ")}
                      </Badge>
                      {ev.source ? <span className="text-[11px] text-zinc-400">{ev.source}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No evidence recorded" note="Evidence keeps AI inference distinct from confirmed facts." />
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="AI analysis"
              subtitle="FACT → INFERENCE → UNKNOWN"
              action={
                <Button variant="primary" className="!px-2.5" onClick={runResearch} disabled={busy === "research"}>
                  {busy === "research" ? <Spinner className="border-white/40 border-t-white" /> : "Run research"}
                </Button>
              }
            />
            <div className="space-y-4 p-5">
              <Field label="Paste public info to organize" hint="e.g. public Facebook post text or profile copy you're allowed to use. AI never guesses the rest.">
                <textarea className={inputClass} rows={3} value={researchInfo} onChange={(e) => setResearchInfo(e.target.value)} placeholder="Public Facebook post text, roster info, team announcement…" />
              </Field>

              <ResearchSection title="Known information" tone="green" items={lead.verifiedInformation ?? lead.research?.knownInformation} empty="Not researched yet." />
              <ResearchSection title="Possible signals (needs verification)" tone="amber" items={lead.inferredInformation ?? lead.research?.possibleSignals} empty="—" />
              <ResearchSection title="Missing information (do not guess)" tone="zinc" items={lead.missingInformation ?? lead.research?.missingInformation} empty="—" />

              {lead.research ? (
                <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Why this lead?</h4>
                    <p className="mt-1 text-sm text-zinc-700">{lead.research.whyThisLead}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Suggested angle</h4>
                    <p className="mt-1 text-sm text-zinc-700">{lead.research.suggestedAngle}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Lead score"
              subtitle="Internal prioritization 0–100"
              action={
                <Button variant="secondary" className="!px-2.5" onClick={runScore} disabled={busy === "score"}>
                  {busy === "score" ? <Spinner /> : typeof lead.score === "number" ? "Re-score" : "Score"}
                </Button>
              }
            />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-4xl font-semibold text-zinc-900">
                  {typeof lead.score === "number" ? lead.score : "—"}
                </div>
                <div className="text-right text-xs text-zinc-500">
                  {lead.confidence ? <div className="mb-1"><Badge tone={lead.confidence === "high" ? "green" : lead.confidence === "medium" ? "amber" : "zinc"}>{lead.confidence} confidence</Badge></div> : null}
                  {lead.recommendedAction ? <div>{lead.recommendedAction}</div> : null}
                </div>
              </div>
              {lead.scoreReasons && lead.scoreReasons.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {lead.scoreReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                      <span className="mt-0.5 text-emerald-600">•</span> {r}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Outreach"
              subtitle="You edit and send manually — nothing is auto-sent"
              action={
                <Button variant="primary" className="!px-2.5" onClick={generateMessage} disabled={busy === "message"}>
                  {busy === "message" ? <Spinner className="border-white/40 border-t-white" /> : lead.outreachMessage ? "Regenerate" : "Generate message"}
                </Button>
              }
            />
            <div className="space-y-3 p-5">
              <textarea
                className={inputClass + " min-h-[160px]"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="No message yet. Generate a draft, then edit it here."
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (message.trim()) {
                      void navigator.clipboard.writeText(message.trim());
                      setNotice("Copied to clipboard.");
                    }
                  }}
                  disabled={!message.trim()}
                >
                  Copy
                </Button>
                <Button variant="secondary" onClick={() => patch({ outreachMessage: message.trim() })} disabled={!message.trim() || message.trim() === (lead.outreachMessage ?? "")}>
                  Save edits
                </Button>
                <div className="flex-1" />
                <Button variant="primary" onClick={approve} disabled={!message.trim()}>
                  Approve
                </Button>
                <Button variant="secondary" onClick={markContacted} disabled={!message.trim()}>
                  Mark contacted
                </Button>
              </div>
              {outreachHistory.length > 0 ? (
                <div className="border-t border-zinc-100 pt-3">
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Versions</h4>
                  <ul className="space-y-1.5">
                    {outreachHistory.map((o) => (
                      <li key={o._id} className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span className="truncate">{formatDateTime(o.createdAt)} · {o.channel}</span>
                        <Badge tone={o.status === "sent" ? "green" : o.status === "approved" ? "blue" : "zinc"}>{o.status}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-0.5 text-sm text-zinc-800">{value || "—"}</div>
    </div>
  );
}

function ResearchSection({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: "green" | "amber" | "zinc";
  items?: string[];
  empty: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Badge tone={tone}>{title}</Badge>
      </div>
      {items && items.length > 0 ? (
        <ul className="space-y-1 text-sm text-zinc-600">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 text-zinc-300">·</span> {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-400">{empty}</p>
      )}
    </div>
  );
}