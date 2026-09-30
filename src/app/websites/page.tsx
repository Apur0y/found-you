"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Spinner, inputClass } from "@/components/ui";
import { clientFetch } from "@/lib/format";
import {
  WEBSITE_CATEGORIES,
  WEBSITE_CATEGORY_LABELS,
  type WebsiteCategory,
} from "@/lib/websites";

interface Website {
  _id: string;
  name: string;
  url: string;
  category: WebsiteCategory;
  sports: string[];
  region: string;
  access: string;
  description: string;
  useCase: string;
  notes?: string;
}

const EMPTY_FORM = {
  name: "",
  url: "",
  category: "video_footage" as WebsiteCategory,
  sports: "",
  region: "National",
  access: "Free",
  description: "",
  useCase: "",
};

const visitClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800";

export default function WebsitesPage() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      const qs = params.toString();
      const data = await clientFetch<{ websites: Website[] }>(
        `/api/websites${qs ? `?${qs}` : ""}`
      );
      setWebsites(data.websites);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load websites");
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    // Fetch-on-mount: initial load intentionally sets loading state here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function addWebsite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await clientFetch<{ website: Website }>("/api/websites", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          sports: form.sports
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setWebsites((prev) =>
        [...prev, data.website].sort((a, b) =>
          `${a.category}${a.name}`.localeCompare(`${b.category}${b.name}`)
        )
      );
      setForm(EMPTY_FORM);
      setNotice("Website added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add website");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the list?`)) return;
    setError(null);
    try {
      await clientFetch<{ ok: boolean }>(`/api/websites/${id}`, {
        method: "DELETE",
      });
      setWebsites((prev) => prev.filter((w) => w._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove website");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<WebsiteCategory, Website[]>();
    for (const w of websites) {
      const list = map.get(w.category) ?? [];
      list.push(w);
      map.set(w.category, list);
    }
    return [...map.entries()].sort(
      (a, b) =>
        WEBSITE_CATEGORIES.indexOf(a[0]) - WEBSITE_CATEGORIES.indexOf(b[0])
    );
  }, [websites]);

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="container-shell space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Websites</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Where to find footage, rosters and recruiting profiles. Every link opens
          in a new tab.
        </p>
      </div>

      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      ) : null}

      <Card>
        <CardHeader
          title="Add a website"
          subtitle="Anything you use to find players, footage or parent contacts."
        />
        <form onSubmit={addWebsite} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name *">
              <input className={inputClass} value={form.name} onChange={set("name")} placeholder="Hudl" required />
            </Field>
            <Field label="URL *">
              <input className={inputClass} value={form.url} onChange={set("url")} placeholder="https://hudl.com" required />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={form.category} onChange={set("category")}>
                {WEBSITE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {WEBSITE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sports" hint="Comma separated, e.g. basketball, soccer">
              <input className={inputClass} value={form.sports} onChange={set("sports")} placeholder="basketball, soccer" />
            </Field>
            <Field label="Region">
              <input className={inputClass} value={form.region} onChange={set("region")} placeholder="National" />
            </Field>
            <Field label="Access">
              <input className={inputClass} value={form.access} onChange={set("access")} placeholder="Free" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="What is there">
                <input className={inputClass} value={form.description} onChange={set("description")} placeholder="Team pages with full-game video and player profiles." />
              </Field>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="How it helps you find clients">
                <textarea className={inputClass} value={form.useCase} onChange={set("useCase")} rows={2} />
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy || !form.name.trim() || !form.url.trim()}>
              {busy ? <Spinner className="border-white/40 border-t-white" /> : "Add website"}
            </Button>
            <Button variant="ghost" onClick={() => setForm(EMPTY_FORM)}>Clear</Button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                className={inputClass + " !w-48"}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {WEBSITE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {WEBSITE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                className={inputClass + " !w-64"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, region, use…"
              />
            </div>
          </div>
        </form>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : websites.length === 0 ? (
        <Card>
          <EmptyState
            title="No websites yet"
            note="Add one above, or clear the filters."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-zinc-400">
            {websites.length} website{websites.length === 1 ? "" : "s"}
          </p>
          {grouped.map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader
                title={WEBSITE_CATEGORY_LABELS[cat]}
                subtitle={`${items.length} site${items.length === 1 ? "" : "s"}`}
              />
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((w) => (
                  <div
                    key={w._id}
                    className="flex flex-col rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900">{w.name}</h3>
                      <button
                        type="button"
                        onClick={() => remove(w._id, w.name)}
                        className="text-xs text-zinc-300 transition-colors hover:text-rose-600"
                        title="Remove from list"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge tone="blue">{w.region || "National"}</Badge>
                      <Badge tone={w.access?.toLowerCase().startsWith("free") ? "green" : "amber"}>
                        {w.access || "Free"}
                      </Badge>
                      {(w.sports ?? []).slice(0, 3).map((s) => (
                        <Badge key={s} tone="zinc">
                          {s}
                        </Badge>
                      ))}
                    </div>

                    {w.description ? (
                      <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                        {w.description}
                      </p>
                    ) : null}
                    {w.useCase ? (
                      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                        <span className="font-medium text-zinc-600">Use it: </span>
                        {w.useCase}
                      </p>
                    ) : null}

                    <div className="mt-4 pt-1">
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={visitClass}
                      >
                        Visit
                        <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
