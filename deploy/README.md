# OmniRoute — Custom Deployment (pull-only GHCR image)

This repo builds the OmniRoute image **once** in GitHub Actions and publishes it
to GitHub Container Registry (GHCR). The deploy host (Dokploy or plain Docker)
**never builds** — it just pulls `ghcr.io/eliteraihan2nd/omniroute-custom:custom`.

## Files in this directory

| File                 | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `docker-compose.yml` | Pull-only stack: `omniroute` (GHCR image) + `redis`. No `build:` block.   |
| `Dockerfile`         | Multi-stage build (`base` → `builder` → `runner-base`). The image source. |
| `build-and-push.sh`  | Optional: build + push the image **locally** instead of via CI.           |

## How the image gets published

**A push to `custom` builds nothing by itself.** Since upstream v3.8.51
(#11946), `Build App` is `workflow_dispatch`-only — the hosted runner can no
longer build this tree on every push. So the chain is:

1. Dispatch **Build App** by hand (Actions → "Build App" → Run workflow,
   branch `custom`).
2. On green, `build-publish.yml` fires automatically via `workflow_run`
   (it watches "Build App" completions on `custom`).
3. It builds `deploy/Dockerfile` (`target: runner-base`, `linux/amd64`)
   and pushes `ghcr.io/eliteraihan2nd/omniroute-custom:custom` +
   `:sha-<sha>` using `GITHUB_TOKEN` (job has `packages: write`).
4. Package visibility stays as set once in the GitHub UI (see secrets below).

You can also fire step 2 directly via its `workflow_dispatch` (uses the
`Build App` head SHA when chained, your current HEAD when dispatched).

### Build memory knobs

The workflow pins two build-args, mirroring upstream v3.8.51's own
`docker-publish.yml` (which publishes with 12288, NOT the Dockerfile's
6144 default):

```
OMNIROUTE_USE_TURBOPACK=0      # webpack, no per-core Rust compile workers
OMNIROUTE_BUILD_MEMORY_MB=12288 # V8 heap ceiling for the production pass
```

The heap ceiling is the one that matters. The webpack optimization
pass ("Creating an optimized production build") peaks at ~10.3 GB RSS
on this tree (measured locally, 2026-09-30). At the 6144 default the
build dies ~4.5 min in with "FATAL ERROR: Ineffective mark-compacts
near heap limit" (runs 36689547185, 36694208927). 12288 leaves room
for that peak plus buildkit/page-cache on the 15.6 GB runner.

`OMNIROUTE_BUILD_WORKERS` is left at its Dockerfile default of 2
(CIRCLE_NODE_TOTAL=2 → 1 page-data worker); every page-data worker
inherits the heap ceiling per-process.

> Never put `#` comment lines inside a workflow `build-args:` block —
> Docker passes each line through as a literal `--build-arg` value.

## Secrets

**None.** The push uses `GITHUB_TOKEN` (auto-provided; the build
job grants itself `packages: write`).

Package visibility is set **once, manually** in the GitHub UI:
repo → Packages → `omniroute-custom` → Settings → Change
visibility → **Public**. The Packages REST/GraphQL visibility
endpoints are not served for user-namespaced container packages
(they 404 even for the owner with `write:packages`), so there is
no CI step that can flip it — and once public it stays public
across all later pushes.

(The old `PKG_PAT` auto-flip secret was removed for this reason.)

## Deploying on Dokploy (Compose mode)

1. **Project type:** Docker Compose.
2. **Compose file path:** `deploy/docker-compose.yml` (not repo root).
3. **Git:** SSH deploy key already registered (for source clone only).
4. **Registry (GHCR):** Dokploy → Core → Registry → GHCR:
   - Registry URL: `ghcr.io`
   - Username: `eliteraihan2nd`
   - Password: a **classic PAT with `read:packages`**
     (pull-only). This writes `~/.docker/config.json`
     so the compose pull authenticates. Optional — the
     package is public, so pulls work without auth.
   - Click **Test**.
5. **Env:** Manage all env vars in the **Dokploy UI**. Dokploy overwrites the
   repo's `deploy/.env` on deploy, so don't rely on that file for secrets.
6. **Deploy manually** after each push (no auto-redeploy webhook is wired).

> Public package: the GHCR Registry credential above becomes optional — public
> GHCR images pull without auth. Keep it for safety.

## Local deploy (no Dokploy)

```bash
docker login ghcr.io            # once
cd deploy
docker compose pull
docker compose up -d
```

## Local build + push (alternative to CI)

```bash
./deploy/build-and-push.sh
# builds deploy/Dockerfile (runner-base, linux/amd64) and pushes to GHCR
```

Requires `docker buildx` and a `docker login ghcr.io` session with push rights.

## Image flavors

Only `runner-base` exists in `deploy/Dockerfile`, and it is the only stage the
workflow builds. The upstream `runner-web` / `runner-cli` stages were dropped
here on purpose — this mirror deploys a single lean image (plus the Qoder CLI).

If you later need web-cookie providers (`gemini-web`, `claude-web`,
`claude-turnstile`) or the bundled CLI tools, copy those stages from the
upstream root `Dockerfile` into `deploy/Dockerfile` and add a second
`target:` to the workflow's build step.
