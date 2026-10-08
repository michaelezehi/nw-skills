#!/usr/bin/env bash
# audit-edge-posture.sh — portable edge/origin security posture audit.
#
# Encodes the manual checks that answer "is our edge actually protecting us, or
# can someone walk straight around it?" Works on any domain; nothing here is
# specific to one project.
#
# The premise it tests: a CDN/WAF only protects you if ALL traffic flows through
# it. If the origin IP is reachable directly, every edge rule is bypassable. It
# also handles the honest opposite case — no CDN at all — where a reachable
# origin is the architecture, not a leak, and the findings change accordingly.
#
# Usage:
#   audit-edge-posture.sh <domain> [options]
#
# Options:
#   --origin-ip <ip>    Known origin IP (else inferred from the A record)
#   --subdomains a,b,c  Extra subdomains to sweep (merged with the defaults)
#   --active            Run intrusive probes (scanner paths, rate-limit burst).
#                       Only for domains you own or are authorised to test.
#   --strict            Treat warnings as failures (exit 2)
#   --quiet             Findings only, no section headers
#   --json <path>       Also write machine-readable findings to <path>
#
# Exit codes: 0 = clean · 1 = warnings · 2 = failures
#
# Requires: dig, curl, openssl. Optional: jq.

set -uo pipefail

DOMAIN=""
ORIGIN_IP=""
EXTRA_SUBS=""
ACTIVE=0
STRICT=0
QUIET=0
JSON_OUT=""

RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[0;33m'
BLU=$'\033[0;34m'; DIM=$'\033[2m'; NC=$'\033[0m'
[ -t 1 ] || { RED=""; GRN=""; YLW=""; BLU=""; DIM=""; NC=""; }

PASS_N=0; WARN_N=0; FAIL_N=0; INFO_N=0
JSON_ROWS=""

usage() { sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

# Findings embed live server output (TLS subjects, headers, DNS answers), which
# can carry CR/LF and control bytes. Unescaped, a single one makes --json emit
# invalid JSON and silently breaks whatever consumes it in CI. Newlines/tabs
# collapse to spaces (these are one-line human messages), remaining control
# bytes are dropped, then JSON's two mandatory escapes are applied.
_json_escape() {
  printf '%s' "$1" \
    | tr '\n\r\t' '   ' \
    | tr -d '\000-\037\177' \
    | sed 's/\\/\\\\/g; s/"/\\"/g'
}

_record() { # level id message detail
  local lvl="$1" id="$2" msg="$3" det="${4:-}"
  JSON_ROWS="${JSON_ROWS}{\"level\":\"$(_json_escape "$lvl")\",\"id\":\"$(_json_escape "$id")\",\"message\":\"$(_json_escape "$msg")\",\"detail\":\"$(_json_escape "$det")\"},"
}

pass() { PASS_N=$((PASS_N+1)); _record pass "$1" "$2" "${3:-}"; printf '  %s✔%s %s\n' "$GRN" "$NC" "$2"; [ -n "${3:-}" ] && printf '      %s%s%s\n' "$DIM" "$3" "$NC"; return 0; }
warn() { WARN_N=$((WARN_N+1)); _record warn "$1" "$2" "${3:-}"; printf '  %s▲%s %s\n' "$YLW" "$NC" "$2"; [ -n "${3:-}" ] && printf '      %s%s%s\n' "$DIM" "$3" "$NC"; return 0; }
fail() { FAIL_N=$((FAIL_N+1)); _record fail "$1" "$2" "${3:-}"; printf '  %s✘%s %s\n' "$RED" "$NC" "$2"; [ -n "${3:-}" ] && printf '      %s%s%s\n' "$DIM" "$3" "$NC"; return 0; }
info() { INFO_N=$((INFO_N+1)); _record info "$1" "$2" "${3:-}"; printf '  %s•%s %s\n' "$BLU" "$NC" "$2"; [ -n "${3:-}" ] && printf '      %s%s%s\n' "$DIM" "$3" "$NC"; return 0; }
section() { [ "$QUIET" -eq 1 ] && return 0; printf '\n%s%s%s\n' "$BLU" "$1" "$NC"; return 0; }

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage ;;
    --origin-ip) ORIGIN_IP="${2:-}"; shift 2 ;;
    --subdomains) EXTRA_SUBS="${2:-}"; shift 2 ;;
    --json) JSON_OUT="${2:-}"; shift 2 ;;
    --active) ACTIVE=1; shift ;;
    --strict) STRICT=1; shift ;;
    --quiet) QUIET=1; shift ;;
    -*) printf 'Unknown option: %s\n' "$1" >&2; exit 64 ;;
    *) [ -z "$DOMAIN" ] && DOMAIN="$1" || { printf 'Unexpected argument: %s\n' "$1" >&2; exit 64; }; shift ;;
  esac
done

[ -z "$DOMAIN" ] && { printf 'Usage: %s <domain> [options]\n' "${0##*/}" >&2; exit 64; }

for bin in dig curl openssl; do
  command -v "$bin" >/dev/null 2>&1 || { printf 'Missing required tool: %s\n' "$bin" >&2; exit 69; }
done

CURL="curl -s --max-time 10"

[ "$QUIET" -eq 1 ] || cat <<BANNER
${BLU}Edge posture audit${NC} — ${DOMAIN}
${DIM}$(date -u '+%Y-%m-%dT%H:%M:%SZ') · active probes: $([ "$ACTIVE" -eq 1 ] && echo on || echo off)${NC}
BANNER

# ── 1. DNS ───────────────────────────────────────────────────────────────────
section "1. DNS and delegation"

A_RECORDS=$(dig +short "$DOMAIN" A 2>/dev/null | grep -E '^[0-9]+\.' | tr '\n' ' ' | sed 's/ $//')
AAAA_RECORDS=$(dig +short "$DOMAIN" AAAA 2>/dev/null | tr '\n' ' ' | sed 's/ $//')
NS_RECORDS=$(dig +short "$DOMAIN" NS 2>/dev/null | tr '\n' ' ' | sed 's/ $//')

if [ -z "$A_RECORDS" ]; then
  fail dns-no-a "No A record resolves for ${DOMAIN}" "Domain may be misconfigured or CNAME-only"
else
  info dns-a "A record(s): ${A_RECORDS}"
fi
[ -n "$AAAA_RECORDS" ] && info dns-aaaa "AAAA record(s): ${AAAA_RECORDS}"
[ -n "$NS_RECORDS" ] && info dns-ns "Nameservers: ${NS_RECORDS}"

[ -z "$ORIGIN_IP" ] && ORIGIN_IP=$(printf '%s' "$A_RECORDS" | awk '{print $1}')

# ── 2. Edge/CDN detection ────────────────────────────────────────────────────
section "2. Edge / CDN in front"

HEADERS=$($CURL -sI "https://${DOMAIN}/" 2>/dev/null)
HDR_LC=$(printf '%s' "$HEADERS" | tr '[:upper:]' '[:lower:]')

CDN=""
case "$HDR_LC" in
  *cf-ray*|*"server: cloudflare"*) CDN="Cloudflare" ;;
  *x-vercel-id*)                   CDN="Vercel" ;;
  *x-akamai*|*akamaighost*)        CDN="Akamai" ;;
  *"x-served-by: cache"*|*fastly*) CDN="Fastly" ;;
  *x-sucuri-id*)                   CDN="Sucuri" ;;
  *incap_ses*|*x-iinfo*)           CDN="Imperva/Incapsula" ;;
  *x-amz-cf-id*|*cloudfront*)      CDN="CloudFront" ;;
esac

NS_LC=$(printf '%s' "$NS_RECORDS" | tr '[:upper:]' '[:lower:]')
case "$NS_LC" in *cloudflare*) [ -z "$CDN" ] && CDN="Cloudflare (by NS)" ;; esac

if [ -n "$CDN" ]; then
  info edge-present "Edge detected: ${CDN}"
else
  info edge-absent "No CDN/WAF detected — origin is served directly" \
    "Not a defect by itself. It means the origin IS the edge, so origin-side controls are the only controls."
fi

# ── 3. Origin exposure ───────────────────────────────────────────────────────
# The core bypass test. Only a finding when an edge exists to be bypassed.
section "3. Origin exposure"

# curl's -w already emits 000 on a failed connection; a `|| printf 000` fallback
# would concatenate a second one. Normalise anything non-numeric instead.
http_code() { # url [curl args...]
  local url="$1" out; shift
  out=$($CURL -k -o /dev/null -w '%{http_code}' "$@" "$url" 2>/dev/null)
  case "$out" in ''|*[!0-9]*) printf '000' ;; *) printf '%s' "$out" ;; esac
}

probe_ip() { # ip scheme -> http_code (000 = refused/dropped)
  http_code "${2}://${1}/" -H "Host: ${DOMAIN}"
}

if [ -n "$ORIGIN_IP" ]; then
  IP_HTTP=$(probe_ip "$ORIGIN_IP" http)
  IP_HTTPS=$(probe_ip "$ORIGIN_IP" https)
  info origin-probe "Direct-IP probe ${ORIGIN_IP} — http:${IP_HTTP} https:${IP_HTTPS}"

  if [ -n "$CDN" ]; then
    # An edge exists: the published A record should BE the edge, and the true
    # origin should refuse anything that did not come through it.
    if [ "$IP_HTTPS" = "200" ] || [ "$IP_HTTP" = "200" ]; then
      fail origin-bypass "Origin answers direct requests while ${CDN} fronts the domain" \
        "Every WAF/rate-limit/bot rule at the edge is bypassable. Whitelist the edge's published ranges at the origin firewall."
    else
      pass origin-locked "Direct-IP requests are not served (http:${IP_HTTP} https:${IP_HTTPS})"
    fi
  else
    if [ "$IP_HTTPS" = "000" ]; then
      pass origin-sni "Origin refuses HTTPS without matching SNI" \
        "Unknown-Host requests are dropped rather than served."
    else
      warn origin-any-host "Origin serves HTTPS for a spoofed Host header (${IP_HTTPS})" \
        "Add a default-deny server block: ssl_reject_handshake on; return 444;"
    fi
  fi
else
  warn origin-unknown "Could not determine an origin IP to probe"
fi

# ── 4. TLS ───────────────────────────────────────────────────────────────────
section "4. TLS"

CERT=$(printf '' | openssl s_client -connect "${DOMAIN}:443" -servername "$DOMAIN" 2>/dev/null)
if printf '%s' "$CERT" | grep -q 'BEGIN CERTIFICATE'; then
  PEM=$(printf '%s' "$CERT" | openssl x509 2>/dev/null)
  ISSUER=$(printf '%s' "$PEM" | openssl x509 -noout -issuer 2>/dev/null | sed 's/^issuer=//')
  SUBJECT=$(printf '%s' "$PEM" | openssl x509 -noout -subject 2>/dev/null | sed 's/^subject=//')
  ENDDATE=$(printf '%s' "$PEM" | openssl x509 -noout -enddate 2>/dev/null | sed 's/^notAfter=//')
  info tls-issuer "Issuer: ${ISSUER}"
  info tls-subject "Subject: ${SUBJECT} · expires ${ENDDATE}"

  if printf '%s' "$PEM" | openssl x509 -noout -checkend 0 >/dev/null 2>&1; then
    if printf '%s' "$PEM" | openssl x509 -noout -checkend 1209600 >/dev/null 2>&1; then
      pass tls-validity "Certificate valid for at least 14 more days"
    else
      warn tls-expiring "Certificate expires within 14 days" "$ENDDATE"
    fi
  else
    fail tls-expired "Certificate is expired" "$ENDDATE"
  fi

  # Flexible SSL is only possible when an edge terminates TLS separately.
  if [ -n "$CDN" ]; then
    if [ -n "$ORIGIN_IP" ] && [ "$IP_HTTPS" = "000" ] && [ "$IP_HTTP" = "200" ]; then
      fail tls-flexible "Origin serves plaintext HTTP but not HTTPS behind ${CDN}" \
        "This is the Flexible-SSL failure mode: edge-to-origin traffic is unencrypted. Install an origin certificate and set Full (Strict)."
    else
      pass tls-endtoend "Origin speaks TLS — edge-to-origin can be encrypted"
    fi
  else
    pass tls-direct "Single TLS hop, browser to origin — no edge-to-origin gap exists"
  fi

  if printf '%s' "$ISSUER" | grep -qi 'cloudflare'; then
    info tls-origin-cert "Cloudflare Origin Certificate in use" \
      "Long-lived (~15y). Certificate-expiry monitors tuned for 90-day ACME will not be meaningful here."
  fi
else
  fail tls-handshake "Could not complete a TLS handshake with ${DOMAIN}:443"
fi

# ── 5. Email vectors ─────────────────────────────────────────────────────────
# Mail that originates on the origin host leaks its IP in Received: headers.
section "5. Email and DNS policy records"

MX=$(dig +short "$DOMAIN" MX 2>/dev/null | tr '\n' ' ' | sed 's/ $//')
SPF=$(dig +short "$DOMAIN" TXT 2>/dev/null | grep -i 'v=spf1' | head -1)
DMARC=$(dig +short "_dmarc.${DOMAIN}" TXT 2>/dev/null | head -1)
CAA=$(dig +short "$DOMAIN" CAA 2>/dev/null | tr '\n' ' ' | sed 's/ $//')

if [ -n "$MX" ]; then
  info mail-mx "MX: ${MX}"
  MX_IPS=""
  for host in $(printf '%s' "$MX" | awk '{for(i=2;i<=NF;i+=2) print $i}'); do
    MX_IPS="${MX_IPS} $(dig +short "${host%.}" A 2>/dev/null | tr '\n' ' ')"
  done
  if [ -n "$ORIGIN_IP" ] && printf '%s' "$MX_IPS" | grep -qF "$ORIGIN_IP"; then
    fail mail-origin "An MX record resolves to the origin IP (${ORIGIN_IP})" \
      "Mail handled on the origin publishes that IP in message headers — a direct origin-discovery path."
  else
    pass mail-offhost "Mail is handled off-origin" "No MX resolves to the origin IP."
  fi
else
  info mail-nomx "No MX records"
fi

[ -n "$SPF" ] && pass mail-spf "SPF present" "$SPF" \
  || warn mail-spf-missing "No SPF record" "Without SPF, the domain is easier to spoof in phishing that targets your users."

if [ -n "$DMARC" ]; then
  case "$DMARC" in
    *p=reject*)     pass mail-dmarc "DMARC policy: reject" "$DMARC" ;;
    *p=quarantine*) pass mail-dmarc "DMARC policy: quarantine" "$DMARC" ;;
    *p=none*)       warn mail-dmarc-none "DMARC is monitor-only (p=none)" "$DMARC — no message is ever rejected on failure." ;;
    *)              warn mail-dmarc-odd "DMARC present but policy unclear" "$DMARC" ;;
  esac
else
  warn mail-dmarc-missing "No DMARC record"
fi

[ -n "$CAA" ] && pass dns-caa "CAA present" "$CAA" \
  || warn dns-caa-missing "No CAA record" "Any CA may issue for this domain."

# ── 6. Subdomain sweep ───────────────────────────────────────────────────────
# The classic leak: apex behind a CDN, some forgotten subdomain pointing at the
# origin. Also surfaces which hosts share one box.
section "6. Subdomain sweep"

DEFAULT_SUBS="www api staging admin app dev test mail smtp webmail cpanel ftp vpn direct origin server cdn static assets blog docs status git grafana db"
SUBS="$DEFAULT_SUBS"
[ -n "$EXTRA_SUBS" ] && SUBS="$SUBS $(printf '%s' "$EXTRA_SUBS" | tr ',' ' ')"

SHARED=""
LEAKED=""
for sub in $SUBS; do
  sip=$(dig +short "${sub}.${DOMAIN}" A 2>/dev/null | grep -E '^[0-9]+\.' | head -1)
  [ -z "$sip" ] && continue
  if [ -n "$ORIGIN_IP" ] && [ "$sip" = "$ORIGIN_IP" ]; then
    SHARED="${SHARED} ${sub}"
    [ -n "$CDN" ] && LEAKED="${LEAKED} ${sub}"
  else
    info sub-found "${sub}.${DOMAIN} → ${sip}"
  fi
done

if [ -n "$LEAKED" ]; then
  fail sub-leak "Subdomain(s) point at the origin while ${CDN} fronts the apex:${LEAKED}" \
    "Each is a direct route around the edge. Proxy them or move them off the origin host."
elif [ -n "$SHARED" ]; then
  info sub-shared "Hosts sharing the origin IP:${SHARED}" \
    "Expected without a CDN. Note the shared blast radius: one compromise or one flood affects all of them."
fi

# ── 7. Security headers ──────────────────────────────────────────────────────
section "7. Security headers"

check_header() { # header-substring label id
  if printf '%s' "$HDR_LC" | grep -q "^$1"; then pass "$3" "$2 present"
  else warn "$3" "$2 missing"; fi
}
if [ -n "$HEADERS" ]; then
  check_header "strict-transport-security" "HSTS" hdr-hsts
  check_header "x-content-type-options"    "X-Content-Type-Options" hdr-xcto
  check_header "referrer-policy"           "Referrer-Policy" hdr-ref
  check_header "permissions-policy"        "Permissions-Policy" hdr-perm
  check_header "content-security-policy"   "Content-Security-Policy" hdr-csp
  if printf '%s' "$HDR_LC" | grep -qE '^server: (nginx/[0-9]|apache/[0-9])'; then
    warn hdr-server-tokens "Server header leaks software version" \
      "$(printf '%s' "$HEADERS" | grep -i '^server:' | tr -d '\r') — set server_tokens off;"
  else
    pass hdr-server-tokens "Server header does not leak a version"
  fi
else
  fail hdr-none "Could not fetch headers from https://${DOMAIN}/"
fi

# ── 8. Active probes ─────────────────────────────────────────────────────────
if [ "$ACTIVE" -eq 1 ]; then
  section "8. Active probes (scanner paths, rate limiting)"

  BLACKHOLED=0; SERVED=""
  for path in "/.env" "/.git/config" "/wp-login.php" "/phpinfo.php" "/actuator/env"; do
    code=$(http_code "https://${DOMAIN}${path}")
    if [ "$code" = "000" ] || [ "$code" = "444" ]; then
      BLACKHOLED=$((BLACKHOLED+1))
    else
      SERVED="${SERVED} ${path}:${code}"
    fi
  done
  if [ "$BLACKHOLED" -ge 4 ]; then
    pass probe-blackhole "Scanner paths are dropped at the edge (${BLACKHOLED}/5)"
  else
    warn probe-blackhole "Only ${BLACKHOLED}/5 scanner paths dropped" \
      "Answered:${SERVED} — each response is a signal that keeps scanners coming back."
  fi

  BURST_429=0
  for _ in $(seq 1 40); do
    c=$(http_code "https://${DOMAIN}/")
    [ "$c" = "429" ] && BURST_429=$((BURST_429+1))
  done
  if [ "$BURST_429" -gt 0 ]; then
    pass probe-ratelimit "Rate limiting engaged (${BURST_429}/40 requests got 429)"
  else
    warn probe-ratelimit "No 429 seen in a 40-request burst" \
      "Either the limit is above this rate (likely, and fine) or no per-IP limit is configured. Confirm against the gateway config."
  fi
else
  section "8. Active probes"
  info probe-skipped "Skipped — pass --active to run them" \
    "Only use --active against domains you own or are authorised to test."
fi

# ── Summary ──────────────────────────────────────────────────────────────────
printf '\n%s%s%s\n' "$BLU" "Summary" "$NC"
printf '  %s%d passed%s · %s%d warnings%s · %s%d failures%s · %d informational\n' \
  "$GRN" "$PASS_N" "$NC" "$YLW" "$WARN_N" "$NC" "$RED" "$FAIL_N" "$NC" "$INFO_N"

if [ -n "$JSON_OUT" ]; then
  {
    printf '{"domain":"%s","generatedAt":"%s","originIp":"%s","edge":"%s",' \
      "$(_json_escape "$DOMAIN")" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
      "$(_json_escape "$ORIGIN_IP")" "$(_json_escape "${CDN:-none}")"
    printf '"counts":{"pass":%d,"warn":%d,"fail":%d,"info":%d},' "$PASS_N" "$WARN_N" "$FAIL_N" "$INFO_N"
    printf '"findings":[%s]}' "${JSON_ROWS%,}"
  } > "$JSON_OUT"
  printf '  %sJSON written to %s%s\n' "$DIM" "$JSON_OUT" "$NC"
fi

[ "$FAIL_N" -gt 0 ] && exit 2
[ "$WARN_N" -gt 0 ] && { [ "$STRICT" -eq 1 ] && exit 2; exit 1; }
exit 0
