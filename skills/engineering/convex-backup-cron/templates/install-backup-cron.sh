#!/bin/bash
# Install the prod backup cron. Idempotent. From laptop, rsyncs + SSHes to droplet.
set -e
DEPLOY_SERVER="${DEPLOY_SERVER:-<USER@HOST>}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/<APP>}"
CRON_FILE="/etc/cron.d/<app>-backup"
LOG_FILE="/var/log/<app>-backups.log"
LOCK_FILE="/var/lock/<app>-backup.lock"

log() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
ok()  { echo -e "\033[0;32m[OK]\033[0m $1"; }
warn(){ echo -e "\033[1;33m[WARN]\033[0m $1"; }
err() { echo -e "\033[0;31m[ERR]\033[0m $1"; }

# If not on droplet, rsync working tree (same excludes as deploy script) + SSH.
if [ ! -d "$DEPLOY_DIR" ]; then
    log "Syncing working tree to $DEPLOY_SERVER:$DEPLOY_DIR ..."
    rsync -az \
        --exclude='node_modules' --exclude='.next' --exclude='.turbo' --exclude='dist' \
        --exclude='*.tsbuildinfo' --exclude='.DS_Store' --exclude='test-results' \
        --exclude='coverage' --exclude='.env.local' --exclude='.env.do' \
        --exclude='_r&d' --exclude='__R&D' --exclude='.claude' --exclude='.git' \
        ./ "$DEPLOY_SERVER:$DEPLOY_DIR/"
    ok "Synced"
    ssh -t "$DEPLOY_SERVER" "cd $DEPLOY_DIR && bash scripts/install-backup-cron.sh $*"
    exit $?
fi

UNINSTALL=false; RUN_TEST=false
for a in "$@"; do case "$a" in --uninstall) UNINSTALL=true ;; --test) RUN_TEST=true ;; esac; done

if [ "$UNINSTALL" = true ]; then rm -f "$CRON_FILE" && ok "Removed $CRON_FILE"; exit 0; fi

# Validate required env present somewhere
MISSING=()
ENV_FILES=("$DEPLOY_DIR/.env.do" "$DEPLOY_DIR/.env.production")
for var in DO_SPACES_KEY DO_SPACES_SECRET DO_SPACES_ENDPOINT CONVEX_DEPLOY_KEY; do
    FOUND=false
    for f in "${ENV_FILES[@]}"; do
        if grep -q "^${var}=" "$f" 2>/dev/null; then FOUND=true; break; fi
    done
    [ "$FOUND" = false ] && MISSING+=("$var")
done
if [ ${#MISSING[@]} -gt 0 ]; then err "Missing env: ${MISSING[*]}"; exit 1; fi

# Ensure @aws-sdk/client-s3 is installed at repo root
log "Ensuring root prod deps installed..."
(cd "$DEPLOY_DIR" && pnpm install --prod --frozen-lockfile --ignore-scripts --filter "." 2>&1 | tail -3) || warn "pnpm install failed"

touch "$LOG_FILE" "$LOCK_FILE" && chmod 644 "$LOG_FILE"

cat > "$CRON_FILE" <<EOF
# <project> — production backup (every 6h)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 0,6,12,18 * * * root cd $DEPLOY_DIR && /usr/bin/flock -n $LOCK_FILE /usr/bin/node scripts/backup-prod.mjs >> $LOG_FILE 2>&1
EOF
chmod 644 "$CRON_FILE"
ok "Installed $CRON_FILE"
systemctl reload cron 2>/dev/null || systemctl reload crond 2>/dev/null || true

if [ "$RUN_TEST" = true ]; then
    log "Running one backup now..."
    cd "$DEPLOY_DIR"; set -a
    [ -f .env.do ] && source .env.do; [ -f .env.production ] && source .env.production
    set +a
    /usr/bin/node scripts/backup-prod.mjs && ok "Test backup OK"
fi
