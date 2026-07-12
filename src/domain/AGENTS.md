# src/domain — Agent Knowledge Base

## OVERVIEW
Policy engine (TypeScript). Resolves combos, applies cost rules, fallback, lockout, degradation, and tag-based routing. Independent of Next routes — pure decision logic consumed by `open-sse/services` and the API layer.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Combo resolution | `comboResolver.ts` |
| Pipeline orchestration | `pipeline.ts` |
| Cost rules | `costRules.ts` |
| Fallback policy | `fallbackPolicy.ts` |
| Lockout / degradation | `lockoutPolicy.ts`, `degradation.ts` |
| Tag-based routing | `tagRouter.ts` |
| Quota cache | `quotaCache.ts` |
| Model availability | `modelAvailability.ts` |
| Provider expiration | `providerExpiration.ts` |
| Responses shaping | `responses.ts`, `omnirouteResponseMeta.ts` |
| Migration helpers | `assessment/migration.ts` |
| Types / config audit | `types.ts`, `configAudit.ts` |

## CONVENTIONS
- Each policy file exports pure functions over domain types (`types.ts`). No I/O — persistence lives in `src/lib/db`.
- `policyEngine.ts` is the funnel; individual policy files are the leaves.

## ANTI-PATTERNS
- **Never** call a provider SDK or do HTTP here — return a decision, let the caller execute it.
- **Never** read `process.env` ad-hoc in a policy — receive config as args.
- **Never** suppress type errors (`as any`/`@ts-ignore` are hard errors in `src/`).
