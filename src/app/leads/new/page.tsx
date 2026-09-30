"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardHeader, Field, Spinner, inputClass } from "@/components/ui";
import { clientFetch } from "@/lib/format";

const SERVICES = [
  { label: "Parent / Contact", value: "parent" },
  { label: "Athlete", value: "athlete" },
  { label: "Coach", value: "coach" },
  { label: "Team", value: "team" },
  { label: "Agency", value: "agency" },
  { label: "Unknown", value: "unknown" },
];

const EMPTY = {
  name: "",
  playerName: "",
  contactType: "unknown",
  sport: "",
  position: "",
  team: "",
  graduationYear: "",
  email: "",
  socialUrl: "",
  profileUrl: "",
  gameUrl: "",
  source: "Manual",
  notes: "",
};

export default function NewLeadPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await clientFetch<{ lead: { _id: string } }>("/api/leads", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
        }),
      });
      router.push(`/leads/${data.lead._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
      setBusy(false);
    }
  }

  return (
    <div className="container-shell max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Add lead</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Start with what you know. AI research and scoring can enrich the lead later — it never fabricates facts.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div> : null}

      <Card>
        <CardHeader title="Lead information" />
        <form onSubmit={submit} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Player name">
              <input className={inputClass} value={form.playerName} onChange={set("playerName")} placeholder="Jordan Smith" />
            </Field>
            <Field label="Contact / parent name">
              <input className={inputClass} value={form.name} onChange={set("name")} placeholder="Sarah Smith" required />
            </Field>
            <Field label="Contact type">
              <select className={inputClass} value={form.contactType} onChange={set("contactType")}>
                {SERVICES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Sport">
              <input className={inputClass} value={form.sport} onChange={set("sport")} placeholder="basketball" />
            </Field>
            <Field label="Position">
              <input className={inputClass} value={form.position} onChange={set("position")} placeholder="guard" />
            </Field>
            <Field label="Team">
              <input className={inputClass} value={form.team} onChange={set("team")} placeholder="Riverside High" />
            </Field>
            <Field label="Graduation year">
              <input type="number" className={inputClass} value={form.graduationYear} onChange={set("graduationYear")} placeholder="2027" />
            </Field>
            <Field label="Source">
              <input className={inputClass} value={form.source} onChange={set("source")} placeholder="YouTube, Facebook, manual…" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Email">
                <input className={inputClass} value={form.email} onChange={set("email")} placeholder="parent@example.com" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Social URL" hint="e.g. Facebook profile or team page">
                <input className={inputClass} value={form.socialUrl} onChange={set("socialUrl")} placeholder="https://facebook.com/…" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Public profile URL">
                <input className={inputClass} value={form.profileUrl} onChange={set("profileUrl")} placeholder="https://…" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Game URL" hint="Link to full-game footage if known">
                <input className={inputClass} value={form.gameUrl} onChange={set("gameUrl")} placeholder="https://youtube.com/…" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <textarea className={inputClass} value={form.notes} onChange={set("notes")} rows={3} placeholder="Evidence: public Facebook post about game, roster link, etc." />
              </Field>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={busy || !form.name.trim()}>
              {busy ? <Spinner className="border-white/40 border-t-white" /> : "Create lead"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}