#!/bin/bash

# LogScope Quick Start Configuration Script
# This script helps you start LogScope with custom configuration

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
BACKEND_CLEANUP_INTERVAL=10000
BACKEND_LOG_MAX_TOTAL=500
BACKEND_LOG_MAX_AGE=3600000
BACKEND_LOG_DELETE_COUNT=100

# Ask for backend port
read -p "Enter backend port [default: $BACKEND_PORT]: " user_backend_port
BACKEND_PORT=${user_backend_port:-$BACKEND_PORT}

echo ""
echo -e "${YELLOW}Auto-Cleanup Configuration:${NC}"
echo ""

# Ask for cleanup interval
read -p "Cleanup check interval in milliseconds [default: $BACKEND_CLEANUP_INTERVAL (10 sec)]: " user_cleanup_interval
BACKEND_CLEANUP_INTERVAL=${user_cleanup_interval:-$BACKEND_CLEANUP_INTERVAL}

# Ask for max total logs
read -p "Maximum logs before cleanup triggers [default: $BACKEND_LOG_MAX_TOTAL]: " user_log_max_total
BACKEND_LOG_MAX_TOTAL=${user_log_max_total:-$BACKEND_LOG_MAX_TOTAL}

# Ask for log max age
read -p "Delete logs older than (milliseconds) [default: $BACKEND_LOG_MAX_AGE (1 hour)]: " user_log_max_age
BACKEND_LOG_MAX_AGE=${user_log_max_age:-$BACKEND_LOG_MAX_AGE}

# Ask for delete count
read -p "Logs to delete per cleanup [default: $BACKEND_LOG_DELETE_COUNT]: " user_log_delete_count
BACKEND_LOG_DELETE_COUNT=${user_log_delete_count:-$BACKEND_LOG_DELETE_COUNT}

echo ""
echo -e "${GREEN}Configuration:${NC}"
echo "  Backend:  http://localhost:$BACKEND_PORT"
echo "  Frontend (for development only): http://localhost:5173"
echo ""
echo -e "${GREEN}Cleanup Settings:${NC}"
echo "  Check interval: ${BACKEND_CLEANUP_INTERVAL}ms"
echo "  Capacity limit: $BACKEND_LOG_MAX_TOTAL logs"
echo "  Delete age: ${BACKEND_LOG_MAX_AGE}ms"
echo "  Delete count: $BACKEND_LOG_DELETE_COUNT logs per cleanup"
echo ""

# Copy .env.example to .env (overwrite) and update values
echo -e "${YELLOW}Copying .env.example → .env (overwriting)${NC}"
cp .env.example .env

# Update ports in .env
if command -v sed &> /dev/null; then
    sed -i.bak "s/PORT=3000/PORT=$BACKEND_PORT/" .env
    sed -i.bak "s|VITE_API_URL=http://localhost:3000|VITE_API_URL=http://localhost:$BACKEND_PORT|" .env
    sed -i.bak "s/CLEANUP_INTERVAL_MS=.*/CLEANUP_INTERVAL_MS=$BACKEND_CLEANUP_INTERVAL/" .env
    sed -i.bak "s/LOG_MAX_TOTAL=.*/LOG_MAX_TOTAL=$BACKEND_LOG_MAX_TOTAL/" .env
    sed -i.bak "s/LOG_MAX_AGE_MS=.*/LOG_MAX_AGE_MS=$BACKEND_LOG_MAX_AGE/" .env
    sed -i.bak "s/LOG_DELETE_COUNT=.*/LOG_DELETE_COUNT=$BACKEND_LOG_DELETE_COUNT/" .env
    rm .env.bak 2>/dev/null || true
    echo -e "${GREEN}✓ Updated .env file${NC}"
fi

echo ""
echo -e "${GREEN}✓ Configuration complete!${NC}"
echo ""
