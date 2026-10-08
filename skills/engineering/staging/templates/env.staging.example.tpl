# ===========================================
# ${PROJECT} — STAGING ENVIRONMENT
# ===========================================
# Copy to .env.staging on the droplet (gitignored).
# Most values can mirror .env.production EXCEPT the ones marked STAGING-ONLY.

# --- Environment ---
NODE_ENV=staging
ENV_PREFIX=staging

# --- Domains (STAGING-ONLY) ---
DOMAIN=${PROD_DOMAIN}
APP_URL=https://${STAGING_APP_HOST}
API_URL=https://${STAGING_API_HOST}
WEBSITE_URL=https://${STAGING_HOST}
NEXT_PUBLIC_API_URL_BASE=https://${STAGING_API_HOST}
NEXT_PUBLIC_APP_URL=https://${STAGING_APP_HOST}
NEXT_PUBLIC_WEBSITE_URL=https://${STAGING_HOST}

# --- Database (STAGING-ONLY: shares prod postgres container, separate DB+user) ---
DB_HOST=${PROD_POSTGRES_CONTAINER}
DB_PORT=5432
DB_USERNAME=${PROJECT}_staging_user
DB_PASSWORD=CHANGE_ME_GENERATE_WITH_openssl_rand_-base64_32
DB_NAME=${PROJECT}_staging
DB_SSL=false

# --- Redis (STAGING-ONLY: shares prod container, DB index 1) ---
REDIS_HOST=${PROD_REDIS_CONTAINER}
REDIS_PORT=6379
REDIS_DB=1
REDIS_PASSWORD=

# ===========================================
# WORKOS (STAGING-ONLY)
# ===========================================
# Get these from the WorkOS dashboard:
# 1. Switch to "Staging" environment (top-right env switcher)
# 2. https://dashboard.workos.com/redirects
#    Add redirect URI: https://${STAGING_APP_HOST}/auth/callback
# 3. https://dashboard.workos.com/api-keys
#    Create new staging key. Paste below.
# 4. Client ID is shown in the same dashboard.
WORKOS_API_KEY=sk_staging_REPLACE_ME
WORKOS_CLIENT_ID=client_REPLACE_ME

# ===========================================
# THIRD-PARTY (mirror prod or use test keys)
# ===========================================
# Use TEST mode keys in staging where the service has a test mode.

# Stripe — test mode
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_ME

# Email
RESEND_API_KEY=re_REPLACE_ME
EMAIL_FROM=staging@${PROD_DOMAIN}

# Object storage — separate bucket recommended
DO_SPACES_BUCKET=${PROJECT}-staging-assets
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3
DO_SPACES_ACCESS_KEY_ID=REPLACE_ME
DO_SPACES_SECRET_ACCESS_KEY=REPLACE_ME

# AI providers — same keys as prod is fine
OPENAI_API_KEY=
GEMINI_API_KEY=

# --- Worker (lower concurrency for staging) ---
WORKER_CONCURRENCY=2
WORKER_MAX_JOBS=20

# --- Logging ---
LOG_LEVEL=debug
DEBUG=true

# --- Optional: monitoring ---
SENTRY_DSN=
SENTRY_ENVIRONMENT=staging
DD_ENV=staging
DD_SERVICE=${PROJECT}-staging
