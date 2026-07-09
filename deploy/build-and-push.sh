#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
#  Local build + push of the custom OmniRoute image to GHCR.
#
#  Use this instead of (or in addition to) the GitHub Actions workflow when
#  you want to build on this machine and publish directly. Requires:
#    - docker buildx
#    - `docker login ghcr.io` done once (with a classic PAT that has
#      write:packages, or your own account token)
#
#  Usage:
#    ./deploy/build-and-push.sh            # pushes :custom + :sha-<gitsha>
#    IMAGE=ghcr.io/eliteraihan2nd/omniroute-custom:custom ./deploy/build-and-push.sh
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/eliteraihan2nd/omniroute-custom:custom}"
SHORT_SHA="$(git rev-parse --short HEAD)"

echo "Building ${IMAGE} (and :sha-${SHORT_SHA}) from deploy/Dockerfile (runner-base)…"

docker buildx build \
  --file deploy/Dockerfile \
  --target runner-base \
  --platform linux/amd64 \
  --tag "${IMAGE}" \
  --tag "ghcr.io/eliteraihan2nd/omniroute-custom:sha-${SHORT_SHA}" \
  --push \
  .

echo "Pushed:"
echo "  ${IMAGE}"
echo "  ghcr.io/eliteraihan2nd/omniroute-custom:sha-${SHORT_SHA}"
