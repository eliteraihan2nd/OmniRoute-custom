# src/lib/db — Agent Knowledge Base

## OVERVIEW
Centralized SQLite (better-sqlite3, WAL) persistence. 96 domain modules + 115 idempotent migrations. Every read/write in the app funnels through here — no SQL belongs in routes.

## STRUCTURE
```
src/lib/db/
├── core.ts              # getDbInstance() singleton, SCHEMA_SQL (17 base tables), resolveWritableDataDir
├── localDb.ts           # RE-EXPORT ONLY — never add logic
├── migrations/          # 001_*.sql … 117_*.sql (applied by migrationRunner.ts)
├── providers.ts         # provider connections + nodes CRUD
├── models.ts            # custom models, synced available models, model-flag queries
├── combos.ts           # combo CRUD
├── apiKeys.ts          # API key management
├── secrets.ts          # SecretRow CRUD (uses getDbInstance from core)
├── compression.ts      # compression engine config + threshold CRUD
├── compressionCombos.ts# compression combo assignments
└── <entity>.ts         # one module per domain entity, same shape
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| New table/column | `migrations/<NNN>_*.sql` (new file) + new `src/lib/db/<entity>.ts` module |
| Change singleton / schema | `core.ts` (`getDbInstance` ~L930, `SCHEMA_SQL` ~L189) |
| Data dir override | `DATA_DIR` env → `resolveWritableDataDir` (`core.ts:86`); default `~/.omniroute/` |

## CONVENTIONS
- Module shape: named exports of functions that call `getDbInstance().prepare(...).run/get/all(...)`. Transaction helpers for multi-step writes.
- Migrations are idempotent SQL (`IF NOT EXISTS`, additive). Highest live number is `117_proxy_pool_rotation.sql`.

## ANTI-PATTERNS
- **Never** put raw SQL in `src/app/**` routes — go through a `src/lib/db` module.
- **Never** add logic to `localDb.ts` — re-export only.
- **Never** edit `SCHEMA_SQL` for new tables — add a migration file instead (keeps lineage history-free).
- **Never** `JSON.stringify` secrets — use `secrets.ts` + `resolvePublicCred()`.
