import test from "node:test";
import assert from "node:assert/strict";

const { handleSearch } = await import("../../open-sse/handlers/search.ts");

// Helper: build a Serper-shaped response for a given set of URLs (one page).
function serperPage(urls: string[], page: number) {
  return {
    organic: urls.map((url, i) => ({
      title: `Result ${page}-${i}`,
      link: url,
      snippet: `snippet for ${url}`,
    })),
  };
}

function makeFetch(pages: Array<string[]>) {
  // pages[k] = urls returned for page k+1
  return async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) || "{}");
    const page = typeof body.page === "number" ? body.page : 1;
    const idx = page - 1;
    assert.equal(body.autocorrect, false, "Serper requests must disable autocorrect");
    assert.equal(body.num, 10, "Serper requests must ask for num=10 per page");
    const urls = pages[idx] ?? [];
    return new Response(JSON.stringify(serperPage(urls, page)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

const baseOpts = {
  query: "test query",
  provider: "serper-search",
  maxResults: 25,
  searchType: "web",
  credentials: { apiKey: "serper-key" },
};

test("serper returns up to maxResults by paginating (3 pages for 25 results)", async () => {
  const originalFetch = globalThis.fetch;
  const pages = [
    Array.from({ length: 10 }, (_, i) => `https://a.com/${i}`),
    Array.from({ length: 10 }, (_, i) => `https://b.com/${i}`),
    Array.from({ length: 10 }, (_, i) => `https://c.com/${i}`),
  ];
  globalThis.fetch = makeFetch(pages) as any;

  try {
    const res = await handleSearch(baseOpts as any);
    assert.equal(res.success, true);
    assert.equal(res.data?.provider, "serper-search");
    assert.equal(res.data?.results.length, 25, "should merge 3 pages → 25 results");
    assert.equal(res.data?.usage.queries_used, 3, "3 pages fetched");
    assert.equal(res.data?.usage.search_cost_usd, 0.003, "cost = 0.001 × 3 pages");
    // page 1 urls first, then page 2, then page 3
    assert.equal(res.data?.results[0].url, "https://a.com/0");
    assert.equal(res.data?.results[10].url, "https://b.com/0");
    assert.equal(res.data?.results[20].url, "https://c.com/0");
    // merged ordinals must exceed 10 (regression: pages used to reset to 1..10)
    assert.equal(res.data?.results[10].position, 11, "position re-numbered by merged index");
    assert.equal(
      res.data?.results[10].citation.rank,
      11,
      "citation.rank re-numbered by merged index"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serper caps results at maxResults even when last page overflows", async () => {
  const originalFetch = globalThis.fetch;
  const pages = [
    Array.from({ length: 10 }, (_, i) => `https://a.com/${i}`),
    Array.from({ length: 10 }, (_, i) => `https://b.com/${i}`),
    Array.from({ length: 10 }, (_, i) => `https://c.com/${i}`), // only need 5 of these
  ];
  globalThis.fetch = makeFetch(pages) as any;

  try {
    const res = await handleSearch({ ...baseOpts, maxResults: 15 } as any);
    assert.equal(res.success, true);
    assert.equal(res.data?.results.length, 15, "capped to 15 (10 + 5)");
    assert.equal(res.data?.usage.queries_used, 2, "only 2 pages needed for 15");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serper dedupes overlapping urls across pages", async () => {
  const originalFetch = globalThis.fetch;
  const pages = [
    Array.from({ length: 10 }, (_, i) => `https://a.com/${i}`),
    [
      "https://a.com/0",
      "https://a.com/1",
      ...Array.from({ length: 8 }, (_, i) => `https://b.com/${i}`),
    ],
  ];
  globalThis.fetch = makeFetch(pages) as any;

  try {
    const res = await handleSearch({ ...baseOpts, maxResults: 20 } as any);
    assert.equal(res.success, true);
    assert.equal(res.data?.results.length, 18, "10 + 8 unique (2 dupes dropped)");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serper returns partial results when a later page 429s", async () => {
  const originalFetch = globalThis.fetch;
  const pages = [
    Array.from({ length: 10 }, (_, i) => `https://a.com/${i}`),
    Array.from({ length: 10 }, (_, i) => `https://b.com/${i}`),
    Array.from({ length: 10 }, (_, i) => `https://c.com/${i}`),
  ];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) || "{}");
    const page = typeof body.page === "number" ? body.page : 1;
    if (page === 2) {
      return new Response("rate limited", { status: 429 });
    }
    return new Response(JSON.stringify(serperPage(pages[page - 1], page)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  try {
    const res = await handleSearch(baseOpts as any);
    assert.equal(res.success, true, "still success with partial results");
    assert.equal(res.data?.results.length, 10, "only page 1 collected");
    assert.equal(res.data?.usage.queries_used, 1, "only 1 page fetched");
    assert.equal(res.data?.errors.length, 1, "page 2 error recorded");
    assert.equal(res.data?.errors[0].code, "429");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serper with maxResults <= 10 uses a single page", async () => {
  const originalFetch = globalThis.fetch;
  const pages = [Array.from({ length: 8 }, (_, i) => `https://a.com/${i}`)]; // only 1 page available
  let calls = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    const body = JSON.parse((init?.body as string) || "{}");
    assert.equal(body.page, undefined, "no page param for single-page request");
    return new Response(JSON.stringify(serperPage(pages[0], 1)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;

  try {
    const res = await handleSearch({ ...baseOpts, maxResults: 8 } as any);
    assert.equal(res.success, true);
    assert.equal(res.data?.results.length, 8);
    assert.equal(calls, 1, "exactly one fetch for <=10 results");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
