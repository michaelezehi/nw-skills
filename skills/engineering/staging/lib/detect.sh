#!/bin/bash
# /staging — project detection
# Usage: bash detect.sh [project-dir]
# Outputs key=value lines for sourcing or parsing.

set -euo pipefail

PROJ="$(cd "${1:-$(pwd)}" && pwd)"
cd "$PROJ"

# --- Project type ---
TYPE="unknown"
if [ -d "convex" ] && [ -d "convex/_generated" ]; then
  TYPE="convex"
elif grep -lq "@convex-dev\|convex/server" package.json 2>/dev/null; then
  TYPE="convex"
elif find . -maxdepth 4 -name "ormconfig*" -o -name "data-source.ts" 2>/dev/null | grep -q .; then
  TYPE="postgres"
elif grep -lq "typeorm\|prisma\|drizzle-orm" package.json 2>/dev/null; then
  TYPE="postgres"
elif [ -f "docker/docker-compose.do.yml" ] && grep -q "postgres" docker/docker-compose.do.yml 2>/dev/null; then
  TYPE="postgres"
fi

# --- Production scaffolding presence ---
HAS_DOCKERFILE="no"
if [ -f "Dockerfile" ]; then
  HAS_DOCKERFILE="yes"
elif find docker -maxdepth 1 -name "*.Dockerfile" 2>/dev/null | grep -q .; then
  HAS_DOCKERFILE="yes"
fi
HAS_PROD_COMPOSE="no"
for f in docker/docker-compose.do.yml docker-compose.do.yml docker-compose.production.yml docker-compose.staging.yml; do
  [ -f "$f" ] && HAS_PROD_COMPOSE="yes" && break
done
HAS_GATEWAY="no"
[ -d "docker/nginx-gateway" ] && HAS_GATEWAY="yes"
HAS_PROD_ENV="no"
[ -f ".env.production" ] && HAS_PROD_ENV="yes"

# --- Canonical production domain ---
# Try .env.production first (NEXT_PUBLIC_APP_URL or APP_URL or DOMAIN)
PROD_DOMAIN=""
if [ -f ".env.production" ]; then
  for var in DOMAIN APP_URL NEXT_PUBLIC_APP_URL WEBSITE_URL NEXT_PUBLIC_WEBSITE_URL; do
    val=$(grep -E "^${var}=" .env.production 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | sed 's|https\?://||' | sed 's|/.*||' | sed 's|^app\.||' | sed 's|^api\.||' | sed 's|^staging\.||')
    if [ -n "$val" ] && [[ "$val" == *.* ]]; then
      PROD_DOMAIN="$val"
      break
    fi
  done
fi
# Fall back to ssl.conf server_name
if [ -z "$PROD_DOMAIN" ] && [ -f "docker/nginx-gateway/conf.d/ssl.conf" ]; then
  PROD_DOMAIN=$(grep -E "server_name" docker/nginx-gateway/conf.d/ssl.conf | grep -oE "[a-z0-9-]+\.[a-z]{2,}" | head -1)
fi

# --- Project short name ---
PROJECT=$(basename "$PROJ" | sed 's/-platform//' | tr -d '_-' | tr 'A-Z' 'a-z')
[ -z "$PROJECT" ] && PROJECT=$(basename "$PROJ")

cat <<EOF
PROJECT=$PROJECT
TYPE=$TYPE
PROD_DOMAIN=$PROD_DOMAIN
HAS_DOCKERFILE=$HAS_DOCKERFILE
HAS_PROD_COMPOSE=$HAS_PROD_COMPOSE
HAS_GATEWAY=$HAS_GATEWAY
HAS_PROD_ENV=$HAS_PROD_ENV
PROJECT_DIR=$PROJ
EOF
