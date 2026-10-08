#!/bin/bash
# /staging — droplet preflight
# Usage: bash preflight.sh <droplet-host> [ssh-user] [prod-domain]
# Exits 0 if green, non-zero with diagnostic if red.

set -o pipefail

HOST="${1:?droplet host required}"
SSH_USER="${2:-root}"
PROD_DOMAIN="${3:-}"

# Try given user, fall back to root
ssh_try() {
  ssh -o ConnectTimeout=5 -o BatchMode=yes "${SSH_USER}@${HOST}" "$@" 2>/dev/null \
    || ssh -o ConnectTimeout=5 -o BatchMode=yes "root@${HOST}" "$@" 2>/dev/null \
    || ssh -o ConnectTimeout=5 -o BatchMode=yes "${HOST}" "$@" 2>/dev/null
}

echo "=== Preflight: ${HOST} ==="

# RAM
RAM_AVAIL=$(ssh_try "free -m | awk '/^Mem:/ {print \$7}'")
if [ -z "$RAM_AVAIL" ]; then
  echo "FAIL: cannot SSH to ${HOST} as ${SSH_USER} or root"
  exit 1
fi
echo "RAM available: ${RAM_AVAIL} MB"
[ "$RAM_AVAIL" -lt 1024 ] && echo "WARN: <1GB RAM available — staging may be tight"

# Disk
DISK_FREE=$(ssh_try "df -BG / | awk 'NR==2 {gsub(\"G\",\"\",\$4); print \$4}'")
echo "Disk free: ${DISK_FREE} GB"
[ "$DISK_FREE" -lt 3 ] && echo "WARN: <3GB disk free — clean old images before deploying"

# Healthy containers
HEALTHY=$(ssh_try "docker ps --format '{{.Names}} {{.Status}}' | grep -c healthy")
echo "Healthy containers: ${HEALTHY}"

# DNS
echo ""
echo "=== DNS resolution (run locally) ==="
if [ -n "$PROD_DOMAIN" ]; then
  for sub in "" "app." "api."; do
    h="staging.${sub}${PROD_DOMAIN}"
    ip=$(dig +short +time=2 +tries=1 "$h" 2>/dev/null | tail -1)
    if [ "$ip" = "$HOST" ]; then
      echo "  $h → $ip ✓"
    else
      echo "  $h → ${ip:-NO RECORD} (expected $HOST) ✗"
    fi
  done
else
  echo "  (skipped — pass prod-domain as 3rd arg to verify DNS)"
fi

echo ""
echo "=== Container names (for template substitution) ==="
ssh_try "docker ps --format '{{.Names}}' | grep -v coolify | sort"
