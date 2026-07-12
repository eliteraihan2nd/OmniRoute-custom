# src/shared/constants — Agent Knowledge Base

## OVERVIEW
Static, validated configuration catalogs: the 237-entry provider registry, routing strategy enum, and upstream HTTP header map. Imported project-wide. Fail-fast Zod validation runs at module load.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add/modify a provider | `providers.ts` (validated by `../validation/providerSchema`) |
| Change routing strategies | `routingStrategies.ts` (`ROUTING_STRATEGY_VALUES`, 17 entries) |
| Upstream HTTP headers | `upstreamHeaders.ts` |
| Per-route constant reuse | import via `@/shared/constants/*` |

## CONVENTIONS
- `providers.ts` re-exports service kinds from a leaf module (avoids a circular dep with `providerSchema`). The 237-entry array is validated on import — a bad entry crashes startup instead of leaking at runtime.
- `ROUTING_STRATEGY_VALUES` is a `const` tuple; `RoutingStrategyValue` is its derived union type. UI-only strategies are intentionally kept OUT of the tuple (see the comment near L27).

## ANTI-PATTERNS
- **Never** hand-edit the catalog with a string literal for a public OAuth id — use `resolvePublicCred()`.
- **Never** widen a tuple type loosely — extend the `const` array so the union stays derived.
- **Never** add a constant that isn't Zod-checked if it constrains runtime behavior.
