# open-sse/mcp-server — Agent Knowledge Base

## OVERVIEW
MCP server (94 tools, 30 scopes) speaking stdio / SSE / Streamable HTTP. Exposes the whole OmniRoute surface (model ops, memory, skills, pools, gamification, plugins, Notion, Obsidian, GitHub) to MCP clients. JS ESM.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Tool registry / count | `server.ts` (`TOTAL_MCP_TOOL_COUNT` ~L101), `catalog.ts` (toolSearch) |
| Add a tool | `tools/` (schemas in `schemas/`) + register in `server.ts` |
| Scope enforcement | `scopeEnforcement.ts` |
| HTTP transport | `httpTransport.ts`, `httpAuthContext.ts` |
| Tool description compression | `descriptionCompressor.ts` (+ `compression` kv config) |
| Caller identity | `mcpCallerIdentity.ts` |
| Audit / heartbeat | `audit.ts`, `runtimeHeartbeat.ts` |
| Tests | `__tests__/` |

## CONVENTIONS
- `TOTAL_MCP_TOOL_COUNT` = `MCP_TOOLS` + memory + skill + agentSkill + githubSkill + pool + gamification + plugin + notion + obsidian tools. Keep it in sync when adding a toolset.
- Description compression is ON by default (`mcpDescriptionCompressionEnabled` kv, default true); accessibility config is clamped via `clampMcpAccessibilityConfig`.
- Tool search (catalog) aggregates the same collections referenced by the count.

## ANTI-PATTERNS
- **Never** add a tool without a scope mapping in `scopeEnforcement.ts`.
- **Never** return unsanitized error text — route through `open-sse/utils/error.ts`.
- **Never** `as any` the tool schema — open-sse warns on type suppression.
