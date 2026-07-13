/**
 * Exa Web Fetch Executor
 *
 * Fetches content from a URL using the Exa Contents API.
 * POST https://api.exa.ai/contents
 *
 * Reuses the existing "exa-search" provider connection/credentials — Exa issues
 * one universal API key valid across all endpoints (search, contents, websets).
 *
 * Free/paid tier depends on the Exa plan tied to the key.
 * Docs: https://exa.ai/docs/reference/get-contents
 */

import { sanitizeErrorMessage, buildErrorBody } from "../utils/error.ts";
import type { WebFetchResult, WebFetchFormat, WebFetchCredentials } from "../handlers/webFetch.ts";

const EXA_CONTENTS_URL = "https://api.exa.ai/contents";
const EXA_TIMEOUT_MS = 30_000;
const EXA_LINKS_COUNT = 10;

interface ExaFetchOptions {
  url: string;
  format: WebFetchFormat;
  includeMetadata: boolean;
  credentials: WebFetchCredentials;
}

interface ExaContentsResult {
  id?: string;
  url?: string;
  title?: string | null;
  author?: string | null;
  text?: string;
  highlights?: string[];
  summary?: string;
  extras?: { links?: unknown[] } | null;
}

/**
 * Execute an Exa contents request.
 * Exa Returns fresh or cached content for a list of URLs.
 */
export async function exaFetch(opts: ExaFetchOptions): Promise<WebFetchResult> {
  const { url, format, includeMetadata, credentials } = opts;

  if (!credentials.apiKey) {
    const body = buildErrorBody(401, "Exa API key required");
    return { success: false, status: 401, error: body.error.message };
  }

  if (format === "screenshot") {
    const body = buildErrorBody(400, "Exa contents does not support screenshot format");
    return { success: false, status: 400, error: body.error.message };
  }

  const requestBody: Record<string, unknown> = {
    urls: [url],
    text: format === "html" ? { includeHtmlTags: true } : true,
  };

  // `links` maps to Exa `extras.links`, which MUST be an integer URL count.
  // A boolean 400s ("expected number, received boolean") — verified live.
  if (format === "links") {
    requestBody.extras = { links: EXA_LINKS_COUNT };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXA_TIMEOUT_MS);

  try {
    const response = await fetch(EXA_CONTENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": credentials.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawError = await response.text().catch(() => `HTTP ${response.status}`);
      const msg = sanitizeErrorMessage(`Exa error ${response.status}: ${rawError}`);
      const body = buildErrorBody(response.status, msg);
      return { success: false, status: response.status, error: body.error.message };
    }

    const data = (await response.json()) as Record<string, unknown>;

    const results = data.results as ExaContentsResult[] | null;
    const firstResult = results?.[0] ?? {};

    const content = String(firstResult.text ?? firstResult.summary ?? "");

    const rawLinks = firstResult.extras?.links;
    const links: string[] = Array.isArray(rawLinks) ? rawLinks.map((l) => String(l)) : [];

    const metadata = includeMetadata
      ? {
          title: firstResult.title != null ? String(firstResult.title) : null,
          description: firstResult.summary != null ? String(firstResult.summary) : null,
        }
      : null;

    return {
      success: true,
      data: {
        provider: "exa-search",
        url,
        content,
        links,
        metadata,
        screenshot_url: null,
      },
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      const body = buildErrorBody(504, "Exa request timed out");
      return { success: false, status: 504, error: body.error.message };
    }
    const msg =
      err instanceof Error ? sanitizeErrorMessage(err.message) : sanitizeErrorMessage(String(err));
    const body = buildErrorBody(502, msg);
    return { success: false, status: 502, error: body.error.message };
  } finally {
    clearTimeout(timeoutId);
  }
}
