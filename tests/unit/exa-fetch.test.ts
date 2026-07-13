import test from "node:test";
import assert from "node:assert/strict";

import { exaFetch } from "../../open-sse/executors/exa-fetch.ts";

// ── exaFetch executor ──

test("exaFetch returns content from a successful Exa /contents response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init.headers["x-api-key"], "exa-key");
    assert.equal(JSON.parse(init.body).urls[0], "https://example.com");
    return new Response(
      JSON.stringify({
        results: [
          {
            id: "https://example.com",
            url: "https://example.com",
            title: "Example",
            text: "Example page content",
            extras: { links: ["https://example.com/about"] },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  try {
    const result = await exaFetch({
      url: "https://example.com",
      format: "markdown",
      includeMetadata: true,
      credentials: { apiKey: "exa-key" },
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.provider, "exa-search");
    assert.equal(result.data?.content, "Example page content");
    assert.equal(result.data?.links[0], "https://example.com/about");
    assert.equal(result.data?.metadata?.title, "Example");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exaFetch requests links via extras.links integer when format=links", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string);
    assert.deepEqual(body.extras, { links: 10 });
    return new Response(
      JSON.stringify({ results: [{ text: "x", extras: { links: ["https://a"] } }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  try {
    const result = await exaFetch({
      url: "https://example.com",
      format: "links",
      includeMetadata: false,
      credentials: { apiKey: "exa-key" },
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.links[0], "https://a");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exaFetch sends plain text:true for markdown format", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string);
    assert.equal(body.text, true);
    assert.equal(body.extras, undefined);
    return new Response(JSON.stringify({ results: [{ text: "plain markdown" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await exaFetch({
      url: "https://example.com",
      format: "markdown",
      includeMetadata: false,
      credentials: { apiKey: "exa-key" },
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.content, "plain markdown");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exaFetch sends text:{includeHtmlTags:true} for html format", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string);
    assert.deepEqual(body.text, { includeHtmlTags: true });
    return new Response(JSON.stringify({ results: [{ text: "<p>html</p>" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await exaFetch({
      url: "https://example.com",
      format: "html",
      includeMetadata: false,
      credentials: { apiKey: "exa-key" },
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.content, "<p>html</p>");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exaFetch rejects missing API key with 401", async () => {
  const result = await exaFetch({
    url: "https://example.com",
    format: "markdown",
    includeMetadata: false,
    credentials: {},
  });
  assert.equal(result.success, false);
  assert.equal(result.status, 401);
});

test("exaFetch rejects screenshot format with 400", async () => {
  const result = await exaFetch({
    url: "https://example.com",
    format: "screenshot",
    includeMetadata: false,
    credentials: { apiKey: "exa-key" },
  });
  assert.equal(result.success, false);
  assert.equal(result.status, 400);
});

test("exaFetch propagates non-2xx as failure with upstream status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("nope", { status: 429, headers: { "content-type": "text/plain" } });

  try {
    const result = await exaFetch({
      url: "https://example.com",
      format: "markdown",
      includeMetadata: false,
      credentials: { apiKey: "exa-key" },
    });
    assert.equal(result.success, false);
    assert.equal(result.status, 429);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
