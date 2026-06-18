#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Aegis Protocol — VPS Setup Script
# Run this on a fresh Ubuntu 22.04/24.04 VPS (Hetzner, etc.)
# Usage: curl -sSL <raw-github-url> | bash
# Or: scp this file to VPS and run: chmod +x setup-vps.sh && ./setup-vps.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

echo "═══════════════════════════════════════════════════"
echo "  Aegis Protocol — VPS Setup"
echo "═══════════════════════════════════════════════════"

# ─── 1. System Updates ────────────────────────────────────────
echo "[1/6] Updating system..."
apt-get update -qq && apt-get upgrade -y -qq

# ─── 2. Install Docker ───────────────────────────────────────
echo "[2/6] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "  ✓ Docker installed"
else
  echo "  ✓ Docker already installed"
fi

# ─── 3. Install Docker Compose ───────────────────────────────
echo "[3/6] Installing Docker Compose..."
if ! command -v docker compose &> /dev/null; then
  apt-get install -y -qq docker-compose-plugin
  echo "  ✓ Docker Compose installed"
else
  echo "  ✓ Docker Compose already installed"
fi

# ─── 4. Create app directory ─────────────────────────────────
echo "[4/6] Setting up app directory..."
mkdir -p /opt/aegis
cd /opt/aegis

# ─── 5. Clone repo ───────────────────────────────────────────
echo "[5/6] Cloning repository..."
if [ ! -d ".git" ]; then
  git clone https://github.com/Tonyflam/aegis-protocol.git .
else
  git pull origin main
fi

# ─── 6. Create .env file ─────────────────────────────────────
echo "[6/6] Setting up environment..."
if [ ! -f ".env" ]; then
  cat > .env << 'ENVEOF'
# ═══════════════════════════════════════════════════════════════
# Aegis Agent Environment Variables
# Fill in ALL values below before running docker compose up
# ═══════════════════════════════════════════════════════════════

# ─── Agent Wallet (REQUIRED) ──────────────────────────────────
# This is the OPERATOR wallet private key (no 0x prefix)
# This wallet executes harvests and stop-losses on behalf of users
# Fund it with ~0.1 BNB for gas
PRIVATE_KEY=

# ─── Contract Addresses (REQUIRED) ───────────────────────────
# After mainnet deployment, paste the addresses here
VAULT_ADDRESS=
REGISTRY_ADDRESS=
LOGGER_ADDRESS=

# ─── RPC (REQUIRED) ──────────────────────────────────────────
# BSC Mainnet RPC — use a private RPC for reliability
# Free options: https://bsc-datasec1.binance.org (public, rate limited)
# Better: Ankr, QuickNode, or NodeReal (free tiers available)
BSC_TESTNET_RPC=https://bsc-dataseed1.binance.org

# ─── AI Engine (REQUIRED for AI reasoning) ───────────────────
GROQ_API_KEY=

# ─── Agent Config ────────────────────────────────────────────
AGENT_ID=0
POLL_INTERVAL=30000
DRY_RUN=false

# ─── Cron Pinger (for monitoring endpoint) ───────────────────
APP_URL=https://aegisguardian.xyz
CRON_SECRET=
ENVEOF

  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "  IMPORTANT: Edit /opt/aegis/.env before starting!"
  echo "  nano /opt/aegis/.env"
  echo "═══════════════════════════════════════════════════"
  echo ""
else
  echo "  ✓ .env already exists"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit .env:    nano /opt/aegis/.env"
echo "  2. Start agent:  cd /opt/aegis && docker compose up -d"
echo "  3. Check logs:   docker compose logs -f aegis-agent"
echo "  4. Check health: docker compose ps"
echo "═══════════════════════════════════════════════════"
