---
name: security
description: Audit and harden the network edge of a Docker + nginx project on a DigitalOcean droplet — runs a full edge-posture audit (origin exposure, CDN bypass, TLS, DNS/mail policy, subdomain leaks), then applies the provider firewall, fail2ban auto-banning, nginx scanner blackhole, rate-limit zones, body/timeout caps and security headers, and verifies each with local tests. Infra/edge only. For code-level review use /pentest; for load and DDoS resilience use /loadtest and /ddos.
---
# /security — Edge hardening (nginx gateway + host firewall)

## Task

$ARGUMENTS

## Routing — this is the edge, not the app

| Question | Skill |
|---|---|
| Is the code exploitable (authz, injection, secrets, SSRF, prompt injection)? | `/pentest` |
| How many users can we hold? | `/loadtest` |
| Do our controls shed abuse (flood, slow-loris, cost-flood)? | `/ddos` |
| Are scanners hammering the gateway; do we have rate limits, headers, bans? | **this command** |

## What this does

0. **Posture audit**: measure before changing anything
1. **Discover**: server IP, Docker setup, nginx gateway config
2. **Analyze and block**: top scanner IPs from gateway logs, banned at iptables `DOCKER-USER` (or an ipset)
3. **fail2ban**: auto-ban (3 scanner hits / 60 s → 24 h)
4. **Log volume mount**: gateway access log on the host for fail2ban
5. **Nginx blackhole**: `return 444` for known probe paths
5b. **Rate limits + caps**: `limit_req` / `limit_conn` zones, body size, timeouts
5c. **Security headers**: HSTS, CSP, COOP, Referrer/Permissions-Policy
5d. **Provider network firewall**: filter upstream of the droplet
6. **API scanner pattern**: update `SCANNER_PATTERN` if a NestJS API exists
7. **Persist the toolkit** in the project
8. **Persist + commit**
Then **Verification**: local parse + behavioural tests, then re-run the audit

Assets ship alongside this command in `~/.claude/commands/security/`. Copy them
into the project's `scripts/security/` (and `blackhole.inc` into
`docker/nginx-gateway/conf.d/`) rather than rewriting them per project.

---

## Step 0: posture audit before any change

Measure before changing. This tells you which findings are real for *this*
architecture and stops you applying advice that does not apply.

```bash
mkdir -p scripts/security
cp ~/.claude/commands/security/*.sh ~/.claude/commands/security/*.py scripts/security/
chmod +x scripts/security/*.sh
./scripts/security/audit-edge-posture.sh $DOMAIN --json /tmp/posture-before.json
```

### The distinction that governs every finding

A CDN/WAF only protects you if **all** traffic flows through it — so a reachable
origin voids every edge rule. But that only applies **if there is an edge**.
Check which case you are in before reporting anything:

| | Edge in front (proxied DNS) | No edge (origin serves directly) |
|---|---|---|
| Origin reachable directly | **Critical** — all edge rules bypassable | Expected; the origin *is* the edge |
| "Origin IP is public" | A leak worth closing | Not a leak; it is the A record |
| Flexible SSL | Real risk — edge→origin may be plaintext | Impossible; only one TLS hop exists |
| Control that matters | Firewall whitelist of edge ranges | Origin-side L7 controls |

**Do not tell a single-origin project to "hide its origin IP."** It is
unachievable — historical DNS is permanent — and it is not the control that
matters. The firewall whitelist is.

Report `origin-bypass` and `sub-leak` as blockers. Everything else is ranked
against effort. Keep `/tmp/posture-before.json` for the post-deploy comparison under Verification.

---

## Step 1 — Discover Project Setup

Read these files to understand the project:

```
docker-compose.do.yml          # Find server profile, nginx gateway service
docker/nginx-gateway/nginx.conf
docker/nginx-gateway/conf.d/*.conf
scripts/deploy-app.sh          # Find SERVER_IP / SSH target
.env.production                # May contain SERVER_IP
```

Extract:
- `SERVER_IP` — the DigitalOcean / cloud server IP
- `GATEWAY_CONTAINER` — nginx gateway container name (e.g. `<project>-gateway-do`)
- `PROJECT_NAME` — from container naming convention
- `LOG_DIR` — `/var/log/<project>/nginx` (create if needed)
- `API_SCANNER_PATTERN` — path to scanner-pattern.ts if NestJS API exists

If SERVER_IP not found, ask the user: "What is your server's SSH IP?"

---

## Step 2 — SSH and Analyze Active Scanners

```bash
# Find top scanner IPs from gateway logs
ssh root@$SERVER_IP "
  docker logs $GATEWAY_CONTAINER 2>&1 \
    | grep -E '(\.env|aws|terraform|wp-|\.php|s3\.|/rest/|/metrics|healthz|__debug|credential)' \
    | grep -oE '[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}' \
    | sort | uniq -c | sort -rn | head -10
"
```

Block any IP with >500 scanner-path hits immediately:

```bash
ssh root@$SERVER_IP "iptables -I DOCKER-USER 1 -s <IP> -j DROP"
# For /24 subnets (multiple IPs same prefix): block entire subnet
ssh root@$SERVER_IP "iptables -I DOCKER-USER 1 -s <IP>/24 -j DROP"
```

---

## Step 3 — Setup fail2ban

Use the tested installer rather than hand-writing the files — it also ships the
logrotate config that Step 5 makes mandatory:

```bash
scp scripts/security/setup-nginx-fail2ban.sh root@$SERVER_IP:/tmp/
ssh root@$SERVER_IP "bash /tmp/setup-nginx-fail2ban.sh --project $PROJECT_NAME --dry-run"
ssh root@$SERVER_IP "bash /tmp/setup-nginx-fail2ban.sh --project $PROJECT_NAME"
```

Run it **before** deploying the Step 5 gateway config, not after: the log mount
removes Docker's rotation and logrotate has to exist first.

Bans land in `DOCKER-USER`, not `INPUT` — Docker consults its own chain first,
so an `INPUT` rule is never reached for container traffic.

Reference — what the installer writes (hand-write only if it cannot be used):

### Filter — `/etc/fail2ban/filter.d/nginx-scanner.conf`

```
[Definition]
failregex = ^<HOST> - [^"]* \[.*?\] "(?:GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH) (?:/\.env|/\.git|/\.aws|/aws/|/s3[./]|/s3/|/terraform|/docker-compose|/Dockerfile|/__debug|/metrics(?:/|$)|/healthz(?:/|$)|/wp-json/|/wp-login|/wp-admin|/wp-content|/wp-includes|/rest/(?:workflows|executions|node-types|users|credentials|tags|variables|license|login|logout)|/api/v1/credentials|/var/task/|/var/log/|/root/|/etc/boto|/aws\.(?:yaml|yml|json|env)|/s3\.(?:yml|yaml|key|secret)|/serverless\.(?:yml|yaml)|/terraform\.(?:tfstate|tfvars)|/\.boto|/\.s3cfg|\.php(?:\?|$| ))[^\s]* HTTP
ignoreregex =
```

### Action — `/etc/fail2ban/action.d/nginx-docker-ban.conf`

```
[Definition]
actionstart =
actionstop =
actioncheck =
actionban = iptables -I DOCKER-USER 1 -s <ip> -j DROP && echo "$(date -u): BANNED <ip> (fail2ban nginx-scanner)" >> /var/log/fail2ban-bans.log
actionunban = iptables -D DOCKER-USER -s <ip> -j DROP
```

### Jail — `/etc/fail2ban/jail.d/nginx-scanner.conf`

```
[nginx-scanner]
enabled  = true
filter   = nginx-scanner
action   = nginx-docker-ban
logpath  = /var/log/$PROJECT_NAME/nginx/access.log
backend  = polling
maxretry = 3
findtime = 60
bantime  = 86400
ignoreip = 127.0.0.1/8 ::1 172.16.0.0/12 $SERVER_IP
```

Enable: `systemctl enable fail2ban && systemctl restart fail2ban`

---

## Step 4 — Nginx Log Volume Mount

In `docker-compose.do.yml`, add to the nginx-gateway service volumes:

```yaml
- /var/log/$PROJECT_NAME/nginx:/var/log/nginx
```

Set access logging **once at `http {}` level** in `nginx.conf` (not per server
block — it inherits), buffered:

```nginx
access_log /var/log/nginx/access.log main buffer=64k flush=5s;
```

`flush=5s` keeps fail2ban detection well inside a 60s `findtime`, and buffering
batches writes instead of one syscall per request. Use `backend = polling` in
the jail, not inotify, which would fire on partial buffer flushes.

> Mounting this directory replaces the image's symlink-to-stdout, so Docker's
> `max-size` rotation **stops applying**. Step 3's installer must have run
> first — it ships the logrotate config.

Restart gateway: `docker compose -f docker-compose.do.yml --profile gateway up -d --no-deps nginx-gateway`

---

## Step 5 — Nginx Scanner Blackhole

Add to `docker/nginx-gateway/nginx.conf` inside the `http {}` block:

```nginx
map $http_user_agent $is_scanner {
    default                 0;
    "~*zgrab"               1;
    "~*masscan"             1;
    "~*nuclei"              1;
    "~*nikto"               1;
    "~*sqlmap"              1;
    "~*dirbuster"           1;
    "~*wfuzz"               1;
    "~*hydra"               1;
    "~*libwww-perl"         1;
}
```

**Do not blackhole `python-requests`, `go-http-client`, `curl`, or `axios`.**
Those are the user agents of Stripe/Resend/Convex webhooks, uptime monitors,
and our own smoke tests — blocking them silently breaks integrations. Path
rules below already catch the abusive requests those clients make.

Add a **second** map for probe paths, alongside the user-agent one:

```nginx
map $uri $is_probe_path {
    default                                          0;
    "~*^/+\.(env|git|aws|svn|hg|htpasswd|htaccess)"  1;
    "~*^/+(wp-login\.php|wp-admin/|wp-includes/|wp-content/|wp-json/|xmlrpc\.php)" 1;
    "~*^/+[^/]+/wp-includes/"                        1;
    "~*^/+(phpmyadmin|phpinfo|adminer|pma)(/|\.php|$)" 1;
    "~*^/+(actuator|v2/actuator)(/|$)"               1;
    "~*^/+_ignition/"                                1;
    "~*^/+(latest/meta-data/|computeMetadata/|metadata/instance)" 1;
    "~*^/+(docker-compose|Dockerfile|serverless)(\.|$)" 1;
    "~*\.(php|sh|pl|cgi|bak|tfstate|tfvars)$"        1;
}
```

**Use `map` + a server-level check, NOT regex `location` blocks.** A regex
location outranks a prefix location and can silently shadow a real route — an
outage introduced by a hardening step. A map cannot affect routing at all.
Match on `$uri` (normalised and decoded), not `$request_uri`, so `%2E` and `//`
bypass variants collapse before comparison.

Copy `~/.claude/commands/security/blackhole.inc` to
`docker/nginx-gateway/conf.d/blackhole.inc`:

```nginx
if ($is_probe_path) { return 444; }
if ($is_scanner_ua) { return 444; }
```

Then add one line to **every HTTPS `server {}` block** (server level, not inside
a location):

```nginx
include /etc/nginx/conf.d/blackhole.inc;
```

Named `.inc` so `include /etc/nginx/conf.d/*.conf` does not load it standalone.

**This makes the site faster, not slower.** Probes were previously proxied to
the app, running middleware for a redirect; now they never leave nginx. If the
audit's `probe-blackhole` finding showed 2xx/3xx responses, you are currently
paying a full upstream round trip per scanner request.

Also enable buffered access logging (fail2ban needs a real file, and buffering
is cheaper than the unbuffered default):

```nginx
access_log /var/log/nginx/access.log main buffer=64k flush=5s;
server_tokens off;
```

and mount it in compose so the host can read it:

```yaml
- /var/log/$PROJECT_NAME/nginx:/var/log/nginx
```

> **This removes Docker's `max-size` log rotation.** The image ships those paths
> as symlinks to stdout; mounting the directory makes them real files that grow
> unbounded. `setup-nginx-fail2ban.sh` installs logrotate — run it **before**
> deploying this config, or you trade a security gain for a full disk.

Validate locally before touching the server (no Docker needed):

```bash
./scripts/security/validate-nginx-config.sh
./scripts/security/test-blackhole.sh
```

Then reload: `docker exec $GATEWAY_CONTAINER nginx -t && docker exec $GATEWAY_CONTAINER nginx -s reload`

---

## Step 5b — Rate limits, connection caps, body/timeout caps

Inside `http {}` in `docker/nginx-gateway/nginx.conf`:

```nginx
limit_req_zone  $binary_remote_addr zone=req_general:10m rate=30r/s;
limit_req_zone  $binary_remote_addr zone=req_auth:10m    rate=5r/s;
limit_conn_zone $binary_remote_addr zone=conn_per_ip:10m;
limit_req_status  429;
limit_conn_status 429;

client_max_body_size   10m;      # raise only on upload routes
client_body_timeout    10s;
client_header_timeout  10s;
send_timeout           15s;
keepalive_timeout      20s;
```

In every HTTPS `server {}`:

```nginx
limit_req  zone=req_general burst=60 nodelay;
limit_conn conn_per_ip 40;

location ~* ^/(api/auth|sign-in|sign-up|login|reset|api/webhooks?) {
    limit_req zone=req_auth burst=10 nodelay;
    proxy_pass http://web;
}
```

Webhook routes keep the stricter zone but must **never** be blackholed by UA.

## Step 5c — Security headers

In each HTTPS `server {}` (or a shared `conf.d/00-headers.inc`):

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
# CSP is app-owned: set it in next.config / middleware so connect-src stays in
# sync with real backends. If nginx must set it, mirror the app's exactly.
server_tokens off;
```

`X-XSS-Protection` is deprecated — do not add it. Use `frame-ancestors` in CSP;
`X-Frame-Options DENY` only as a fallback.

Verify: `curl -sI https://$DOMAIN | grep -iE 'strict-transport|content-type-options|referrer|permissions|opener'`.

---

## Step 5d — Provider network firewall

ufw filters **inside** the droplet: packets have already crossed the NIC and
consumed CPU. A provider cloud firewall filters at the provider's network,
upstream of the droplet, so denied traffic never arrives. It is free, adds zero
request latency, and — importantly — survives `setup-droplet.sh`, which runs
`ufw --force reset` and wipes any hand-added host rule.

```bash
./scripts/security/setup-do-firewall.sh                 # dry run: prints the plan
./scripts/security/setup-do-firewall.sh --apply
```

> **A cloud firewall is default-deny inbound once attached.** A rule set without
> SSH locks you out of the droplet. The script refuses to build one, but verify
> before closing your session:
> `ssh -o ConnectTimeout=8 root@$SERVER_IP true && echo SSH_OK`

Keep 80/443 open to the world **unless** a CDN fronts all traffic. Only then
restrict them to that provider's published ranges (`--cloudflare` fetches
Cloudflare's), and only *after* DNS is proxied — otherwise the site goes dark.
Restricting web ports while the origin still serves users directly is the single
most common way this step causes an outage.

### On volumetric DDoS — what the provider already does

Do not propose a CDN migration for volumetric protection without checking what
the host already provides. DigitalOcean (and most major hosts) include **free,
always-on L3/L4 mitigation** — SYN/UDP/ICMP floods, reflection — with no
configuration.

The residual gap is narrow and specific: **above their mitigation capacity they
blackhole the target IP**, dropping legitimate traffic until the attack stops.
Their protection defends their network; you are collateral. That tail case is
the real argument for a scrubbing edge — and it is weaker than it looks once the
layers above are in place. Say so honestly rather than defaulting to "add
Cloudflare."

---

## Step 6 — API Scanner Pattern (NestJS only)

If the project has `apps/api/src/common/utils/scanner-pattern.ts` or equivalent, update `SCANNER_PATTERN` to:

```typescript
export const SCANNER_PATTERN =
  /(?:^\/+\.(?:git|env|svn|hg|aws|boto|s3cfg|docker|terraform|amplify)(?:\/|$))|(?:\.(?:php|sh|env|bak|tfstate|tfvars|yml|yaml|json|key|secret|properties|cfg)$)|(?:^\/+(?:dist|build|out|bin|cgi-bin|actuator|metrics|healthz|__debug|phpmyadmin|phpinfo)(?:\/|$))|(?:^\/+(?:[^/]+\/)*wp-(?:login|admin|content|includes|json|config))|(?:^\/+(?:admin|login|config)\.php)|(?:^\/+rest\/(?:workflows|executions|node-types|users|credentials?|tags|variables|license|login|logout)(?:\/|$))|(?:^\/+(?:var|app|root|opt|etc|s3|aws|terraform|docker|attacker)\/)|(?:^\/+(?:serverless|sam-template|template|amplify|vercel|netlify|docker-compose|Dockerfile)(?:\.|$))/i;
```

Key: uses `\/+` (one or more slashes) to catch double-slash bypass attempts.

---

## Step 7 — Persist the toolkit in the project

The scripts copied in Step 0 stay in the project so the next person can re-run
the audit and the tests without this command:

```
scripts/security/
├── audit-edge-posture.sh       # the audit — safe to run anywhere, CI-friendly
├── setup-do-firewall.sh        # provider network firewall (dry-run default)
├── setup-nginx-fail2ban.sh     # jail + action + filter + logrotate
├── validate-nginx-config.sh    # parse gateway config locally, no Docker
├── test-blackhole.sh           # 30 behavioural assertions
└── test-fail2ban-filter.py     # 54 filter assertions
```

Write `docs/security-edge-posture.md` documenting: which layer catches what, the
edge-vs-no-edge distinction from Step 0, how to read each finding, the two
hazards (firewall lockout, log rotation), and the known gaps left open. Copy the
structure from optic-qa-ai's copy of that file.

Add the project to any monitoring manifest you keep — a project with no uptime
monitor on itself learns about outages from its customers.

---

## Step 8 — Persist and Commit

```bash
# On server — persist iptables rules
ssh root@$SERVER_IP "iptables-save > /etc/iptables/rules.v4"

# Locally — commit all security changes
git add docker-compose.do.yml docker/nginx-gateway/ scripts/security/ docs/security-edge-posture.md
# Add scanner-pattern.ts if updated
git commit -m "security: add scanner auto-ban, nginx blackhole, fail2ban setup"
```

---

## Verification

### Local, before deploying (no server, no Docker)

```bash
./scripts/security/validate-nginx-config.sh        # does the gateway config parse?
./scripts/security/test-blackhole.sh               # 30 behavioural assertions
python3 scripts/security/test-fail2ban-filter.py   # 54 filter assertions
```

`test-blackhole.sh` asserts scanner paths and UAs are dropped, app routes are
untouched, **and integration UAs still get through**. That last group is the one
that matters: blocking `python-requests` or `Go-http-client` to look thorough
silently breaks Stripe, Resend, Convex webhooks and uptime monitors.

`test-fail2ban-filter.py` extracts the regex from the installer, so it cannot
drift from what gets installed. It asserts `/.well-known/acme-challenge/` is
never matched — banning that breaks certificate renewal.

Extend both fixture lists with the project's real routes before trusting them.

### Post-deploy, against the live host

```bash
# Re-run the audit and diff against the Step 0 baseline
./scripts/security/audit-edge-posture.sh $DOMAIN --active --json /tmp/posture-after.json
diff <(jq -S '.counts' /tmp/posture-before.json) <(jq -S '.counts' /tmp/posture-after.json)
```

Expect `probe-blackhole` and `hdr-server-tokens` to flip to pass. If any finding
regressed, stop and fix before committing.

```bash
# Confirm scanner paths return 000 (TCP dropped)
curl -sk --max-time 3 -o /dev/null -w '%{http_code}' https://$DOMAIN/.env
curl -sk --max-time 3 -o /dev/null -w '%{http_code}' https://$DOMAIN/wp-login.php

# Confirm fail2ban is watching
ssh root@$SERVER_IP "fail2ban-client status nginx-scanner"

# Confirm active blocks
ssh root@$SERVER_IP "iptables -L DOCKER-USER -n"
```

All scanner paths must return `000`. Legitimate paths must return `200`/`400`/`404`.

```bash
# Rate limit fires (expect a run of 429s at the tail)
for i in $(seq 1 80); do curl -s -o /dev/null -w '%{http_code}\n' https://$DOMAIN/api/health; done | sort | uniq -c

# Webhook UA is NOT blocked (expect 4xx from the app, not 000)
curl -s -o /dev/null -w '%{http_code}' -A 'python-requests/2.32' https://$DOMAIN/api/webhooks/stripe
```

---

## Manage Bans

```bash
ssh root@$SERVER_IP "fail2ban-client status nginx-scanner"          # current bans
ssh root@$SERVER_IP "fail2ban-client set nginx-scanner unbanip IP"  # unban
ssh root@$SERVER_IP "tail -f /var/log/fail2ban-bans.log"            # live ban feed
```
