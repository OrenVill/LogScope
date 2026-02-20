#!/bin/bash

# LogScope Quick Start Configuration Script
# This script helps you start LogScope with custom ports

set -e

# Colors for output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        LogScope Configuration          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# Default values
BACKEND_PORT=3000

# Ask user for custom backend port only
read -p "Enter backend port [default: $BACKEND_PORT]: " user_backend_port
BACKEND_PORT=${user_backend_port:-$BACKEND_PORT}

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  Frontend (for development only): http://localhost:5173"
echo ""

# Copy .env.example to .env (overwrite) and update values
echo -e "${YELLOW}Copying .env.example → .env (overwriting)${NC}"
cp .env.example .env

# Update ports in .env
if command -v sed &> /dev/null; then
    sed -i.bak "s/PORT=3000/PORT=$BACKEND_PORT/" .env
    sed -i.bak "s|VITE_API_URL=http://localhost:3000|VITE_API_URL=http://localhost:$BACKEND_PORT|" .env
    rm .env.bak 2>/dev/null || true
    echo -e "${GREEN}✓ Updated .env file${NC}"
fi

echo ""
echo -e "${GREEN}✓ .env updated — PORT=${BACKEND_PORT}${NC}"
echo ""
