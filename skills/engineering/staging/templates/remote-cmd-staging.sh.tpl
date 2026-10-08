#!/bin/bash
# ${PROJECT} — run a command on the staging droplet
# Mirror of scripts/remote-cmd.sh (prod), but targets the staging droplet.
#
# Usage:
#   ./scripts/remote-cmd-staging.sh "docker compose -f docker/docker-compose.staging.yml ps"
#   ./scripts/remote-cmd-staging.sh "bash scripts/deploy-staging.sh --migrate"

DEPLOY_SERVER="${SSH_USER}@${STAGING_DROPLET_IP}"
REMOTE_DIR="/opt/${PROJECT}"
CMD="$*"

if [ -z "$CMD" ]; then
  echo "Usage: $0 <command>"
  exit 1
fi

if [ -d "$REMOTE_DIR" ] && [ "$(hostname)" != "$(hostname -s).local" ]; then
  # Already on the staging server
  cd "$REMOTE_DIR" && eval "$CMD"
else
  # Run via SSH
  ssh -t "$DEPLOY_SERVER" "export PATH=\"/root/.local/share/pnpm:\$PATH\" && cd $REMOTE_DIR && $CMD"
fi
