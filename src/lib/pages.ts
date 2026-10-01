import "server-only";

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_PAGE_CHARS = 12_000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z0-9#]+);/gi, (match, name: string) => {
      const key = name.toLowerCase();
      return NAMED_ENTITIES[key] ?? match;
    });
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function htmlToText(html: string): string {
  const bodyStart = html.search(/<body\b/i);
  const scoped = bodyStart >= 0 ? html.slice(bodyStart) : html;

  return stripTags(
    scoped
      .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Framework state blobs (Alpine `x-data="{...}"`, Vue `:prop="..."`) contain
      // `>` inside quoted attribute values, which breaks naive tag matching and
      // leaks JS source into the text. Drop them before stripping tags.
      .replace(/=\s*(["'])[^"']*[\{`][^"']*\1/g, '=""')
  );
}

function extractTitle(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? stripTags(match[1]) : "";
  return title || fallback;
}

/**
 * Fetches a public page and returns its readable text. Throws on failure so
 * callers can record which sources were unreachable instead of silently
 * extracting leads from nothing.
 */
export async function fetchPageText(url: string): Promise<FetchedPage> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml|text\/plain|application\/json/i.test(contentType)) {
    throw new Error(`unsupported content-type ${contentType.split(";")[0] || "unknown"}`);
  }

  const body = (await res.text()).slice(0, 400_000);
  const text = contentType.includes("json") ? body : htmlToText(body);
  if (text.length < 200) throw new Error("page had too little readable text");

  return {
    url,
    title: contentType.includes("json") ? url : extractTitle(body, url),
    text: text.slice(0, MAX_PAGE_CHARS),
  };
}

/** Fetches pages sequentially — small volume, and sequential avoids hammering. */
export async function fetchPages(
  urls: string[]
): Promise<{ pages: FetchedPage[]; failures: Array<{ url: string; reason: string }> }> {
  const pages: FetchedPage[] = [];
  const failures: Array<{ url: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const key = url.replace(/#.*$/, "").replace(/\/+$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      pages.push(await fetchPageText(url));
    } catch (err) {
      failures.push({
        url,
        reason: err instanceof Error ? err.message.slice(0, 120) : "unknown error",
      });
    }
  }

  return { pages, failures };
}