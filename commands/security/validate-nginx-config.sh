#!/usr/bin/env bash
# validate-nginx-config.sh — parse the gateway config locally, without Docker.
#
# `nginx -t` on a laptop normally fails for reasons that have nothing to do with
# the config being wrong: TLS certs live at /etc/letsencrypt, upstream hostnames
# are Docker service names, `use epoll` is Linux-only, and the log/webroot paths
# do not exist. This builds a throwaway tree that satisfies all of those so the
# ACTUAL syntax and directive-context errors surface — the things that break a
# deploy, like a `map` in the wrong context or an `include` that does not resolve.
#
# Rewrites made to the temp copy (never to the repo):
#   /etc/letsencrypt      → stub self-signed certs
#   /etc/nginx/conf.d     → the temp conf.d
#   /var/www, /var/log    → temp dirs
#   upstream server <host>:<port> → 127.0.0.1:<port>
#   use epoll             → dropped (Linux-only)
#   user nginx            → dropped (needs root)
#
# Usage: validate-nginx-config.sh [path/to/nginx-gateway]
# Exit codes: 0 valid · 1 invalid · 2 setup error

set -uo pipefail

SRC="${1:-docker/nginx-gateway}"
GRN=$'\033[0;32m'; RED=$'\033[0;31m'; DIM=$'\033[2m'; NC=$'\033[0m'
[ -t 1 ] || { GRN=""; RED=""; DIM=""; NC=""; }

[ -f "$SRC/nginx.conf" ] || { printf '%sNo nginx.conf under %s%s\n' "$RED" "$SRC" "$NC" >&2; exit 2; }
command -v nginx >/dev/null 2>&1 || { printf '%snginx not installed (brew install nginx)%s\n' "$RED" "$NC" >&2; exit 2; }
command -v openssl >/dev/null 2>&1 || { printf '%sopenssl required%s\n' "$RED" "$NC" >&2; exit 2; }

TMP=$(mktemp -d) || exit 2
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/conf.d" "$TMP/logs" "$TMP/www/maintenance" "$TMP/www/certbot" "$TMP/letsencrypt"
: > "$TMP/logs/access.log"
: > "$TMP/logs/error.log"
printf '<html>maintenance</html>' > "$TMP/www/maintenance/maintenance.html"

# Stub certs for every live/<name> directory the config references.
CERT_NAMES=$(grep -rhoE '/etc/letsencrypt/live/[^/]+/' "$SRC" 2>/dev/null \
  | sed 's#/etc/letsencrypt/live/##; s#/$##' | sort -u)
for name in $CERT_NAMES; do
  mkdir -p "$TMP/letsencrypt/live/$name"
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
    -keyout "$TMP/letsencrypt/live/$name/privkey.pem" \
    -out "$TMP/letsencrypt/live/$name/fullchain.pem" \
    -subj "/CN=$name" >/dev/null 2>&1 || { printf '%sstub cert failed for %s%s\n' "$RED" "$name" "$NC" >&2; exit 2; }
done
printf '%sStubbed certs: %s%s\n' "$DIM" "$(printf '%s' "$CERT_NAMES" | tr '\n' ' ')" "$NC"

MIME=$(nginx -V 2>&1 | tr ' ' '\n' | grep -- '--conf-path=' | sed 's#--conf-path=##; s#/[^/]*$#/mime.types#')
[ -f "$MIME" ] || MIME="/opt/homebrew/etc/nginx/mime.types"
[ -f "$MIME" ] || { printf '%sCould not locate mime.types%s\n' "$RED" "$NC" >&2; exit 2; }

rewrite() { # stdin -> stdout
  sed \
    -e "s#/etc/letsencrypt#$TMP/letsencrypt#g" \
    -e "s#/etc/nginx/conf.d#$TMP/conf.d#g" \
    -e "s#/etc/nginx/mime.types#$MIME#g" \
    -e "s#/var/www#$TMP/www#g" \
    -e "s#/var/log/nginx#$TMP/logs#g" \
    -e "s#/var/run/nginx.pid#$TMP/nginx.pid#g" \
    -e "/^[[:space:]]*user[[:space:]][[:space:]]*nginx;/d" \
    -e "/^[[:space:]]*use[[:space:]][[:space:]]*epoll;/d" \
  | sed -E 's#^([[:space:]]*server[[:space:]]+)[A-Za-z][A-Za-z0-9_.-]*:([0-9]+)#\1127.0.0.1:\2#'
    # ^ upstream members only: `server_name` has no space after `server`, and
    #   `server {` / an already-numeric address cannot match.
}

rewrite < "$SRC/nginx.conf" > "$TMP/nginx.conf"
for f in "$SRC"/conf.d/*; do
  [ -f "$f" ] || continue
  rewrite < "$f" > "$TMP/conf.d/$(basename "$f")"
done

printf '%sRunning nginx -t…%s\n\n' "$DIM" "$NC"
OUT=$(nginx -t -c "$TMP/nginx.conf" -p "$TMP" 2>&1)
RC=$?

printf '%s\n' "$OUT" | sed "s#$TMP#<tmp>#g"

# `listen ... http2` is deprecated in nginx >= 1.25 and emits a warning on
# modern local builds; the deployed nginx:alpine accepts it. Not a failure.
if [ $RC -eq 0 ]; then
  printf '\n%s✔ Gateway config parses cleanly%s\n' "$GRN" "$NC"
  exit 0
fi
printf '\n%s✘ Gateway config is INVALID%s\n' "$RED" "$NC"
exit 1
