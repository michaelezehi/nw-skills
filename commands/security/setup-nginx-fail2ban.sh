#!/usr/bin/env bash
# setup-nginx-fail2ban.sh — auto-ban scanners hitting the gateway. Runs ON the droplet.
#
# The existing droplet setup (scripts/setup-droplet.sh) installs fail2ban with an
# [sshd] jail only — nothing watches HTTP. This adds the nginx jail.
#
# Relationship to the nginx blackhole: the blackhole (conf.d/blackhole.inc)
# answers a probe with 444 and costs one cheap nginx evaluation. This bans the
# source so the next thousand probes cost nothing at all — they are dropped at
# iptables before nginx accepts the connection.
#
# It bans at DOCKER-USER because Docker's own iptables rules are consulted before
# the INPUT chain; a rule in INPUT would never be reached for container traffic.
#
# Includes logrotate. This matters: bind-mounting /var/log/nginx replaced the
# image's symlink-to-stdout, so Docker's json-file driver (max-size 10m,
# max-file 3) no longer rotates these logs. Without rotation the mount grows
# until the disk fills — trading a security gain for an availability outage.
#
# Usage (as root on the droplet):
#   setup-nginx-fail2ban.sh [--project <name>] [--dry-run]
#
# Exit codes: 0 ok · 2 error

set -uo pipefail

PROJECT_NAME="optic"
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT_NAME="${2:-optic}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
done

LOG_DIR="/var/log/${PROJECT_NAME}/nginx"
GRN=$'\033[0;32m'; YLW=$'\033[0;33m'; RED=$'\033[0;31m'; NC=$'\033[0m'
[ -t 1 ] || { GRN=""; YLW=""; RED=""; NC=""; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then printf '%s[dry-run]%s %s\n' "$YLW" "$NC" "$*"; else "$@"; fi
}
write_file() { # path <<< content
  local path="$1"; local content; content=$(cat)
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '%s[dry-run]%s would write %s (%d bytes)\n' "$YLW" "$NC" "$path" "${#content}"
  else
    printf '%s\n' "$content" > "$path"
  fi
}

if [ "$DRY_RUN" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
  printf '%sMust run as root on the droplet (or pass --dry-run to preview).%s\n' "$RED" "$NC" >&2
  exit 2
fi

printf 'Configuring nginx fail2ban jail for %s (logs: %s)\n\n' "$PROJECT_NAME" "$LOG_DIR"

run mkdir -p "$LOG_DIR"
# Create the log files up front. With `backend = polling` and a missing logpath
# fail2ban starts the jail but reports "Failed to access log file" and silently
# watches nothing — a jail that looks healthy and bans no one. The gateway
# replaces these once it is deployed with the log mount.
run touch "$LOG_DIR/access.log" "$LOG_DIR/error.log"

# NOT installing iptables-persistent on purpose:
#   * it prompts via debconf ("save current rules?"), which hangs a
#     non-interactive SSH run;
#   * fail2ban restores its own bans from its database on restart, so the
#     DOCKER-USER rules do not need to survive a reboot;
#   * persisting them would be actively wrong — Docker rebuilds DOCKER-USER at
#     start, and restored stale rules can conflict with it.
run env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban

# ── Filter ───────────────────────────────────────────────────────────────────
# Matches the project's log_format (nginx.conf): the request line sits in the
# first quoted field. Kept deliberately in sync with the $is_probe_path map in
# nginx.conf — a path the blackhole drops should also be a path that earns a ban.
#
# CRITICAL: fail2ban REMOVES the matched timestamp from the line before applying
# failregex, so what this actually sees is
#   203.0.113.10 - - [] "GET /.env HTTP/1.1" 444 ...
# with EMPTY brackets. An earlier version anchored on `\[[^]]+\]` (one-or-more
# inside the brackets); it matched a raw log line perfectly and matched nothing
# at all in production — the jail ran, reported healthy, and banned no one.
# `-[^"]*"` tolerates both forms. Verified end-to-end on the droplet, not just
# against a sample string.
write_file /etc/fail2ban/filter.d/nginx-scanner.conf <<'FILTER'
[Definition]
failregex = ^<HOST> -[^"]*"(?:GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH) /+(?:\.(?:env|git|aws|svn|hg|htpasswd|htaccess)|wp-login\.php|wp-admin/|wp-includes/|wp-content/|wp-json/|xmlrpc\.php|[^/ ]+/wp-includes/|phpmyadmin|phpinfo|adminer|pma|actuator(?:/|\b)|v2/actuator|_ignition/|latest/meta-data/|computeMetadata/|metadata/instance|docker-compose|Dockerfile|serverless\.|terraform\.(?:tfstate|tfvars)|\.s3cfg|\.boto|s3\.(?:yml|yaml|key|secret)|rest/(?:workflows|executions|node-types|credentials|variables|license))[^ ]* HTTP
            ^<HOST> -[^"]*"(?:GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH) [^"]*\.(?:php|sh|pl|cgi|bak|tfstate|tfvars)(?:\?[^"]*)? HTTP
ignoreregex =
FILTER

# ── Action ───────────────────────────────────────────────────────────────────
write_file /etc/fail2ban/action.d/nginx-docker-ban.conf <<'ACTION'
[Definition]
actionstart =
actionstop =
actioncheck =
actionban = iptables -I DOCKER-USER 1 -s <ip> -j DROP && echo "$(date -u): BANNED <ip> (nginx-scanner)" >> /var/log/fail2ban-bans.log
actionunban = iptables -D DOCKER-USER -s <ip> -j DROP
ACTION

# ── Jail ─────────────────────────────────────────────────────────────────────
SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')

write_file /etc/fail2ban/jail.d/nginx-scanner.conf <<JAIL
[nginx-scanner]
enabled  = true
filter   = nginx-scanner
action   = nginx-docker-ban
logpath  = ${LOG_DIR}/access.log
# access_log is buffered (flush=5s), so polling is the right backend here —
# inotify would fire on partial buffer flushes.
backend  = polling
maxretry = 3
findtime = 60
bantime  = 86400
# Never ban ourselves, Docker's bridge networks, or the droplet's own address.
ignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 ${SERVER_IP}
JAIL

# ── Logrotate ────────────────────────────────────────────────────────────────
# Without this the bind-mounted logs grow unbounded — see header.
write_file "/etc/logrotate.d/${PROJECT_NAME}-nginx" <<ROTATE
${LOG_DIR}/*.log {
    daily
    rotate 14
    maxsize 100M
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    postrotate
        # USR1 makes nginx reopen its log files. Without it nginx keeps writing
        # to the rotated (deleted) inode and the new file stays empty — which
        # would also silently blind fail2ban.
        docker exec ${PROJECT_NAME}-nginx-gateway nginx -s reopen 2>/dev/null || true
    endscript
}
ROTATE

run systemctl enable fail2ban
run systemctl restart fail2ban

if [ "$DRY_RUN" -eq 1 ]; then
  printf '\n%sDry run complete — nothing changed.%s\n' "$YLW" "$NC"
  exit 0
fi

sleep 2
printf '\n%s=== jail status ===%s\n' "$GRN" "$NC"
fail2ban-client status nginx-scanner || true

cat <<SUMMARY

${GRN}Done.${NC} 3 scanner hits in 60s → 24h ban at iptables DOCKER-USER.
  status : fail2ban-client status nginx-scanner
  unban  : fail2ban-client set nginx-scanner unbanip <IP>
  feed   : tail -f /var/log/fail2ban-bans.log
  rotate : logrotate -d /etc/logrotate.d/${PROJECT_NAME}-nginx   (dry-run check)
SUMMARY
