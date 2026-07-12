# omniroute — Agent Knowledge Base

**Generated:** 2026-07-13 · **Commit:** 138c42ba1 · **Branch:** custom

Unified AI proxy/router — route any LLM through one endpoint. Multi-provider support
with **290 provider entries** (OpenAI, Anthropic, Gemini, DeepSeek, Groq, xAI, Mistral, Fireworks,
Cohere, NVIDIA, Cerebras, Pollinations, Puter, Cloudflare AI, HuggingFace, DeepInfra,
SambaNova, Meta Llama API, Moonshot AI, AI21 Labs, Databricks, Snowflake, and many more)
with **MCP Server** (104 tools), **A2A v0.3 Protocol**, and **Electron desktop app**.

> **Live counts (v3.8.49)**: providers 290 · MCP tools 104 · MCP scopes 30 · A2A skills 6 ·
> open-sse services 134 · routing strategies 17 · auto-combo scoring factors 12 ·
> DB modules 95 · DB migrations 110 · base tables 17 · search providers 11 ·
> i18n locales 42. **Refresh with `npm run check:docs-all`.**

> Live counts are computed by scripts, not memorized. Refresh before documenting: `npm run check:docs-all`. Current verified snapshot: providers 237 · MCP tools 94 · MCP scopes 30 · A2A skills 6 · open-sse services 142 (top-level) · routing strategies 17 · auto-combo scoring factors 12 · DB modules 96 · DB migrations 115 (highest `#117`) · base tables 17 · i18n locales 42.

## STRUCTURE

```
OmniRoute/
├── src/                      # App Router source (TS/TSX)
│   ├── app/api/v1/           # API routes → delegate to open-sse (569 route.ts files)
│   ├── app/(dashboard)/      # Dashboard UI (route groups, not folders)
│   ├── lib/db/               # SQLite persistence: 96 domain modules + migrations/
│   ├── lib/a2a/              # A2A v0.3 server (JSON-RPC, task manager)
│   ├── lib/                  # memory, skills, guardrails, cloudAgent, webhook, compliance
│   ├── domain/               # Policy engine (combo resolver, cost rules, fallback)
│   ├── shared/constants/     # providers.ts, routingStrategies.ts, upstreamHeaders.ts
│   ├── middleware/           # promptInjectionGuard
│   └── sse/                  # Legacy SSE service layer (pre-dates open-sse/)
├── open-sse/                 # Core streaming engine (JS, ESM workspace)
│   ├── handlers/             # chatCore, imageGeneration, embeddings, ...
│   ├── executors/            # per-provider request executors
│   ├── translator/           # format translation (OpenAI↔Anthropic↔Gemini)
│   ├── services/             # 142 routing/resilience/account services
│   ├── mcp-server/           # MCP server (stdio / SSE / Streamable HTTP)
│   ├── transformer/          # Responses API ↔ Chat Completions
│   └── config/               # providerRegistry.ts
├── electron/                 # Electron main + preload
├── docs/                     # Deep-dive guides (accuracy-enforced, see below)
├── db/migrations/            # (deprecated path) migrations now live in src/lib/db/migrations/
├── bin/                      # CLI entry
└── @omniroute/               # internal workspace packages (opencode-plugin, etc.)
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add/modify a provider | `src/shared/constants/providers.ts` + `open-sse/executors/` + `open-sse/config/providerRegistry.ts` |
| Change routing logic | `open-sse/services/combo.ts`, `src/domain/comboResolver.ts` |
| DB schema change | `src/lib/db/migrations/<NNN>_*.sql` + new `src/lib/db/*.ts` module |
| New API endpoint | `src/app/api/v1/.../route.ts` (handler in `open-sse/handlers/`) |
| MCP tool | `open-sse/mcp-server/` (schemas/tools.ts + a module set) |
| Authz decision | `src/server/authz/` (classify → policies → enforce) |
| Security behavior | `src/lib/guardrails/`, `open-sse/utils/publicCreds.ts`, `open-sse/utils/error.ts` |

## CODE MAP (centrality)

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `handleChatCore` | fn | `open-sse/handlers/chatCore.ts` | Core chat pipeline entry |
| `handleComboChat` / `resolveComboTargets` | fn | `open-sse/services/combo.ts` | Combo routing engine |
| `getExecutor` | fn | `open-sse/executors/index.ts` | Provider executor factory |
| `translateRequest` | fn | `open-sse/translator/index.ts` | API-format translation |
| `getDbInstance` | fn | `src/lib/db/core.ts` | SQLite singleton (WAL) |
| `createMcpServer` / `startMcpStdio` | fn | `open-sse/mcp-server/index.ts` | MCP server entry |
| `taskManager` | class | `src/lib/a2a/taskManager.ts` | A2A task lifecycle |

## CONVENTIONS (deviations from standard)

- **Two package roots**: `src/` is TypeScript; `open-sse/` + `electron/` are JavaScript ESM. Path aliases: `@/*` → `src/`, `@omniroute/open-sse` → `open-sse/`.
- **DB access is centralized**: all persistence goes through `src/lib/db/` modules. No raw SQL in routes. `localDb.ts` is re-export only — never add logic.
- **Migrations live in `src/lib/db/migrations/`** as idempotent SQL files (`001_*.sql`…`117_*.sql`), applied by `migrationRunner.ts`.
- **Zod validation at module load**: `src/shared/constants/providers.ts` validates the 237-entry catalog via `providerSchema` on import (fail-fast).
- **API route pattern**: `route.ts` → CORS preflight → Zod body validation → optional auth (`extractApiKey`/`isValidApiKey`) → policy enforce → delegate to `open-sse/handlers/`. No global Next middleware.
- **Formatting**: Prettier (2-space, double-quote, 100-char, es5 trailing commas) via lint-staged. ESLint security rules (`no-eval`, `no-implied-eval`, `no-new-func`) are errors everywhere.
- **Docs are accuracy-enforced** (see below). Do not state any API name, path, env var, or count without grepping first.

## ANTI-PATTERNS (THIS PROJECT)

- **Never** commit secrets/API keys. Use `resolvePublicCred()` for public OAuth identifiers — never string literals.
- **Never** put raw `err.stack`/`err.message` in responses — use `buildErrorBody()` / `sanitizeErrorMessage()` from `open-sse/utils/error.ts`.
- **Never** suppress type errors with `as any` / `@ts-ignore` / `@ts-expect-error` (warn in `open-sse/`+`tests/`, error elsewhere).
- **Never** make PII redaction default-on — opt-in via `PII_REDACTION_ENABLED` / `PII_RESPONSE_SANITIZATION` (both default `false`). Fail-open guardrails.
- **Never** close a contributor's PR after using their code — merge via GitHub for credit.
- **Never** document unverified specifics — see DOC ACCURACY below.

## DOC ACCURACY DISCIPLINE

`npm run check:fabricated-docs` extracts every route path/env/function/CLI from `docs/**` and verifies against source. Rules:

1. Any name/endpoint/env/CLI must `grep -rn "name" src/ open-sse/ bin/` → 0 hits means do not document.
2. Counts/line counts/sizes must be measured (`wc -l`, `ls | wc -l`), never from memory.
3. Code examples must be copy-pasted from real usage or run; link `file:line`, don't invent signatures.
4. Prefer citing real source over paraphrasing.

## FORK / UPSTREAM WORKFLOW

Mirror of `diegosouzapw/OmniRoute`. Fork-only operational changes (GHCR publish, deploy) stay off upstream PRs. For upstream PRs, branch from `upstream/main`. See `docs/architecture/cluster-decisions.md` and AGENTS.md fork rules. Build/publish flows to GHCR `ghcr.io/eliteraihan2nd/omniroute-custom:custom`.

## COMMANDS

```bash
npm run dev            # Next.js dev server
npm run build          # next build → .build/next → assembleStandalone → dist/
npm run typecheck:core # TS type-check (src)
npm run lint           # ESLint (prettier via lint-staged)
npm run check:docs-all # refresh live doc counts
node --import tsx/esm --test tests/unit/<file>.test.ts   # single unit test
npm run test:vitest    # MCP/autoCombo vitest suites
npm run test:e2e       # Playwright e2e
npm run electron:dev   # Electron app in dev
```

## NOTES

---

## Code Style Guidelines

### Formatting (Prettier — enforced via lint-staged)

2 spaces · semicolons required · double quotes (`"`) · 100 char width · es5 trailing commas.
Always run `prettier --write` on changed files.

### TypeScript

- **Target**: ES2022 · **Module**: `esnext` · **Resolution**: `bundler`
- `strict: false` — prefer explicit types, don't rely on inference
- Path aliases: `@/*` → `src/`, `@omniroute/open-sse` → `open-sse/`, `@omniroute/open-sse/*` → `open-sse/*`

### ESLint Rules

- **Security (error, everywhere)**: `no-eval`, `no-implied-eval`, `no-new-func`
- **Relaxed in `open-sse/` and `tests/`**: `@typescript-eslint/no-explicit-any` = warn
- React hooks rules and `@next/next/no-assign-module-variable` disabled in `open-sse/` and `tests/`

### Naming

| Element             | Convention                       | Example                              |
| ------------------- | -------------------------------- | ------------------------------------ |
| Files               | camelCase / kebab-case           | `chatCore.ts`, `tokenHealthCheck.ts` |
| React components    | PascalCase                       | `Dashboard.tsx`, `ProviderCard.tsx`  |
| Functions/variables | camelCase                        | `getHealth()`, `switchCombo()`       |
| Constants           | UPPER_SNAKE                      | `MAX_RETRIES`, `DEFAULT_TIMEOUT`     |
| Interfaces          | PascalCase (`I` prefix optional) | `ProviderConfig`                     |
| Enums               | PascalCase (members too)         | `LogLevel.Error`                     |

### Imports

- **Order**: external → internal (`@/`, `@omniroute/open-sse`) → relative (`./`, `../`)
- **No barrel imports** from `localDb.ts` — import from the specific `db/` module instead

### Error Handling

- try/catch with specific error types; always log with context (pino logger)
- Never silently swallow errors in SSE streams — use abort signals for cleanup
- Return proper HTTP status codes (4xx client, 5xx server)

### Security

- **NEVER** commit API keys, secrets, or credentials
- Validate all user inputs with Zod schemas
- Auth middleware required on all API routes
- Never log SQLite encryption keys
- Sanitize user content (dompurify for HTML)
- **Public upstream OAuth identifiers** (Gemini / Antigravity / Windsurf-style client_id/secret + Firebase Web keys extracted from public CLIs): use `resolvePublicCred()` from `open-sse/utils/publicCreds.ts`, **never** as string literals. Full pattern in `docs/security/PUBLIC_CREDS.md`.
- **Error responses** (HTTP / SSE / executor / MCP): use `buildErrorBody()` or `sanitizeErrorMessage()` from `open-sse/utils/error.ts`, **never** put raw `err.stack` / `err.message` in a Response body. Full pattern in `docs/security/ERROR_SANITIZATION.md`.
- **`exec()` / `spawn()` with runtime values**: pass via the `env` option, **never** string-interpolate paths/values into the script body. Reference: `src/mitm/cert/install.ts::updateNssDatabases`.
- Prefer secure-by-default libraries when available — see [tldrsec/awesome-secure-defaults](https://github.com/tldrsec/awesome-secure-defaults) for the curated list (Helmet.js, DOMPurify, ssrf-req-filter, safe-regex, Google Tink, etc.).

---

## Architecture

### Data Layer (`src/lib/db/`)

All persistence uses SQLite through **95 domain-specific modules** in `src/lib/db/`. Top modules:

- Core: `core.ts`, `migrationRunner.ts`, `encryption.ts`, `stateReset.ts`
- Providers / catalog: `providers.ts`, `models.ts`, `providerLimits.ts`, `compressionAnalytics.ts`
- Routing: `combos.ts`, `modelComboMappings.ts`, `domainState.ts`, `commandCodeAuth.ts`
- Auth: `apiKeys.ts`, `secrets.ts`, `registeredKeys.ts`, `sessionAccountAffinity.ts`
- Usage / billing: `quotaSnapshots.ts`, `creditBalance.ts`, `usage*.ts`, `compressionCacheStats.ts`
- Storage: `backup.ts`, `cleanup.ts`, `jsonMigration.ts`, `healthCheck.ts`, `databaseSettings.ts`
- Extension modules: `evals.ts`, `webhooks.ts`, `reasoningCache.ts`, `readCache.ts`, `tierConfig.ts`, `compressionCombos.ts`, `compressionScheduler.ts`, `batches.ts`, `files.ts`, `syncTokens.ts`, `proxies.ts`, `oneproxy.ts`, `upstreamProxy.ts`, `versionManager.ts`, `cliToolState.ts`, `prompts.ts`, `detailedLogs.ts`, `contextHandoffs.ts`, `compression.ts`, `stats.ts`

Live count: `ls src/lib/db/*.ts | wc -l` (currently 95). Drift detection: `npm run check:docs-counts`.
Schema migrations live in `db/migrations/` (**110 files** as of v3.8.43) and run via `migrationRunner.ts`.
`src/lib/localDb.ts` is a **re-export layer only** — never add logic there.

#### DB Internals

- **`core.ts`**: `getDbInstance()` returns a singleton `better-sqlite3` instance with WAL
  journaling. `SCHEMA_SQL` defines **17 base tables** (verify with `grep -c "CREATE TABLE" src/lib/db/core.ts` minus 1 for the bookkeeping `_omniroute_migrations` table). Helpers: `rowToCamel`, `encryptConnectionFields`.
- **`migrationRunner.ts`**: Applies versioned SQL files from `db/migrations/` inside transactions.
  Tracks applied migrations in `_omniroute_migrations` table.
- **Migrations**: 110 files (`001_initial_schema.sql` → `110_*.sql`).
  Each migration is idempotent and runs in a transaction. Live count: `ls src/lib/db/migrations/*.sql | wc -l`.
- **Domain modules** import `getDbInstance()` from `core.ts` for all CRUD operations.
  Each module owns a specific table/set of tables (e.g., `providers.ts` → `provider_connections`,
  `combos.ts` → `combos`). Encryption helpers protect sensitive fields at rest.
- **`localDb.ts`** re-exports all domain modules — consumers import from here for convenience.

### API Route Layer (`src/app/api/v1/`)

Next.js App Router routes — each follows a consistent pattern:

```
Route → CORS preflight → Body validation (Zod) → Optional auth (extractApiKey/isValidApiKey)
  → API key policy enforcement (enforceApiKeyPolicy) → Handler delegation (open-sse)
```

| Route                           | Handler                   | Notes                                                         |
| ------------------------------- | ------------------------- | ------------------------------------------------------------- |
| `chat/completions/route.ts`     | `handleChat()`            | + prompt injection guard (clones request)                     |
| `responses/route.ts`            | `handleChat()` (unified)  | Responses API format                                          |
| `embeddings/route.ts`           | `handleEmbedding()`       | Model listing + creation                                      |
| `images/generations/route.ts`   | `handleImageGeneration()` | Model listing + creation                                      |
| `audio/transcriptions/route.ts` | audio handler             | Multipart form data                                           |
| `audio/speech/route.ts`         | TTS handler               | Binary audio response                                         |
| `videos/generations/route.ts`   | video handler             | ComfyUI/SD WebUI                                              |
| `music/generations/route.ts`    | music handler             | ComfyUI workflows                                             |
| `moderations/route.ts`          | moderation handler        | Content safety                                                |
| `rerank/route.ts`               | rerank handler            | Document relevance                                            |
| `search/route.ts`               | search handler            | Web search (12 providers per `open-sse/handlers/search.ts:6`) |

**No global Next.js middleware file** — interception is route-specific. Auth is optional
(controlled by `REQUIRE_API_KEY` env). Prompt injection guard is unique to chat completions.

### Request Pipeline (`open-sse/`)

The `open-sse/` workspace is the core streaming engine. Full request flow:

```
Client Request
  → src/app/api/v1/.../route.ts (Next.js route)
    → open-sse/handlers/chatCore.ts::handleChatCore()
      → Semantic/signature cache check
      → Rate limit check (rateLimitManager)
      → Combo routing? → open-sse/services/combo.ts::handleComboChat()
        → resolveComboTargets() → ordered ResolvedComboTarget[]
        → For each target: handleSingleModel() (wraps chatCore)
      → translateRequest() (open-sse/translator/)
        → Convert source format (e.g., OpenAI) → target format (e.g., Claude)
      → getExecutor() → provider-specific executor instance
        → executor.execute() (BaseExecutor → DefaultExecutor or provider-specific)
          → buildUrl() + buildHeaders() + transformRequest()
          → fetch() to upstream provider
          → Retry logic with exponential backoff
      → Response translation back to client format
      → If Responses API: responsesTransformer.ts TransformStream
  → SSE stream or JSON response to client
```

**Handlers** (`open-sse/handlers/`): `chatCore.ts`, `responsesHandler.ts`, `embeddings.ts`,
`imageGeneration.ts`, `videoGeneration.ts`, `musicGeneration.ts`, `audioSpeech.ts`,
`audioTranscription.ts`, `moderations.ts`, `rerank.ts`, `search.ts`.

**Upstream headers**: merged after default auth; same header name replaces executor value.
**T5 intra-family fallback** recomputes headers using only the fallback model id.
Forbidden header names: `src/shared/constants/upstreamHeaders.ts` — keep sanitize,
Zod schemas, and unit tests aligned when editing.

### Provider Categories

- **Free** (2): Qoder AI, Kiro AI
- **OAuth** (13): Claude Code, Antigravity, Codex, GitHub Copilot, Cursor, Kimi Coding, Kilo Code, Cline, Kiro, Qoder, Gemini, Windsurf (v3.8), GitLab Duo (v3.8)
- **API Key** (120+): OpenAI, Anthropic, Gemini, DeepSeek, Groq, xAI, Mistral, Perplexity,
  Together, Fireworks, Cerebras, Cohere, NVIDIA, Nebius, SiliconFlow, Hyperbolic,
  HuggingFace, OpenRouter, Vertex AI, Cloudflare AI, Scaleway, AI/ML API, Pollinations,
  Puter, Longcat, Alibaba, Kimi, Minimax, Blackbox, Synthetic, Kilo Gateway,
  Z.AI, GLM, Deepgram, AssemblyAI, ElevenLabs, Cartesia, PlayHT, Inworld,
  NanoBanana, SD WebUI, ComfyUI, Ollama Cloud, Perplexity Search, Serper, Brave, Exa,
  Tavily, OpenCode Zen/Go, Bailian Coding Plan, DeepInfra, Vercel AI Gateway,
  Lambda AI, SambaNova, nScale, OVHcloud AI, Baseten, PublicAI, Moonshot AI,
  Meta Llama API, v0 (Vercel), Morph, Featherless AI, FriendliAI, LlamaGate,
  Galadriel, Weights & Biases Inference, Volcengine, AI21 Labs, Venice.ai,
  Codestral, Upstage, Maritalk, Xiaomi MiMo, Inference.net, NanoGPT, Predibase,
  Bytez, Heroku AI, Databricks, Snowflake Cortex, GigaChat (Sber), CrofAI,
  AgentRouter, ChatGPT Web, Baidu Qianfan, AWS Polly, RunwayML, GitLab Duo,
  Amazon Q, Empower, Poe, and many more.
- **Self-Hosted** (8+): LM Studio, vLLM, Lemonade, Llamafile, Triton, Docker Model Runner, Xinference, Oobabooga
- **Custom**: OpenAI-compatible (`openai-compatible-*`) and Anthropic-compatible (`anthropic-compatible-*`) prefixes

Providers are registered in `src/shared/constants/providers.ts` with Zod validation at module load.

### Executors (`open-sse/executors/`)

Provider-specific request executors: `base.ts`, `default.ts`, `cursor.ts`, `codex.ts`,
`antigravity.ts`, `github.ts`, `kiro.ts`, `qoder.ts`, `vertex.ts`,
`cloudflare-ai.ts`, `opencode.ts`, `pollinations.ts`, `puter.ts`.

#### Executor Internals

- **`base.ts`** (`BaseExecutor`): Abstract base with `buildUrl()`, `buildHeaders()`,
  `transformRequest()`, retry logic (exponential backoff), and `execute()`. Subclasses
  override URL/header/transform methods for provider-specific behavior.
- **`default.ts`** (`DefaultExecutor extends BaseExecutor`): Handles most OpenAI-compatible
  providers. Reads provider config from `providerRegistry.ts` to resolve base URL, auth
  header format, and request transformations.
- **`getExecutor()`** (`executors/index.ts`): Factory that returns the correct executor
  instance based on provider ID. Provider-specific executors (Cursor, Codex, Vertex, etc.)
  override only what differs from the default.

### Translator (`open-sse/translator/`)

Translates between API formats (OpenAI-format ↔ Anthropic, Gemini, etc.).
Includes request/response translators with helpers for image handling.

#### Translator Internals

- **`translator/index.ts`**: Exports `translateRequest()` and format constants. Called by
  `chatCore.ts` before executor dispatch.
- **Flow**: `translateRequest(body, sourceFormat, targetFormat)` → detects source format
  (OpenAI, Anthropic, Gemini) → applies the matching translator module → returns
  transformed body ready for the target provider.
- **Response translation** runs in reverse after upstream response, converting back to
  the client's expected format.

### Transformer (`open-sse/transformer/`)

`responsesTransformer.ts` — transforms Responses API format to/from Chat Completions format.

#### Transformer Internals

- **`createResponsesApiTransformStream()`**: Returns a `TransformStream` that converts
  Chat Completions SSE chunks (`data: {"choices":[...]}`) into Responses API SSE events
  (`response.output_item.added`, `response.output_text.delta`, etc.).
- Used when the client sends a Responses API request: the request is internally converted
  to Chat Completions format, dispatched normally, and the response is piped through this
  transform stream before reaching the client.

### Services (`open-sse/services/`)

134 service modules in `open-sse/services/` (top-level only; more including sub-dirs like `autoCombo/` and `compression/`). Refresh: `ls open-sse/services/*.ts | wc -l`. Key modules:
`combo.ts` (routing engine), `usage.ts`, `tokenRefresh.ts`,
`rateLimitManager.ts`, `accountFallback.ts`, `sessionManager.ts`, `wildcardRouter.ts`,
`autoCombo/`, `intentClassifier.ts`, `taskAwareRouter.ts`, `thinkingBudget.ts`,
`contextManager.ts`, `modelDeprecation.ts`, `modelFamilyFallback.ts`,
`emergencyFallback.ts`, `workflowFSM.ts`, `backgroundTaskDetector.ts`, `ipFilter.ts`,
`signatureCache.ts`, `volumeDetector.ts`, `contextHandoff.ts`, `compression/` (prompt
compression pipeline), and more.

#### Prompt Compression Pipeline (`compression/`)

Modular prompt compression that runs proactively before the existing reactive context manager.

- **`strategySelector.ts`**: Selects compression mode based on config, compression combo assignments,
  combo overrides, auto-trigger thresholds, and defaults. Priority: assigned compression combo >
  combo override > auto-trigger > default mode > off.
- **`lite.ts`**: 5 lite-mode techniques: `collapseWhitespace`, `dedupSystemPrompt`,
  `compressToolResults`, `removeRedundantContent`, `replaceImageUrls`. Target: 10-15% savings at
  <1ms latency.
- **`caveman.ts` / `cavemanRules.ts`**: Caveman-style semantic condensation backed by built-in
  rules plus file-loaded language packs under `compression/rules/`.
- **`engines/rtk/`**: Rule-based terminal/tool-output compression inspired by RTK patterns. Detects
  command output classes, applies JSON filter packs, deduplicates repeated lines, strips ANSI/code
  noise, and preserves errors/actionable context. The RTK JSON DSL supports replace,
  match-output short-circuit, strip/keep, per-line truncation, head/tail/max-line truncation,
  inline tests, trust-gated project/global custom filters, and optional redacted raw-output
  retention for authenticated recovery.
- **`engines/registry.ts`**: Registers engines (`caveman`, `rtk`) and powers stacked pipelines.
- **`stats.ts`**: Per-request compression stats tracking (original tokens, compressed tokens,
  savings %, techniques used, engine breakdown, compression combo id).
- **`types.ts`**: `CompressionMode` (off/lite/standard/aggressive/ultra/rtk/stacked),
  `CompressionConfig`, `CompressionStats`, `CompressionResult`.
- DB settings in `src/lib/db/compression.ts`, compression combos in
  `src/lib/db/compressionCombos.ts`, API routes under `src/app/api/settings/compression/`,
  `src/app/api/context/*`, and preview/language-pack routes under `src/app/api/compression/*`.

#### Combo Routing Engine (`combo.ts`)

- **`handleComboChat()`**: Entry point for combo-routed requests. Receives the combo config
  and iterates through targets in order until one succeeds or all fail.
- **`resolveComboTargets()`**: Expands a combo configuration into an ordered array of
  `ResolvedComboTarget[]`, each specifying provider + model + account + credentials.
- **Strategies** (17): priority, weighted, fill-first, round-robin, P2C, random, least-used, reset-aware (v3.8),
  reset-window, cost-optimized, strict-random, auto, lkgp, context-optimized, context-relay, headroom, fusion. Source: `ROUTING_STRATEGY_VALUES` in `src/shared/constants/routingStrategies.ts`.
- Each target calls **`handleSingleModel()`** which wraps `handleChatCore()` with
  per-target error handling and circuit breaker checks.

### Domain Layer (`src/domain/`)

Policy engine modules: `policyEngine.ts`, `comboResolver.ts`, `costRules.ts`,
`degradation.ts`, `fallbackPolicy.ts`, `lockoutPolicy.ts`, `modelAvailability.ts`,
`providerExpiration.ts`, `quotaCache.ts`, `responses.ts`, `configAudit.ts`.

### MCP Server (`open-sse/mcp-server/`)

**104 tools** total (`TOTAL_MCP_TOOL_COUNT`, `open-sse/mcp-server/server.ts`): a 42-entry base registry (`MCP_TOOLS` in `schemas/tools.ts`, bundling the core / cache / compression / 1proxy / advanced tools) **plus** standalone module sets — memory (3), skill (4), agentSkill (3), pool (6), gamification (8), plugin (8), notion (6), obsidian (22). 3 transports (stdio / SSE / Streamable HTTP). Scoped auth (31 scopes — see `OMNIROUTE_MCP_SCOPES`), Zod schemas. See [`docs/frameworks/MCP-SERVER.md`](docs/frameworks/MCP-SERVER.md).

**Core tools** (20): get_health, list_combos, get_combo_metrics, switch_combo, check_quota,
route_request, cost_report, list_models_catalog, web_search, simulate_route, set_budget_guard,
set_routing_strategy, set_resilience_profile, test_combo, get_provider_metrics,
best_combo_for_task, explain_route, get_session_snapshot, db_health_check, sync_pricing.

**Cache tools** (2): cache_stats, cache_flush.

**Compression tools** (5): compression_status, compression_configure, set_compression_engine,
list_compression_combos, compression_combo_stats.

**1proxy tools** (3): oneproxy_fetch, oneproxy_rotate, oneproxy_stats.

**Memory tools** (3): memory_search, memory_add, memory_clear.

**Skill tools** (4): skills_list, skills_enable, skills_execute, skills_executions.

**Agent-skill tools** (3): A2A skill discovery / invocation bridges.

**Gamification tools** (8): levels, badges, leaderboard, and community-federation queries.

**Plugin tools** (8): plugin marketplace listing, install/enable/disable, and runtime inspection.

**Notion tools** (6) + **Obsidian tools** (22): knowledge-base read/write integrations (the largest tool family — vault search, note CRUD, WebDAV-backed file ops).

#### MCP Internals

- **Tool registration**: Each tool is an object with `{ name, description, inputSchema: ZodSchema,
handler: async (args) => {...} }`. Zod validates inputs before the handler fires.
- **`createMcpServer()`** and **`startMcpStdio()`** exported from `mcp-server/index.ts`.
  `createMcpServer()` wires all tool sets; `startMcpStdio()` launches the stdio transport.
- **Transports**: stdio (CLI `omniroute --mcp`), SSE (`/api/mcp/sse`), Streamable HTTP
  (`/api/mcp/stream`). All share the same tool/scope engine.
- **Scopes** (30): Control which tool categories an API key can access. Enforcement happens
  before handler dispatch.
- **Audit**: Every tool invocation is logged to SQLite (`mcp_audit` table) with tool name,
  args, success/failure, API key attribution, and timestamp.

### A2A Server (`src/lib/a2a/`)

JSON-RPC 2.0, SSE streaming, Task Manager with TTL cleanup.
Agent Card at `/.well-known/agent.json`.
Skills (6): `smartRouting.ts`, `quotaManagement.ts`, `providerDiscovery.ts`, `costAnalysis.ts`, `healthReport.ts`, `listCapabilities.ts`.

#### A2A Internals

- **`taskManager.ts`**: State machine lifecycle for tasks: `submitted → working →
completed | failed | canceled`. Tasks have TTL and are cleaned up automatically.
- **JSON-RPC methods**: `message/send` (sync), `message/stream` (SSE), `tasks/get`,
  `tasks/cancel`. Dispatched via `POST /a2a`.
- **Skills**: Registered in a DB-backed registry. Each skill receives task context
  (messages, metadata) and returns structured results. `quotaManagement.ts` summarizes
  quota; `smartRouting.ts` recommends routing decisions.
- **Agent Card**: `/.well-known/agent.json` exposes capabilities, skills, and metadata
  for client auto-discovery.

### ACP Module (`src/lib/acp/`)

Agent Communication Protocol registry and manager.

### Memory System (`src/lib/memory/`)

Extraction, injection, retrieval, summarization, and store modules for persistent
conversational memory across sessions.

### Skills System (`src/lib/skills/`)

Extensible skill framework: registry, executor, sandbox, built-in skills,
custom skill support, interception, and injection.

#### Skills Internals

- **`registry.ts`**: DB-backed skill registration and discovery. Skills have metadata
  (name, description, version, enabled status) stored in SQLite.
- **`executor.ts`**: Execution engine with configurable timeout and retry logic.
  Receives skill name + input, looks up the skill, runs it in the sandbox.
- **`sandbox.ts`**: Isolation layer for custom (user-provided) skills. Limits resource
  access and execution time.
- **Built-in skills**: Ship with OmniRoute (e.g., quota management, routing). Located
  alongside the registry.
- **Interception/Injection**: Skills can intercept requests in the pipeline (pre/post
  processing) or inject context into prompts.

### Compliance (`src/lib/compliance/`)

Policy index for compliance enforcement.

### MITM Proxy (`src/mitm/`)

MITM proxy capability with certificate management, DNS handling, and target routing.

### Middleware (`src/middleware/`)

Request middleware including `promptInjectionGuard.ts`.

### Guardrails (`src/lib/guardrails/`)

Hot-reloadable guardrails framework (3 built-in: pii-masker, prompt-injection, vision-bridge). Fail-open. The `pii-masker` guardrail is registered and runs on every request, but its data-mutating logic is **opt-in** and OFF by default — it only redacts when `PII_REDACTION_ENABLED` (request) / `PII_RESPONSE_SANITIZATION` (response + streaming) are enabled (both `defaultValue: "false"`); with them off, payloads pass through untouched. A request can additionally opt OUT of any guardrail via header (`x-omniroute-disabled-guardrails`). Never make PII default-on (Hard Rule #20). See [`docs/security/GUARDRAILS.md`](docs/security/GUARDRAILS.md).

### Cloud Agents (`src/lib/cloudAgent/`)

`CloudAgentBase` abstract class + 3 agents (codex-cloud, devin, jules). Tasks persisted in `cloud_agent_tasks`; management auth required. See [`docs/frameworks/CLOUD_AGENT.md`](docs/frameworks/CLOUD_AGENT.md).

### Evals (`src/lib/evals/`)

Generic eval framework: `evalRunner.ts`, `runtime.ts`. Targets: combo / model / suite-default. See [`docs/frameworks/EVALS.md`](docs/frameworks/EVALS.md).

### Webhooks (`src/lib/webhookDispatcher.ts`)

HMAC-signed delivery, exponential backoff, auto-disable after 10 failures. 7 event types. See [`docs/frameworks/WEBHOOKS.md`](docs/frameworks/WEBHOOKS.md).

### Authorization Pipeline (`src/server/authz/`)

`classify → policies → enforce`. 3 route classes (PUBLIC / CLIENT_API / MANAGEMENT). See [`docs/architecture/AUTHZ_GUIDE.md`](docs/architecture/AUTHZ_GUIDE.md).

### Reasoning Replay (`src/lib/db/reasoningCache.ts` + `open-sse/services/reasoningCache.ts`)

Hybrid in-memory + SQLite cache for `reasoning_content`. Re-injects on multi-turn for strict providers (DeepSeek V4, Kimi K2, Qwen-Thinking, GLM, xiaomi-mimo). See [`docs/routing/REASONING_REPLAY.md`](docs/routing/REASONING_REPLAY.md).

### Tunnels (`src/lib/{cloudflaredTunnel,ngrokTunnel}.ts` + `src/app/api/tunnels/`)

Cloudflare Quick/Named, ngrok, Tailscale Funnel. See [`docs/ops/TUNNELS_GUIDE.md`](docs/ops/TUNNELS_GUIDE.md).

### Adding a New Provider

1. Register in `src/shared/constants/providers.ts`
2. Add executor in `open-sse/executors/` (if custom logic needed)
3. Add translator in `open-sse/translator/` (if non-OpenAI format)
4. Add OAuth config in `src/lib/oauth/constants/oauth.ts` (if OAuth-based)
5. Add models in `open-sse/config/providerRegistry.ts`

---

## Subdirectory AGENTS.md Files

- **[`src/lib/db/AGENTS.md`](src/lib/db/AGENTS.md)** — SQLite persistence, domain modules, migrations
- **[`open-sse/services/AGENTS.md`](open-sse/services/AGENTS.md)** — Routing engine, combo resolution, strategy selection

## Reference Documentation (docs/)

For any non-trivial change, read the matching deep-dive first:

| Area                                       | Doc                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Repo navigation                            | [`docs/architecture/REPOSITORY_MAP.md`](docs/architecture/REPOSITORY_MAP.md)                                    |
| Architecture                               | [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)                                        |
| Engineering reference                      | [`docs/architecture/CODEBASE_DOCUMENTATION.md`](docs/architecture/CODEBASE_DOCUMENTATION.md)                    |
| Auto-Combo (12-factor, 18 strategies)      | [`docs/routing/AUTO-COMBO.md`](docs/routing/AUTO-COMBO.md)                                                      |
| Resilience (3 layers)                      | [`docs/architecture/RESILIENCE_GUIDE.md`](docs/architecture/RESILIENCE_GUIDE.md)                                |
| Skills                                     | [`docs/frameworks/SKILLS.md`](docs/frameworks/SKILLS.md)                                                        |
| Memory                                     | [`docs/frameworks/MEMORY.md`](docs/frameworks/MEMORY.md)                                                        |
| Cloud agents                               | [`docs/frameworks/CLOUD_AGENT.md`](docs/frameworks/CLOUD_AGENT.md)                                              |
| Guardrails                                 | [`docs/security/GUARDRAILS.md`](docs/security/GUARDRAILS.md)                                                    |
| Evals                                      | [`docs/frameworks/EVALS.md`](docs/frameworks/EVALS.md)                                                          |
| Compliance                                 | [`docs/security/COMPLIANCE.md`](docs/security/COMPLIANCE.md)                                                    |
| Webhooks                                   | [`docs/frameworks/WEBHOOKS.md`](docs/frameworks/WEBHOOKS.md)                                                    |
| Authz                                      | [`docs/architecture/AUTHZ_GUIDE.md`](docs/architecture/AUTHZ_GUIDE.md)                                          |
| Stealth                                    | [`docs/security/STEALTH_GUIDE.md`](docs/security/STEALTH_GUIDE.md)                                              |
| Reasoning replay                           | [`docs/routing/REASONING_REPLAY.md`](docs/routing/REASONING_REPLAY.md)                                          |
| Agent protocols (A2A / ACP / Cloud)        | [`docs/frameworks/AGENT_PROTOCOLS_GUIDE.md`](docs/frameworks/AGENT_PROTOCOLS_GUIDE.md)                          |
| MCP server                                 | [`docs/frameworks/MCP-SERVER.md`](docs/frameworks/MCP-SERVER.md)                                                |
| A2A server                                 | [`docs/frameworks/A2A-SERVER.md`](docs/frameworks/A2A-SERVER.md)                                                |
| API reference                              | [`docs/reference/API_REFERENCE.md`](docs/reference/API_REFERENCE.md) + [`docs/openapi.yaml`](docs/openapi.yaml) |
| Provider catalog (auto-generated)          | [`docs/reference/PROVIDER_REFERENCE.md`](docs/reference/PROVIDER_REFERENCE.md)                                  |
| Tunnels                                    | [`docs/ops/TUNNELS_GUIDE.md`](docs/ops/TUNNELS_GUIDE.md)                                                        |
| Electron desktop                           | [`docs/guides/ELECTRON_GUIDE.md`](docs/guides/ELECTRON_GUIDE.md)                                                |
| Release flow                               | [`docs/ops/RELEASE_CHECKLIST.md`](docs/ops/RELEASE_CHECKLIST.md)                                                |
| Quality gates (35 gates, allowlist policy) | [`docs/architecture/QUALITY_GATES.md`](docs/architecture/QUALITY_GATES.md)                                      |
| Cluster opt-in profiles (memory, bifrost)  | [`docs/architecture/cluster-decisions.md`](docs/architecture/cluster-decisions.md)                              |

---

## NOTES

- `src/sse/` is a legacy service layer predating `open-sse/`. Prefer `open-sse/` for new work; don't migrate blindly.
- `db/migrations/` at repo root is a stale path — the live migrations are under `src/lib/db/migrations/`.
- Deployment config in `docker-compose.yml` + `Dockerfile`; VPS rsyncs `dist/` into the image's app dir.
- `REQUIRE_API_KEY` env toggles route auth. Prompt-injection guard is unique to chat completions.
