# src/middleware + src/lib/guardrails — Agent Knowledge Base

## OVERVIEW
Request-time safety layer. `middleware/promptInjectionGuard.ts` is the ONLY Next middleware (chat-completions-only guard). `lib/guardrails/` holds the reusable guardrail primitives (PII masking, prompt-injection detection, vision bridge) shared by handlers and the MCP server.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Chat prompt-injection gate | `middleware/promptInjectionGuard.ts` (route-group wired) |
| Guardrail registry | `lib/guardrails/registry.ts`, `index.ts` |
| PII masking | `lib/guardrails/piiMasker.ts` |
| Prompt-injection detector | `lib/guardrails/promptInjection.ts` |
| Vision bridge (image→text) | `visionBridge.ts`, `visionBridgeRouter.ts`, `visionBridgeHelpers.ts` |
| Base guardrail contract | `lib/guardrails/base.ts` |

## CONVENTIONS
- Guardrails are opt-in and fail-open. PII redaction is OFF by default (`PII_REDACTION_ENABLED` / `PII_RESPONSE_SANITIZATION`, both default `false`).
- `middleware/` has exactly ONE file — adding global behavior here is an anti-pattern; route-level enforcement belongs in `src/app/api/v1/`.

## ANTI-PATTERNS
- **Never** make PII redaction default-on — it breaks fail-open expectations and can drop legitimate content.
- **Never** add a second global middleware — the project is deliberately per-route.
- **Never** block the request on a guardrail failure silently — fail open and log.
