# src/lib/a2a — Agent Knowledge Base

## OVERVIEW
A2A v0.3 server — JSON-RPC agent-to-agent protocol. Manages task lifecycle, streaming, routing, and the skill catalog. Used by the dashboard and external agents.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Task lifecycle (create/get/cancel) | `taskManager.ts` |
| Task execution | `taskExecution.ts` |
| SSE + resumable streaming | `streaming.ts` |
| Routing decisions / logs | `routingLogger.ts` |
| Skill catalog | `skills/` (6 skills) |
| Protocol reference | `README.md` |

## CONVENTIONS
- JSON-RPC 2.0 envelope. `taskManager` is the central state holder; `taskExecution` runs the unit of work.
- Streaming is resumable — `streaming.ts` replays from the last acknowledged event id.

## ANTI-PATTERNS
- **Never** mutate task state outside `taskManager` — it owns the lifecycle.
- **Never** block a JSON-RPC handler on long work — hand off to `taskExecution` and stream progress.
- **Never** leak task payloads in logs — `routingLogger` logs metadata only.
