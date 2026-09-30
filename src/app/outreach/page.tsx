"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Spinner } from "@/components/ui";
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
  outreachMessage?: string | null;
  email?: string;
}

const NEXT: Partial<Record<LeadStatus, LeadStatus>> = {
  new: "qualified",
  qualified: "message_ready",
  message_ready: "approved",
  approved: "contacted",
  contacted: "replied",
  replied: "interested",
  interested: "converted",
};

const COLUMN_LABELS: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  message_ready: "Message Ready",
  approved: "Approved",
  contacted: "Contacted",
  replied: "Replied",
  interested: "Interested → Interested/No",
  not_interested: "Not Interested",
  converted: "Converted",
  do_not_contact: "Do Not Contact",
};

const VISIBLE_COLUMNS: LeadStatus[] = [
  "new",
  "qualified",
  "message_ready",
  "approved",
  "contacted",
  "replied",
  "interested",
  "converted",
  "do_not_contact",
];

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientFetch<{ leads: Lead[] }>("/api/leads?limit=200");
      setLeads(data.leads);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: initial load intentionally sets loading state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function move(id: string, status: LeadStatus) {
    setBusyId(id);
    setError(null);
    try {
      const data = await clientFetch<{ lead: Lead | null }>(`/api/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setLeads((prev) => prev.map((l) => (l._id === id ? { ...l, ...data.lead } : l)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function jumpTo(id: string, status: LeadStatus) {
    await move(id, status);
  }

  const byStatus = (s: LeadStatus) => leads.filter((l) => l.status === s);

  return (
    <div className="container-shell space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Outreach pipeline</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Move leads through the pipeline. You approve and send every message yourself.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <Card><div className="flex justify-center py-14"><Spinner /></div></Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {VISIBLE_COLUMNS.map((col) => {
            const items = byStatus(col);
            return (
              <div key={col} className="flex w-64 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {COLUMN_LABELS[col]}
                  </span>
                  <Badge tone="zinc">{items.length}</Badge>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-xs text-zinc-300">
                      Empty
                    </div>
                  ) : (
                    items.map((l) => {
                      const next = NEXT[l.status];
                      return (
                        <Card key={l._id} className="p-3">
                          <Link href={`/leads/${l._id}`} className="block">
                            <div className="text-sm font-medium text-zinc-900 hover:underline">
                              {l.playerName || l.name}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-zinc-500">
                              {[l.team, l.sport].filter(Boolean).join(" · ") || "—"}
                            </div>
                          </Link>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-zinc-400">
                              {l.score !== undefined ? `${l.score} score` : "unscored"}
                            </span>
                            <select
                              value={l.status}
                              onChange={(e) => jumpTo(l._id, e.target.value as LeadStatus)}
                              className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-600"
                            >
                              {LEAD_STATUSES.map((s) => (
                                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                              ))}
                            </select>
                          </div>
                          {next ? (
                            <Button
                              variant="secondary"
                              className="mt-2 !px-2 !py-1 text-xs w-full"
                              disabled={busyId === l._id || (next === "message_ready" && !l.outreachMessage)}
                              onClick={() => move(l._id, next)}
                            >
                              {busyId === l._id ? <Spinner /> : `→ ${COLUMN_LABELS[next]}`}
                            </Button>
                          ) : null}
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}