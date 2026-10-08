/**
 * regression test: requestQueueSettingsSchema must accept globalConcurrentRequests
 * (defined in ResilienceSettings/RequestQueueSettings + normalize layer, but absent
 * from the request-queue validator → 400 "Unrecognized key" when a client PATCHes it).
 *
 * https://github.com/eliteraihan2nd/OmniRoute-custom/issues/...
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  updateResilienceSchema,
  requestQueueSettingsSchema,
} from "../../../src/shared/validation/schemas/settings.ts";

test("requestQueueSettingsSchema accepts globalConcurrentRequests at schema level", () => {
  const result = requestQueueSettingsSchema.safeParse({
    autoEnableApiKeyProviders: true,
    requestsPerMinute: 120,
    minTimeBetweenRequestsMs: 4967,
    concurrentRequests: 8,
    globalConcurrentRequests: 0,
    maxWaitMs: 81876,
    executionMaxWaitMs: 600000,
    maxQueueDepth: 0,
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.globalConcurrentRequests, 0);
  }
});

test("requestQueueSettingsSchema rejects negative globalConcurrentRequests", () => {
  const result = requestQueueSettingsSchema.safeParse({ globalConcurrentRequests: -1 });
  assert.equal(result.success, false);
  if (!result.success) {
    // Zod error shape: use issues if errors is absent.
    const issues = result.error.issues ?? result.error.errors ?? [];
    assert.ok(
      issues.some((e) => e.path.some((p) => String(p) === "globalConcurrentRequests")),
      "negative globalConcurrentRequests should be rejected"
    );
  }
});

test("full updateResilienceSchema accepts requestQueue with globalConcurrentRequests", () => {
  const result = updateResilienceSchema.safeParse({
    requestQueue: {
      autoEnableApiKeyProviders: true,
      requestsPerMinute: 120,
      minTimeBetweenRequestsMs: 4967,
      concurrentRequests: 8,
      globalConcurrentRequests: 0,
      maxWaitMs: 81876,
      executionMaxWaitMs: 600000,
      maxQueueDepth: 0,
    },
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.requestQueue?.globalConcurrentRequests, 0);
  }
});
