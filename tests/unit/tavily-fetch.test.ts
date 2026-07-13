import test from "node:test";
import assert from "node:assert/strict";

import { tavilyFetch } from "../../open-sse/executors/tavily-fetch.ts";

function mockTavily(body: Record<string, unknown>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const parsed = JSON.parse(init!.body as string) as Record<string, unknown>;
    // expose what the executor sent so assertions can inspect it
    (globalThis as Record<string, unknown>).__tavilyLastBody = parsed;
    assert.equal(init!.headers["Authorization"], "Bearer tavily-key");
    return new Response(
      JSON.stringify({
        results: [
          {
            url: "https://example.com",
            title: "Example",
            raw_content: "Example page content",
            links: ["https://example.com/about"],
          },
        ],
        failed_results: [],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  return originalFetch;
}

test("tavilyFetch uses basic extract_depth when depth is 0 (default)", async () => {
  const restore = mockTavily({});
  try {
    const result = await tavilyFetch({
      url: "https://example.com",
      format: "markdown",
      depth: 0,
      includeMetadata: true,
      credentials: { apiKey: "tavily-key" },
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.provider, "tavily-search");
    assert.equal(result.data?.content, "Example page content");
    const sent = (globalThis as Record<string, unknown>).__tavilyLastBody as Record<
      string,
      unknown
    >;
    assert.equal(sent.extract_depth, "basic");
  } finally {
    globalThis.fetch = restore;
  }
});

test("tavilyFetch uses advanced extract_depth when depth >= 1", async () => {
  const restore = mockTavily({});
  try {
    const result = await tavilyFetch({
      url: "https://example.com",
      format: "markdown",
      depth: 1,
      includeMetadata: false,
      credentials: { apiKey: "tavily-key" },
    });
    assert.equal(result.success, true);
    const sent = (globalThis as Record<string, unknown>).__tavilyLastBody as Record<
      string,
      unknown
    >;
    assert.equal(sent.extract_depth, "advanced");

    // depth 2 also maps to advanced
    await tavilyFetch({
      url: "https://example.com",
      format: "markdown",
      depth: 2,
      includeMetadata: false,
      credentials: { apiKey: "tavily-key" },
    });
    const sent2 = (globalThis as Record<string, unknown>).__tavilyLastBody as Record<
      string,
      unknown
    >;
    assert.equal(sent2.extract_depth, "advanced");
  } finally {
    globalThis.fetch = restore;
  }
});

test("tavilyFetch returns 401 when API key is missing", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const result = await tavilyFetch({
      url: "https://example.com",
      format: "markdown",
      depth: 0,
      includeMetadata: false,
      credentials: {},
    });
    assert.equal(result.success, false);
    assert.equal(result.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
