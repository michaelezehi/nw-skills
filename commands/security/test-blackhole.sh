#!/usr/bin/env bash
# test-blackhole.sh — functional test for the scanner blackhole.
#
# Parsing cleanly is not the same as behaving correctly. This boots a real nginx
# on a loopback port using the PROJECT'S OWN `map` definitions from nginx.conf
# and the real conf.d/blackhole.inc, then asserts:
#
#   * scanner paths and scanner user agents are dropped (444 / no response)
#   * ordinary application routes are untouched
#   * integration user agents (Stripe, Resend, uptime monitors) are NOT blocked
#
# That last group is the one worth guarding: blocking python-requests or
# go-http-client to look tough silently breaks webhooks.
#
# Usage: test-blackhole.sh [path/to/nginx-gateway] [port]
# Exit codes: 0 all assertions passed · 1 assertion failed · 2 setup error

set -uo pipefail

SRC="${1:-docker/nginx-gateway}"
PORT="${2:-8089}"

GRN=$'\033[0;32m'; RED=$'\033[0;31m'; DIM=$'\033[2m'; NC=$'\033[0m'
[ -t 1 ] || { GRN=""; RED=""; DIM=""; NC=""; }

command -v nginx >/dev/null 2>&1 || { printf '%snginx not installed (brew install nginx)%s\n' "$RED" "$NC" >&2; exit 2; }
[ -f "$SRC/nginx.conf" ] || { printf '%sNo nginx.conf under %s%s\n' "$RED" "$SRC" "$NC" >&2; exit 2; }
[ -f "$SRC/conf.d/blackhole.inc" ] || { printf '%sNo conf.d/blackhole.inc under %s%s\n' "$RED" "$SRC" "$NC" >&2; exit 2; }

TMP=$(mktemp -d) || exit 2
NGINX_PID=""
cleanup() {
  if [ -n "$NGINX_PID" ]; then
    kill "$NGINX_PID" 2>/dev/null
    # `wait` absorbs the shell's "Terminated" job-control notice, which would
    # otherwise print after the pass summary and read like a failure.
    wait "$NGINX_PID" 2>/dev/null
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

mkdir -p "$TMP/conf.d" "$TMP/logs"

MIME=$(nginx -V 2>&1 | tr ' ' '\n' | grep -- '--conf-path=' | sed 's#--conf-path=##; s#/[^/]*$#/mime.types#')
[ -f "$MIME" ] || MIME="/opt/homebrew/etc/nginx/mime.types"

# Reuse the project's real http-level config (so the real `map` blocks are under
# test), but swap conf.d for a single plaintext test server.
sed \
  -e "s#/etc/nginx/conf.d#$TMP/conf.d#g" \
  -e "s#/etc/nginx/mime.types#$MIME#g" \
  -e "s#/var/log/nginx#$TMP/logs#g" \
  -e "s#/var/run/nginx.pid#$TMP/nginx.pid#g" \
  -e "/^[[:space:]]*user[[:space:]][[:space:]]*nginx;/d" \
  -e "/^[[:space:]]*use[[:space:]][[:space:]]*epoll;/d" \
  < "$SRC/nginx.conf" \
  | sed -E 's#^([[:space:]]*server[[:space:]]+)[A-Za-z][A-Za-z0-9_.-]*:([0-9]+)#\1127.0.0.1:\2#' \
  > "$TMP/nginx.conf"

cp "$SRC/conf.d/blackhole.inc" "$TMP/conf.d/blackhole.inc"

cat > "$TMP/conf.d/test-server.conf" <<EOF
server {
    listen 127.0.0.1:${PORT};
    server_name localhost;
    include ${TMP}/conf.d/blackhole.inc;
    location / { return 200 "app-reached\n"; }
}
EOF

# A port already in use makes nginx fail to bind and every assertion then fails
# with a misleading 000 — which reads as "everything is being dropped, tests
# pass" for the drop cases and as a total failure for the serve cases.
if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
  printf '%sPort %s is already in use — pass a free port as arg 2.%s\n' "$RED" "$PORT" "$NC" >&2
  exit 2
fi

nginx -t -c "$TMP/nginx.conf" -p "$TMP" >/dev/null 2>&1 || {
  printf '%sTest config failed to parse:%s\n' "$RED" "$NC"
  nginx -t -c "$TMP/nginx.conf" -p "$TMP" 2>&1 | sed "s#$TMP#<tmp>#g"
  exit 2
}

# `-g "daemon off;"` is REQUIRED, not cosmetic. Without it nginx forks into the
# background and the launched process exits immediately, so $! is a PID that is
# already gone — cleanup kills nothing, every run leaks an nginx master holding
# the port, and the temp dir gets rm -rf'd out from under a live server. The
# next run then fails on a port collision it did not cause.
nginx -c "$TMP/nginx.conf" -p "$TMP" -g "daemon off;" &
NGINX_PID=$!
READY=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:${PORT}/"; then READY=1; break; fi
  sleep 0.3
done

# Without this the suite runs against a dead server: every request returns 000,
# so all the "must be dropped" assertions pass and the run looks 70% green.
# A test that passes when nothing is listening is worse than no test.
if [ "$READY" -eq 0 ]; then
  printf '%sTest nginx never became ready on 127.0.0.1:%s — aborting.%s\n' "$RED" "$PORT" "$NC" >&2
  exit 2
fi

FAILED=0
code_for() { # path [user-agent]
  local out
  if [ -n "${2:-}" ]; then
    out=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 -A "$2" "http://127.0.0.1:${PORT}$1" 2>/dev/null)
  else
    out=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "http://127.0.0.1:${PORT}$1" 2>/dev/null)
  fi
  case "$out" in ''|*[!0-9]*) printf '000' ;; *) printf '%s' "$out" ;; esac
}

assert_dropped() { # label path [ua]
  local c; c=$(code_for "$2" "${3:-}")
  # 444 closes the connection with no response, so curl reports 000.
  if [ "$c" = "000" ] || [ "$c" = "444" ]; then
    printf '  %s✔%s dropped   %s\n' "$GRN" "$NC" "$1"
  else
    printf '  %s✘%s EXPECTED DROP, got %s   %s\n' "$RED" "$NC" "$c" "$1"; FAILED=$((FAILED+1))
  fi
}
assert_served() { # label path [ua]
  local c; c=$(code_for "$2" "${3:-}")
  if [ "$c" = "200" ]; then
    printf '  %s✔%s served    %s\n' "$GRN" "$NC" "$1"
  else
    printf '  %s✘%s EXPECTED SERVE, got %s   %s\n' "$RED" "$NC" "$c" "$1"; FAILED=$((FAILED+1))
  fi
}

printf '\n%sScanner paths must be dropped%s\n' "$DIM" "$NC"
assert_dropped "/.env"                 "/.env"
assert_dropped "/.git/config"          "/.git/config"
assert_dropped "/.aws/credentials"     "/.aws/credentials"
assert_dropped "/wp-login.php"         "/wp-login.php"
assert_dropped "/wp-admin/"            "/wp-admin/"
assert_dropped "/blog/wp-includes/x"   "/blog/wp-includes/x"
assert_dropped "/phpmyadmin/"          "/phpmyadmin/"
assert_dropped "/actuator/env"         "/actuator/env"
assert_dropped "/_ignition/health"     "/_ignition/health"
assert_dropped "/latest/meta-data/iam" "/latest/meta-data/iam"
assert_dropped "/index.php"            "/index.php"
assert_dropped "/backup.bak"           "/backup.bak"
assert_dropped "/terraform.tfstate"    "/terraform.tfstate"
assert_dropped "encoded /%2Egit/config" "/%2Egit/config"
assert_dropped "double-slash //.env"   "//.env"

printf '\n%sScanner user agents must be dropped%s\n' "$DIM" "$NC"
assert_dropped "UA nuclei"    "/" "Nuclei - Open-source project"
assert_dropped "UA sqlmap"    "/" "sqlmap/1.7"
assert_dropped "UA zgrab"     "/" "Mozilla/5.0 zgrab/0.x"
assert_dropped "UA masscan"   "/" "masscan/1.3"

printf '\n%sApplication routes must be untouched%s\n' "$DIM" "$NC"
assert_served "/"                      "/"
assert_served "/api/health"            "/api/health"
assert_served "/api/ingest"            "/api/ingest"
assert_served "/dashboard/settings"    "/dashboard/settings"
assert_served "/_next/static/chunk.js" "/_next/static/chunk.js"
assert_served "/api/extension/download" "/api/extension/download"

printf '\n%sIntegration user agents must NOT be blocked%s\n' "$DIM" "$NC"
assert_served "UA python-requests (Resend/webhooks)" "/" "python-requests/2.32.3"
assert_served "UA Go-http-client (Convex/Stripe)"    "/" "Go-http-client/2.0"
assert_served "UA curl (smoke tests)"                "/" "curl/8.7.1"
assert_served "UA Stripe"                            "/" "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
assert_served "UA uptime monitor"                    "/" "Better Uptime Bot"

if [ "$FAILED" -eq 0 ]; then
  printf '\n%s✔ All blackhole assertions passed%s\n' "$GRN" "$NC"
  exit 0
fi
printf '\n%s✘ %d assertion(s) failed%s\n' "$RED" "$FAILED" "$NC"
exit 1
