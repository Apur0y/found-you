import "server-only";

export function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

/**
 * Mongoose 9 types reject `$in` arrays built from mongoose.Types.ObjectId and
 * no longer export FilterQuery. IDs are validated before reaching this point.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function queryFilter(filter: Record<string, unknown>): any {
  return filter;
}

export function apiError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function normalizeUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}
