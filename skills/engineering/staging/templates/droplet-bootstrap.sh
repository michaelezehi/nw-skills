#!/bin/bash
# Staging droplet bootstrap — run AFTER the droplet is up and SSH works.
#
# Recommended invocation (from your laptop):
#   ssh root@<DROPLET_IP> 'bash -s' < _r\&d/staging/droplet-bootstrap.sh
#
# Bootstraps: Docker, 4 GB swap, ufw firewall, fail2ban, Docker log rotation,
# /opt project root, and a shared 'staging-network' Docker network.

set -e

step() { echo ""; echo "=== [$(date +%H:%M:%S)] $* ==="; }

step "1/8  apt update + upgrade (slowest step — pulls all updates)"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' upgrade

step "2/8  install base packages"
apt-get install -y git curl ufw fail2ban htop ncdu unzip ca-certificates

step "3/8  install Docker + Compose plugin"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
apt-get install -y docker-compose-plugin

step "4/8  create 4 GB swap"
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  echo "swap already exists"
fi

step "5/8  configure ufw firewall (SSH first, then enable)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'ssh'
ufw allow 80/tcp comment 'http'
ufw allow 443/tcp comment 'https'
ufw --force enable
ufw status

step "6/8  enable fail2ban"
systemctl enable fail2ban
systemctl start fail2ban

step "7/8  Docker log rotation + restart"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker
sleep 2
docker --version

step "8/8  /opt root + shared staging-network"
mkdir -p /opt
chmod 755 /opt
docker network inspect staging-network >/dev/null 2>&1 || docker network create staging-network
docker network ls | grep staging-network

echo ""
echo "$(date -Iseconds) staging droplet bootstrap complete" | tee /root/.bootstrap-complete
echo ""
echo "=== ALL DONE ==="
free -m | head -2
df -h /
