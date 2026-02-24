#!/bin/bash
# clear-logs.sh — Permanently delete all LogScope log entries via the API.
#
# Usage:
#   ./clear-logs.sh [options]
#
# Options:
#   -y, --yes           Skip the confirmation prompt
#   --keep-starred      Keep pinned (starred) logs, delete everything else
#   --port PORT         Backend port (default: 8000)
#   --host HOST         Backend host (default: localhost)
#   -h, --help          Show this help message

set -euo pipefail

# Defaults
PORT=8000
HOST="localhost"
SKIP_CONFIRM=false
KEEP_STARRED=false

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

print_usage() {
  sed -n '/^# Usage/,/^[^#]/p' "$0" | head -n -1 | sed 's/^# \?//'
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)           SKIP_CONFIRM=true ;;
    --keep-starred)     KEEP_STARRED=true ;;
    --port)             PORT="$2"; shift ;;
    --host)             HOST="$2"; shift ;;
    -h|--help)          print_usage; exit 0 ;;
    *) echo "Unknown option: $1"; print_usage; exit 1 ;;
  esac
  shift
done

API_URL="http://${HOST}:${PORT}"

echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║         LogScope — Clear All Logs         ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Target: ${API_URL}"
if $KEEP_STARRED; then
  echo -e "  Pinned logs: ${GREEN}kept${NC}"
else
  echo -e "  Pinned logs: ${RED}also deleted${NC}"
fi
echo ""

if ! $SKIP_CONFIRM; then
  echo -e "${RED}⚠  WARNING: This will permanently delete log entries. This cannot be undone.${NC}"
  echo ""
  read -rp "  Type 'yes' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo ""
    echo "  Aborted."
    exit 0
  fi
  echo ""
fi

QUERY=""
$KEEP_STARRED && QUERY="?keepStarred=true"

echo -n "  Clearing logs…"
RESPONSE=$(curl -sf -X DELETE "${API_URL}/api/logs/all${QUERY}" \
  -H "Accept: application/json" 2>&1) || {
  echo ""
  echo -e "${RED}  ✗ Failed to reach ${API_URL}. Is the server running?${NC}"
  exit 1
}

# Parse response
DELETED=$(echo "$RESPONSE" | grep -o '"deleted":[0-9]*' | grep -o '[0-9]*' || echo "?")
KEPT=$(echo "$RESPONSE" | grep -o '"keptStarred":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo ""
echo -e "${GREEN}  ✓ Done.${NC}"
echo "    Deleted : ${DELETED} log(s)"
echo "    Kept    : ${KEPT} pinned log(s)"
echo ""
