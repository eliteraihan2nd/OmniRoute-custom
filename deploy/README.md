# OmniRoute — Custom Deployment (pull-only GHCR image)

This repo builds the OmniRoute image **once** in GitHub Actions and publishes it
to GitHub Container Registry (GHCR). The deploy host (Dokploy or plain Docker)
**never builds** — it just pulls `ghcr.io/eliteraihan2nd/omniroute-custom:custom`.

## Files in this directory

| File | Purpose |
|---|---|
| `docker-compose.yml` | Pull-only stack: `omniroute` (GHCR image) + `redis`. No `build:` block. |
| `Dockerfile` | Multi-stage build (`base` → `builder` → `runner-base`). The image source. |
| `build-and-push.sh` | Optional: build + push the image **locally** instead of via CI. |

## How the image gets published

`.github/workflows/build-publish.yml` runs on every push to the `custom`
branch (and via manual `workflow_dispatch`). It:

1. Checks out the repo.
2. Builds `deploy/Dockerfile` (`target: runner-base`, `linux/amd64`).
3. Pushes `ghcr.io/eliteraihan2nd/omniroute-custom:custom` + `:sha-<sha>` using
   `GITHUB_TOKEN` (job has `packages: write`).
4. Flips the package **public** via the Packages REST API (see secrets below).

### Why the build-args are pinned
GitHub's hosted runner has ~7 GB RAM. The default build exceeds that and the
runner is OOM-killed. The workflow passes three knobs (documented in
`Dockerfile` lines 48–87):

```
OMNIROUTE_BUILD_JOBS=1        # serial native compile (better-sqlite3) — low RAM
OMNIROUTE_USE_TURBOPACK=0     # webpack single-threaded (no per-core Rust workers)
OMNIROUTE_BUILD_MEMORY_MB=4096 # V8 heap ceiling (build needs ~2.1 GB)
```

> Note: `OMNIROUTE_USE_TURBOPACK` must be an `ARG` in the Dockerfile or the
> build-arg is silently ignored. It is declared as `ARG`+`ENV` in `Dockerfile`.

## Required secrets

Set in **repo → Settings → Secrets and variables → Actions**:

| Secret | Scope | Used for |
|---|---|---|
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

Only `runner-base` is built by the workflow. If you need web-cookie providers
(`gemini-web`, `claude-web`, `claude-turnstile`), build `runner-web` instead:

```bash
docker build --target runner-web -f deploy/Dockerfile -t omniroute:web .
```

(or change `target:` in the workflow's build step).
