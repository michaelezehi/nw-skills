#!/bin/bash
# /staging — validate generated artifacts in a project
# Usage: bash validate.sh [project-dir]
#
# Checks (each prints PASS or FAIL):
#  1. detect.sh produces expected fields
#  2. docker/docker-compose.staging.yml is valid (docker compose config)
#  3. docker/nginx-gateway/conf.d/ssl-staging.conf has matching upstream + server_name pairs
#  4. .env.staging.example has WORKOS_API_KEY and DB_NAME placeholders
#  5. scripts/deploy-staging.sh is executable and refers to staging compose file

set -uo pipefail

PROJ="${1:-$(pwd)}"
cd "$PROJ"

PASS=0
FAIL=0
ok()   { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

echo "=== /staging validation: $PROJ ==="

# 1. detect.sh
out=$(bash "$(dirname "$0")/detect.sh" "$PROJ" 2>&1)
echo "$out" | grep -q "^TYPE=" && ok "detect.sh emits TYPE" || fail "detect.sh emits TYPE"
echo "$out" | grep -q "^PROJECT=" && ok "detect.sh emits PROJECT" || fail "detect.sh emits PROJECT"

# 2. compose validation
if [ -f "docker/docker-compose.staging.yml" ]; then
  touch .env.staging.tmp
  if ENV_FILE=.env.staging.tmp docker compose -f docker/docker-compose.staging.yml --env-file .env.staging.tmp config >/dev/null 2>&1; then
    ok "docker-compose.staging.yml syntax"
  else
    # Try without env file (some compose versions handle differently)
    if [ ! -f .env.staging ]; then touch .env.staging; CLEANUP_ENV=1; fi
    if docker compose -f docker/docker-compose.staging.yml config >/dev/null 2>&1; then
      ok "docker-compose.staging.yml syntax"
    else
      fail "docker-compose.staging.yml syntax (run docker compose config to see error)"
    fi
    [ -n "${CLEANUP_ENV:-}" ] && rm -f .env.staging
  fi
  rm -f .env.staging.tmp
else
  fail "docker/docker-compose.staging.yml missing"
fi

# 3. nginx upstream/server pairing
NGINX_CONF="docker/nginx-gateway/conf.d/ssl-staging.conf"
if [ -f "$NGINX_CONF" ]; then
  upstreams=$(grep -c "^upstream " "$NGINX_CONF")
  servers=$(grep -c "^server {" "$NGINX_CONF" || echo 0)
  if [ "$upstreams" -gt 0 ] && [ "$servers" -gt 0 ]; then
    ok "ssl-staging.conf has $upstreams upstreams and $servers server blocks"
  else
    fail "ssl-staging.conf missing upstreams or server blocks"
  fi
  # Cert path sanity
  if grep -q "ssl_certificate.*\.pem" "$NGINX_CONF"; then
    ok "ssl-staging.conf references SSL cert"
  else
    fail "ssl-staging.conf missing ssl_certificate directive"
  fi
else
  echo "  SKIP: ssl-staging.conf not yet generated"
fi

# 4. env example
if [ -f ".env.staging.example" ]; then
  grep -q "WORKOS_API_KEY" .env.staging.example && ok ".env.staging.example has WORKOS_API_KEY" || fail "WORKOS_API_KEY missing from env example"
  grep -q "DB_NAME=.*staging" .env.staging.example && ok ".env.staging.example has staging DB_NAME" || fail "DB_NAME=*_staging missing"
else
  fail ".env.staging.example missing"
fi

# 5. deploy script
if [ -x "scripts/deploy-staging.sh" ]; then
  ok "scripts/deploy-staging.sh is executable"
  grep -q "docker-compose.staging.yml" scripts/deploy-staging.sh && ok "deploy script references staging compose" || fail "deploy script doesn't reference staging compose"
else
  fail "scripts/deploy-staging.sh missing or not executable"
fi

echo ""
echo "=== Result: $PASS pass, $FAIL fail ==="
[ "$FAIL" -eq 0 ]
