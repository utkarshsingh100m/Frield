#!/bin/bash
# ═══════════════════════════════════════════════
#  Frield — Setup Script
#  Run this script to install Node.js and start
# ═══════════════════════════════════════════════

set -e

echo ""
echo "  🛡  FRIELD Setup"
echo "  ═══════════════════════"
echo ""

# ── Check for Node.js ──────────────────────────
if ! command -v node &>/dev/null; then
  echo "📦 Node.js not found. Installing via nvm..."

  # Install nvm
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

  # Source nvm
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  # Install Node.js v20 (LTS compatible with better-sqlite3)
  nvm install 20
  nvm use 20

  echo "✅ Node.js installed: $(node --version)"
else
  echo "✅ Node.js found: $(node --version)"
fi

# ── Install npm dependencies ────────────────────
echo ""
echo "📦 Installing npm packages..."
npm install

# ── Seed database ──────────────────────────────
echo ""
echo "🌱 Seeding database with demo data..."
node db/seed.js

# ── Done ────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Frield is ready!"
echo ""
echo "  Start the server:"
echo "    node server.js"
echo ""
echo "  Open in browser:"
echo "    http://localhost:3000"
echo "═══════════════════════════════════════════"
echo ""
