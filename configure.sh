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
FRONTEND_PORT=5173

# Ask user for custom ports
read -p "Enter backend port [default: $BACKEND_PORT]: " user_backend_port
BACKEND_PORT=${user_backend_port:-$BACKEND_PORT}

read -p "Enter frontend port [default: $FRONTEND_PORT]: " user_frontend_port
FRONTEND_PORT=${user_frontend_port:-$FRONTEND_PORT}

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
fi

# Update ports in .env
if command -v sed &> /dev/null; then
    sed -i.bak "s/PORT=3000/PORT=$BACKEND_PORT/" .env
    sed -i.bak "s/VITE_PORT=5173/VITE_PORT=$FRONTEND_PORT/" .env
    sed -i.bak "s|VITE_API_URL=http://localhost:3000|VITE_API_URL=http://localhost:$BACKEND_PORT|" .env
    rm .env.bak 2>/dev/null || true
    echo -e "${GREEN}✓ Updated .env file${NC}"
fi

echo ""
echo -e "${CYAN}Starting LogScope...${NC}"
echo ""
echo -e "${YELLOW}You need to run these commands in separate terminals:${NC}"
echo ""
echo -e "${GREEN}Terminal 1 (Backend):${NC}"
echo "  cd server && npm run dev"
echo ""
echo -e "${GREEN}Terminal 2 (Frontend):${NC}"
echo "  cd web && npm run dev"
echo ""
echo -e "${CYAN}Then open: http://localhost:$FRONTEND_PORT${NC}"
echo ""
echo -e "${YELLOW}---${NC}"
echo "Tip: You can also run them with custom ports directly:"
echo "  PORT=$BACKEND_PORT npm run dev        # Backend"
echo "  VITE_PORT=$FRONTEND_PORT npm run dev  # Frontend"
echo ""
