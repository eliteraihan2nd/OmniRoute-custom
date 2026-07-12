# open-sse/handlers · executors · translator — Agent Knowledge Base

## OVERVIEW
The request→response pipeline. `handlers/` are Next-route entry points; `executors/` are per-provider HTTP clients; `translator/` converts between OpenAI / Anthropic / Gemini wire formats. JS ESM (no TS types).

## STRUCTURE
```
handlers/   chatCore.ts (core entry) + chatCore/ dir, imageGeneration/, videoGeneration/,
             audioSpeech/Transcription/Translation, embeddings.ts, moderations.ts,
             responsesHandler.ts, ocr.ts, rerank.ts, search.ts, webFetch.ts, sseParser.ts
executors/   index.ts (getExecutor factory) + one file per provider (azure-openai.ts,
             bedrock.ts, vertex.ts, gemini-web.ts, claude-web.ts, opencode.ts, xai.ts…)
             + base/ (shared executor base), default/ (fallback), antigravity/, codex/, cursor/…
translator/  index.ts (translateRequest/translateResponse), formats.ts, registry.ts,
             request/ response/ (per-provider shape maps), image/, helpers/, webTools.ts
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add provider | `executors/<provider>.ts` + register in `executors/index.ts` + `open-sse/config/providerRegistry.ts` + `src/shared/constants/providers.ts` |
| Change chat flow | `handlers/chatCore.ts` → `services/combo.ts` |
| Format mismatch bug | `translator/request/` + `translator/response/` |
| New capability (web search, image) | `translator/webTools.ts`, `executors/<p>-web.ts` |

## CONVENTIONS
- `handlers/*` parse/validate the request, enforce policy, then call a service/executor. They do NOT hold provider logic.
- Every executor conforms to the base executor contract in `executors/base/`.
- `translateRequest` maps the inbound OpenAI-shaped body to the target provider's dialect; `translateResponse` does the reverse for SSE/JSON.

## ANTI-PATTERNS
- **Never** hardcode a provider endpoint in a handler — it belongs in the executor + registry.
- **Never** buffer a full stream in a handler — pipe SSE through.
- **Never** `as any` a translation shape — open-sse warns on type suppression.
