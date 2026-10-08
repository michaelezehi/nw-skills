#!/usr/bin/env bash
# setup-do-firewall.sh — create/update a DigitalOcean Cloud Firewall for a droplet.
#
# Why this exists, given ufw already runs on the droplet:
#   ufw filters INSIDE the droplet — packets have already crossed the NIC and
#   consumed CPU. A DO Cloud Firewall filters at DigitalOcean's network layer,
#   upstream of the droplet, so denied traffic never arrives. It also survives
#   `scripts/setup-droplet.sh`, which runs `ufw --force reset` and would drop any
#   hand-added host rule.
#
# It costs nothing and adds zero request latency: it is stateful packet filtering
# already in the path, not an extra hop.
#
# SAFETY: a DO Cloud Firewall is DEFAULT-DENY inbound once attached. A rule set
# that omits SSH locks you out of the droplet. This script refuses to apply such
# a set, and defaults to dry-run.
#
# Usage:
#   setup-do-firewall.sh [options]
#
# Options:
#   --droplet-ip <ip>    Droplet public IPv4 (default: $DROPLET_IP or 203.0.113.50)
#   --droplet-id <id>    Use an explicit droplet ID, skipping IP lookup
#   --name <name>        Firewall name (default: <project>-edge-fw)
#   --ssh-from <cidrs>   Comma-separated CIDRs allowed to reach port 22
#                        (default: 0.0.0.0/0,::/0 — fail2ban is the control)
#   --web-from <cidrs>   Comma-separated CIDRs allowed to reach 80/443
#                        (default: 0.0.0.0/0,::/0 — set to an edge provider's
#                        ranges only once ALL traffic flows through that edge)
#   --cloudflare         Shorthand: set --web-from to Cloudflare's published ranges
#   --apply              Actually create/update. Without it, prints the plan only.
#
# Exit codes: 0 ok · 1 plan differs from live (dry-run) · 2 error

set -uo pipefail

DROPLET_IP="${DROPLET_IP:-203.0.113.50}"
DROPLET_ID=""
FW_NAME=""
SSH_FROM="0.0.0.0/0,::/0"
WEB_FROM="0.0.0.0/0,::/0"
USE_CF=0
APPLY=0

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; BLU=$'\033[0;34m'; DIM=$'\033[2m'; NC=$'\033[0m'
[ -t 1 ] || { RED=""; GRN=""; YLW=""; BLU=""; DIM=""; NC=""; }

die()  { printf '%s✘%s %s\n' "$RED" "$NC" "$1" >&2; exit "${2:-2}"; }
ok()   { printf '%s✔%s %s\n' "$GRN" "$NC" "$1"; }
note() { printf '%s•%s %s\n' "$BLU" "$NC" "$1"; }
warn() { printf '%s▲%s %s\n' "$YLW" "$NC" "$1"; }

usage() { sed -n '2,38p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage ;;
    --droplet-ip) DROPLET_IP="${2:-}"; shift 2 ;;
    --droplet-id) DROPLET_ID="${2:-}"; shift 2 ;;
    --name) FW_NAME="${2:-}"; shift 2 ;;
    --ssh-from) SSH_FROM="${2:-}"; shift 2 ;;
    --web-from) WEB_FROM="${2:-}"; shift 2 ;;
    --cloudflare) USE_CF=1; shift ;;
    --apply) APPLY=1; shift ;;
    *) die "Unknown option: $1" 64 ;;
  esac
done

command -v doctl >/dev/null 2>&1 || die "doctl not installed — brew install doctl"

PROJECT_NAME="$(basename "$(cd "$(dirname "$0")/../.." && pwd)")"
[ -z "$FW_NAME" ] && FW_NAME="${PROJECT_NAME}-edge-fw"

# ── Cloudflare ranges (only when the edge actually fronts all traffic) ────────
if [ "$USE_CF" -eq 1 ]; then
  note "Fetching Cloudflare published ranges…"
  CF4=$(curl -s --max-time 10 https://www.cloudflare.com/ips-v4 | tr '\n' ',' | sed 's/,$//')
  CF6=$(curl -s --max-time 10 https://www.cloudflare.com/ips-v6 | tr '\n' ',' | sed 's/,$//')
  [ -z "$CF4" ] && die "Could not fetch Cloudflare IPv4 ranges"
  WEB_FROM="${CF4},${CF6}"
  ok "Cloudflare ranges fetched ($(printf '%s' "$WEB_FROM" | tr ',' '\n' | grep -c .) CIDRs)"
  warn "Applying these locks the origin to Cloudflare. Only do this AFTER DNS is proxied,"
  warn "or the site becomes unreachable."
fi

# ── Lockout guard ────────────────────────────────────────────────────────────
case "$SSH_FROM" in
  ""|"none") die "Refusing to build a firewall with no SSH access — that locks you out of the droplet." ;;
esac

# ── Resolve droplet ──────────────────────────────────────────────────────────
if [ -z "$DROPLET_ID" ]; then
  note "Looking up droplet by IP ${DROPLET_IP}…"
  DROPLET_ID=$(doctl compute droplet list --format ID,PublicIPv4 --no-header 2>/dev/null \
    | awk -v ip="$DROPLET_IP" '$2==ip {print $1}' | head -1)
fi

if [ -z "$DROPLET_ID" ]; then
  warn "No droplet with IP ${DROPLET_IP} in the current doctl context."
  printf '  %sCurrent context: %s%s\n' "$DIM" "$(doctl auth list 2>/dev/null | grep current || echo unknown)" "$NC"
  printf '  %sThe droplet may live in a different DO team/account. Switch with:%s\n' "$DIM" "$NC"
  printf '  %s  doctl auth switch --context <name>   # or: doctl auth init%s\n' "$DIM" "$NC"
  printf '  %sThen re-run. Continuing to print the intended plan.%s\n\n' "$DIM" "$NC"
fi

# ── Build the plan ───────────────────────────────────────────────────────────
# doctl needs a SEPARATE `address:` key per source — `address:0.0.0.0/0,::/0`
# is malformed and the second CIDR is lost. This matters most on the
# --cloudflare path, which expands to 22 CIDRs.
addr_list() { # "a,b,c" -> "address:a,address:b,address:c"
  printf '%s' "$1" | tr ',' '\n' | sed '/^[[:space:]]*$/d; s/^[[:space:]]*/address:/' | paste -sd',' -
}

SSH_ADDRS=$(addr_list "$SSH_FROM")
WEB_ADDRS=$(addr_list "$WEB_FROM")
ANY_ADDRS="address:0.0.0.0/0,address:::/0"

# Rules within one flag value are space-separated (per `doctl compute firewall
# create --help`).
INBOUND="protocol:tcp,ports:22,${SSH_ADDRS}"
INBOUND="${INBOUND} protocol:tcp,ports:80,${WEB_ADDRS}"
INBOUND="${INBOUND} protocol:tcp,ports:443,${WEB_ADDRS}"
# ICMP is left open on purpose: blocking it breaks path-MTU discovery and
# traceroute diagnostics, and buys nothing against a real attacker.
INBOUND="${INBOUND} protocol:icmp,${ANY_ADDRS}"

OUTBOUND="protocol:tcp,ports:all,${ANY_ADDRS}"
OUTBOUND="${OUTBOUND} protocol:udp,ports:all,${ANY_ADDRS}"
OUTBOUND="${OUTBOUND} protocol:icmp,${ANY_ADDRS}"

printf '\n%sPlanned firewall: %s%s\n' "$BLU" "$FW_NAME" "$NC"
printf '  droplet     %s (%s)\n' "${DROPLET_ID:-<unresolved>}" "$DROPLET_IP"
printf '  inbound  22 %s\n' "$SSH_FROM"
printf '  inbound  80 %s\n' "$(printf '%s' "$WEB_FROM" | cut -c1-60)$([ ${#WEB_FROM} -gt 60 ] && echo '…')"
printf '  inbound 443 %s\n' "$(printf '%s' "$WEB_FROM" | cut -c1-60)$([ ${#WEB_FROM} -gt 60 ] && echo '…')"
printf '  inbound icmp any\n'
printf '  outbound    all\n'

# Print the literal payload, not just a friendly summary. A malformed rule
# string (missing a per-source `address:` key) is invisible in the summary and
# only shows up as a doctl error at apply time.
printf '\n  %s--inbound-rules%s  %s\n' "$DIM" "$NC" "$(printf '%s' "$INBOUND" | tr ' ' '\n' | sed 's/^/                   /' | sed '1s/^ *//')"
printf '  %s--outbound-rules%s %s\n\n' "$DIM" "$NC" "$(printf '%s' "$OUTBOUND" | tr ' ' '\n' | sed 's/^/                   /' | sed '1s/^ *//')"

EXISTING_ID=$(doctl compute firewall list --format ID,Name --no-header 2>/dev/null \
  | awk -v n="$FW_NAME" '$2==n {print $1}' | head -1)

if [ -n "$EXISTING_ID" ]; then
  note "Existing firewall found: ${EXISTING_ID}"
else
  note "No firewall named ${FW_NAME} exists yet"
fi

if [ "$APPLY" -eq 0 ]; then
  printf '\n%sDry run — nothing changed.%s Re-run with %s--apply%s to commit.\n' "$YLW" "$NC" "$GRN" "$NC"
  printf '%sThis is default-deny inbound once attached: confirm the SSH rule above is correct first.%s\n' "$DIM" "$NC"
  exit 1
fi

[ -z "$DROPLET_ID" ] && die "Cannot apply: droplet ID unresolved in this doctl context."

# shellcheck disable=SC2086
if [ -n "$EXISTING_ID" ]; then
  note "Updating firewall ${EXISTING_ID}…"
  doctl compute firewall update "$EXISTING_ID" \
    --name "$FW_NAME" \
    --droplet-ids "$DROPLET_ID" \
    --inbound-rules "$INBOUND" \
    --outbound-rules "$OUTBOUND" \
    || die "firewall update failed"
  ok "Firewall updated"
else
  note "Creating firewall ${FW_NAME}…"
  doctl compute firewall create \
    --name "$FW_NAME" \
    --droplet-ids "$DROPLET_ID" \
    --inbound-rules "$INBOUND" \
    --outbound-rules "$OUTBOUND" \
    || die "firewall create failed"
  ok "Firewall created"
fi

printf '\n%sVerify SSH still works before closing this session:%s\n' "$YLW" "$NC"
printf '  ssh -o ConnectTimeout=8 root@%s true && echo SSH_OK\n' "$DROPLET_IP"
exit 0
