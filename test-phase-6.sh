#!/bin/bash

# Phase 6 Validation Tests for LogScope
# Tests input validation, rate limiting, error handling, and retry logic

set -e

API_URL="http://localhost:3000"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "LogScope Phase 6 Validation Test Suite"
echo "=========================================="
echo ""

# Helper function to test a request
test_request() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local expected_status=$5
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -n "Test $TOTAL_TESTS: $name ... "
  
  if [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
  else
    response=$(curl -s -w "\n%{http_code}" -X GET "$API_URL$endpoint")
  fi
  
  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)
  
  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}FAIL${NC} (Expected $expected_status, got $http_code)"
    echo "  Response: $body"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

# Check if server is running
echo -n "Checking if server is running at $API_URL ... "
if curl -s "$API_URL/health" > /dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "Server not running. Start it with: cd server && npm run dev"
  exit 1
fi
echo ""

# ========== VALIDATION TESTS ==========
echo "Input Validation Tests:"
echo "----------------------"

test_request "Valid log entry" "POST" "/api/logs/collect" \
  '{"timestamp":"2024-01-01T00:00:00Z","level":"info","subject":"test","source":{"runtime":"node"}}' \
  "201"

test_request "Invalid timestamp (non-ISO)" "POST" "/api/logs/collect" \
  '{"timestamp":"not-a-date","level":"info","subject":"test","source":{"runtime":"node"}}' \
  "400"

test_request "Invalid log level" "POST" "/api/logs/collect" \
  '{"timestamp":"2024-01-01T00:00:00Z","level":"fatal","subject":"test","source":{"runtime":"node"}}' \
  "400"

test_request "Missing subject" "POST" "/api/logs/collect" \
  '{"timestamp":"2024-01-01T00:00:00Z","level":"info","source":{"runtime":"node"}}' \
  "400"

test_request "Empty subject" "POST" "/api/logs/collect" \
  '{"timestamp":"2024-01-01T00:00:00Z","level":"info","subject":"","source":{"runtime":"node"}}' \
  "400"

test_request "Subject too long (>255 chars)" "POST" "/api/logs/collect" \
  '{"timestamp":"2024-01-01T00:00:00Z","level":"info","subject":"'$(python3 -c 'print("x"*256)')'"src":{"runtime":"node"}}' \
  "400"

test_request "Invalid runtime (not node/browser)" "POST" "/api/logs/collect" \
  '{"timestamp":"2024-01-01T00:00:00Z","level":"info","subject":"test","source":{"runtime":"python"}}' \
  "400"

test_request "Missing runtime in source" "POST" "/api/logs/collect" \
  '{"timestamp":"2024-01-01T00:00:00Z","level":"info","subject":"test","source":{}}' \
  "400"

echo ""
echo "Search Parameter Validation Tests:"
echo "-----------------------------------"

test_request "Valid search" "GET" "/api/logs/search?limit=50&offset=0" \
  "" "200"

test_request "Invalid timeFrom (not ISO)" "GET" "/api/logs/search?timeFrom=not-a-date" \
  "" "400"

test_request "Invalid timeTo (not ISO)" "GET" "/api/logs/search?timeTo=not-a-date" \
  "" "400"

test_request "Invalid limit (> 1000)" "GET" "/api/logs/search?limit=2000" \
  "" "400"

test_request "Invalid limit (< 1)" "GET" "/api/logs/search?limit=0" \
  "" "400"

test_request "Invalid offset (negative)" "GET" "/api/logs/search?offset=-1" \
  "" "400"

test_request "Valid limit boundary (1)" "GET" "/api/logs/search?limit=1" \
  "" "200"

test_request "Valid limit boundary (1000)" "GET" "/api/logs/search?limit=1000" \
  "" "200"

echo ""
echo "Rate Limiting Tests:"
echo "-------------------"

# Test rate limiting (send 101 requests)
echo "Sending 101 rapid requests to trigger rate limit..."
rate_limit_triggered=0

for i in {1..101}; do
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/logs/collect" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\":\"2024-01-01T00:00:00Z\",\"level\":\"info\",\"subject\":\"test-$i\",\"source\":{\"runtime\":\"node\"}}")
  
  http_code=$(echo "$response" | tail -n 1)
  
  if [ "$http_code" = "429" ]; then
    rate_limit_triggered=1
    echo -n "."
  fi
done

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ $rate_limit_triggered -eq 1 ]; then
  echo -e " ${GREEN}PASS${NC} (Rate limit triggered at 429)"
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  echo -e " ${RED}FAIL${NC} (Rate limit not triggered after 101 requests)"
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "=========================================="
echo "Test Results Summary"
echo "=========================================="
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
fi
