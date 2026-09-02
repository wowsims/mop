#!/usr/bin/env bash
#
# Upgrade the MoP sim in place: pull latest source, rebuild the sim image, and
# restart the stack. The app is stateless, so there is nothing to back up.
#
# The old container keeps serving while the new image builds; downtime is just
# the few seconds of the container swap.

set -euo pipefail

cd "$(dirname "$0")"

# Check the sim directly on its loopback port (TLS is terminated upstream by
# the host's reverse proxy, which we don't touch during an app upgrade).
HEALTH_URL="http://127.0.0.1:18791/version"

echo "==> Pulling latest source..."
git pull --ff-only

echo "==> Building sim image..."
docker compose build sim

echo "==> Restarting stack..."
docker compose up -d

echo "==> Pruning dangling images..."
docker image prune -f

echo "==> Waiting for the sim to come back..."
for _ in $(seq 1 30); do
	if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
		echo "==> Healthy: $(curl -fsS "$HEALTH_URL")"
		exit 0
	fi
	sleep 2
done

echo "!! Sim did not respond at ${HEALTH_URL} within ~60s." >&2
echo "   Check logs:  docker compose logs --tail=50" >&2
exit 1
