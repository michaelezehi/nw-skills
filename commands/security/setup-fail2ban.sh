#!/bin/bash
# =============================================================================
# Setup fail2ban for automatic scanner/bot IP banning
# Run once on a new server after Docker gateway is started.
# Replace PROJECT_NAME with your actual project name before running.
# =============================================================================

set -e

PROJECT_NAME="${1:-myproject}"  # Pass project name as first argument
LOG_DIR="/var/log/$PROJECT_NAME/nginx"

echo "=== Setting up fail2ban for $PROJECT_NAME ==="

apt-get install -y fail2ban iptables-persistent -q

mkdir -p "$LOG_DIR"

cat > /etc/fail2ban/filter.d/nginx-scanner.conf << 'FILTER'
[Definition]
failregex = ^<HOST> - [^"]* \[.*?\] "(?:GET|POST|HEAD|PUT|DELETE|OPTIONS|PATCH) (?:/\.env|/\.git|/\.aws|/aws/|/s3[./]|/s3/|/terraform|/docker-compose|/Dockerfile|/__debug|/metrics(?:/|$)|/healthz(?:/|$)|/wp-json/|/wp-login|/wp-admin|/wp-content|/wp-includes|/rest/(?:workflows|executions|node-types|users|credentials|tags|variables|license|login|logout)|/api/v1/credentials|/var/task/|/var/log/|/root/|/etc/boto|/aws\.(?:yaml|yml|json|env)|/s3\.(?:yml|yaml|key|secret)|/serverless\.(?:yml|yaml)|/terraform\.(?:tfstate|tfvars)|/\.boto|/\.s3cfg|\.php(?:\?|$| ))[^\s]* HTTP
ignoreregex =
FILTER

cat > /etc/fail2ban/action.d/nginx-docker-ban.conf << 'ACTION'
[Definition]
actionstart =
actionstop =
actioncheck =
actionban = iptables -I DOCKER-USER 1 -s <ip> -j DROP && echo "$(date -u): BANNED <ip> (fail2ban nginx-scanner)" >> /var/log/fail2ban-bans.log
actionunban = iptables -D DOCKER-USER -s <ip> -j DROP
ACTION

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

cat > /etc/fail2ban/jail.d/nginx-scanner.conf << JAIL
[nginx-scanner]
enabled  = true
filter   = nginx-scanner
action   = nginx-docker-ban
logpath  = $LOG_DIR/access.log
backend  = polling
maxretry = 3
findtime = 60
bantime  = 86400
ignoreip = 127.0.0.1/8 ::1 172.16.0.0/12 $SERVER_IP
JAIL

systemctl enable fail2ban
systemctl restart fail2ban

sleep 2
echo ""
echo "=== fail2ban status ==="
fail2ban-client status nginx-scanner

echo ""
echo "=== Setup complete ==="
echo "Scanners hitting 3+ suspicious paths in 60s → banned for 24h"
echo "Ban log: /var/log/fail2ban-bans.log"
echo "Status:  fail2ban-client status nginx-scanner"
echo "Unban:   fail2ban-client set nginx-scanner unbanip <IP>"
