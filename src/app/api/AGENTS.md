# src/app/api — Agent Knowledge Base

## OVERVIEW
The Next.js 16 App Router API surface — 569 `route.ts` files under `src/app/api/v1/`. Thin: CORS → Zod body validation → optional API-key auth → policy enforce → delegate to `open-sse/handlers/`. No business logic, no global Next middleware.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| New endpoint | `src/app/api/v1/<group>/route.ts` (handler in `open-sse/handlers/`) |
| Catch-all relay | `src/app/api/v1/[...omnirouteCatchAll]/` |
| Shared route helpers | `src/app/api/v1/_helpers/`, `src/app/api/v1/_shared/` |
| Authz decision | `src/server/authz/` (classify → policies → enforce) |

## CONVENTIONS
- Each `route.ts` exports the HTTP methods it serves (`GET`/`POST`/…). Pattern is identical across groups.
- Auth is opt-in per route via `extractApiKey` / `isValidApiKey`; gated by `REQUIRE_API_KEY` env.
- Groups mirror provider capabilities: `chat/`, `completions/`, `responses/`, `images/`, `audio/`, `embeddings/`, `models/`, `providers/`, `combos/`, `quotas/`, `accounts/`, `management/`, `ws/`, `relay/`.

## ANTI-PATTERNS
- **Never** put raw SQL in a route — call `src/lib/db/*`.
- **Never** add a global middleware for auth — it's per-route by design.
- **Never** return raw `err.stack`/`err.message` — use `open-sse/utils/error.ts` builders.
