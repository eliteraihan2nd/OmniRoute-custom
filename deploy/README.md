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

`.github/workflows/build-publish.yml` runs on every push to the `custom`
branch (and via manual `workflow_dispatch`). It:

1. Checks out the repo.
2. Builds `deploy/Dockerfile` (`target: runner-base`, `linux/amd64`).
3. Pushes `ghcr.io/eliteraihan2nd/omniroute-custom:custom` + `:sha-<sha>` using
   `GITHUB_TOKEN` (job has `packages: write`).
4. Flips the package **public** via the Packages REST API (see secrets below).

### Build memory knobs

The workflow passes **no** `build-args`. `Dockerfile` now carries upstream
v3.8.51's defaults, which are already tuned for a 16 GB runner:

```
OMNIROUTE_USE_TURBOPACK=0      # webpack, no per-core Rust compile workers
OMNIROUTE_BUILD_MEMORY_MB=6144 # V8 heap ceiling for the production pass
OMNIROUTE_BUILD_WORKERS=2      # CIRCLE_NODE_TOTAL=2 → 1 page-data worker
```

The worker cap is the one that matters. Upstream measured real per-process RSS
at ~4.5 GB (issue #7518) — independent of the `NODE_OPTIONS` ceiling, because it
applies to the parent process too. Every page-data worker inherits that
ceiling, so without the cap Next spawns `os.cpus().length - 1` workers and the
host is exhausted: 1 worker = 2 processes × 4.5 GB = 9 GB fits a 16 GB runner.

> Note: `OMNIROUTE_USE_TURBOPACK` must be an `ARG` in the Dockerfile or the
> build-arg is silently ignored. It is declared as `ARG`+`ENV` in `Dockerfile`.
>
> Never put `#` comment lines inside a workflow `build-args:` block — Docker
> passes each line through as a literal `--build-arg` value.

## Required secrets

Set in **repo → Settings → Secrets and variables → Actions**:

| Secret    | Scope                                  | Used for                                                                                         |
| --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `PKG_PAT` | classic PAT, **`write:packages`** only | Flips the GHCR package to public after push. Fine-grained PATs do NOT work for the Packages API. |

The push itself uses `GITHUB_TOKEN` (auto-provided, no secret needed).

> If `PKG_PAT` is unset, the visibility step **skips cleanly** and the package
> stays private. The image is still published; it just won't be world-pullable.
> (Once public, it stays public on later pushes — the step is idempotent.)

## Deploying on Dokploy (Compose mode)

1. **Project type:** Docker Compose.
2. **Compose file path:** `deploy/docker-compose.yml` (not repo root).
3. **Git:** SSH deploy key already registered (for source clone only).
4. **Registry (GHCR):** Dokploy → Core → Registry → GHCR:
   - Registry URL: `ghcr.io`
   - Username: `eliteraihan2nd`
   - Password: a **classic PAT with `read:packages`** (pull-only; separate from
     the `write:packages` `PKG_PAT` used by CI). This writes `~/.docker/config.json`
     so the compose pull authenticates.
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
