# Phase 6: Error Handling & Validation

## Overview
Phase 6 implements comprehensive error handling, input validation, and rate limiting to ensure robust operation and prevent abuse of the LogScope API.

## Implementation Summary

### 1. Backend Input Validation (`server/src/api/middleware/validation.ts`)

#### Rate Limiting Middleware
- **Limit:** 100 requests per minute per IP address
- **Window:** 60 seconds (rolling window)
- **Response Headers:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Status Code:** 429 (Too Many Requests) when exceeded
- **Implementation:** In-memory store with automatic cleanup

#### Log Entry Validation (`validateLogEntry`)
Validates all fields required by the LogEntry schema:

**Timestamp Validation:**
- Required field
- Must be valid ISO 8601 format
- Returns 400 with `INVALID_TIMESTAMP` error code

**Log Level Validation:**
- Required field
- Must be one of: `debug`, `info`, `warn`, `error`, `success`
- Returns 400 with `INVALID_LEVEL` error code

**Subject Validation:**
- Required field
- Must be non-empty string
- Maximum 255 characters
- Returns 400 with `INVALID_SUBJECT` or `SUBJECT_TOO_LONG` error codes

**Source Runtime Validation:**
- Required field in source object
- Must be `node` or `browser`
- Returns 400 with `INVALID_RUNTIME` error code

**Content Size Validation:**
- Log content limited to 10KB
- Returns 413 with `CONTENT_TOO_LARGE` error code

#### Search Parameter Validation (`validateSearchParams`)
Validates query parameters for GET /api/logs/search:

**Time Range Validation:**
- `timeFrom` and `timeTo` must be valid ISO 8601 if provided
- Returns 400 with `INVALID_TIME_RANGE` error code

**Pagination Validation:**
- `limit`: 1-1000 (default: 100)
- `offset`: non-negative integer (default: 0)
- Returns 400 with `INVALID_LIMIT` or `INVALID_OFFSET` error codes

### 2. Route Middleware Integration

**POST /api/logs/collect**
- Applied: `rateLimitMiddleware` → `validateLogEntry` → handler
- Flow: Rate limit check → Field validation → Processing → Response

**GET /api/logs/search**
- Applied: `validateSearchParams` → handler
- Flow: Query parameter validation → Query execution → Response

### 3. Request Size Limiting

**Express Configuration (`server/src/index.ts`):**
```typescript
app.use(express.json({ limit: "1mb" }));
```

- **Limit:** 1 MB per request body
- **Status Code:** 413 (Payload Too Large) when exceeded
- **Error Code:** `PAYLOAD_TOO_LARGE`

### 4. Error Handler Middleware Enhancement

**File:** `server/src/api/middleware/errorHandler.ts`

Handles specific error cases:
- **Payload Too Large:** Returns 413 with `PAYLOAD_TOO_LARGE`
- **JSON Parse Errors:** Returns 400 with `INVALID_JSON`
- **Generic Errors:** Returns 500 with `INTERNAL_SERVER_ERROR`

### 5. Frontend Error Handling & Retry Logic

**File:** `web/src/api/logsService.ts`

#### Retry Configuration
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 200,
  maxDelayMs: 3000,
  backoffMultiplier: 2,
}
```

#### Retry Behavior
- **Transient Failures:** Network errors, 5xx, 429 (rate limit)
- **No Retry:** 4xx errors (except 429)
- **Backoff:** Exponential backoff with jitter-like delay
- **Max Wait:** ~3 seconds between retries

#### API Methods with Retry
- `searchLogs()`: Retries on failure, handles rate limits gracefully
- `getLogById()`: Retries transient failures
- `getCorrelatedByRequestId()`: Retries transient failures
- `getCorrelatedBySessionId()`: Retries transient failures

#### WebSocket Reconnection
- **Max Reconnect Attempts:** 5
- **Backoff:** Exponential (1s, 1.5s, 2.25s, 3.38s, 5.06s)
- **Max Wait:** 30 seconds
- **Auto Recovery:** Closes gracefully after max attempts

### 6. Frontend Error Display (`web/src/App.tsx`)

**Error State Structure:**
```typescript
interface ErrorState {
  message: string
  code?: string
  isRateLimit?: boolean
}
```

**Error Display Features:**
- **Rate Limit Detection:** Shows warning (yellow) instead of danger (red)
- **Contextual Help:** "Please wait a moment" for rate limit errors
- **Error Codes:** Displayed for debugging
- **Dismissible Alerts:** User can close error messages

## Testing Recommendations

### Rate Limiting Test
```bash
# Test rate limit with 101 requests in quick succession
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/logs/collect \
    -H "Content-Type: application/json" \
    -d '{"timestamp":"2024-01-01T00:00:00Z","level":"info","subject":"test","source":{"runtime":"node"}}' &
done
wait

# Should see 429 status on request 101
```

### Validation Test
```bash
# Test invalid timestamp
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"not-a-date","level":"info","subject":"test","source":{"runtime":"node"}}'
# Expect 400 with INVALID_TIMESTAMP

# Test invalid level
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2024-01-01T00:00:00Z","level":"fatal","subject":"test","source":{"runtime":"node"}}'
# Expect 400 with INVALID_LEVEL

# Test missing subject
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2024-01-01T00:00:00Z","level":"info","source":{"runtime":"node"}}'
# Expect 400 with INVALID_SUBJECT

# Test invalid runtime
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2024-01-01T00:00:00Z","level":"info","subject":"test","source":{"runtime":"invalid"}}'
# Expect 400 with INVALID_RUNTIME
```

### Payload Size Test
```bash
# Test oversized payload (> 1MB)
dd if=/dev/zero of=/tmp/bigpayload.json bs=1M count=2
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d @/tmp/bigpayload.json
# Expect 413 with PAYLOAD_TOO_LARGE

# Test oversized content field (> 10KB)
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"2024-01-01T00:00:00Z",
    "level":"info",
    "subject":"test",
    "content":"'$(python3 -c "print(\"x\"*11000)\"'",
    "source":{"runtime":"node"}
  }'
# Expect 413 with CONTENT_TOO_LARGE
```

### Search Parameter Validation Test
```bash
# Test invalid time range
curl "http://localhost:3000/api/logs/search?timeFrom=not-a-date"
# Expect 400 with INVALID_TIME_RANGE

# Test invalid limit
curl "http://localhost:3000/api/logs/search?limit=99999"
# Expect 400 with INVALID_LIMIT

# Test invalid offset
curl "http://localhost:3000/api/logs/search?offset=-1"
# Expect 400 with INVALID_OFFSET
```

### Frontend Retry Test
```bash
# Monitor browser console while:
# 1. Stop backend server briefly
# 2. Try to load logs in UI
# 3. Restart backend server
# 
# Should see:
# - Network error message
# - Automatic retries in console
# - Recovery when backend restarts
```

## API Response Contracts

### Success Response (2xx)
```json
{
  "success": true,
  "data": { /* LogEntry[] or LogEntry */ },
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

### Error Response (4xx, 5xx)
```json
{
  "success": false,
  "error": "Human-readable error message",
  "errorCode": "MACHINE_READABLE_CODE"
}
```

## Error Codes Reference

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_TIMESTAMP` | 400 | Timestamp missing or invalid ISO 8601 format |
| `INVALID_LEVEL` | 400 | Log level not in enum (debug, info, warn, error, success) |
| `INVALID_SUBJECT` | 400 | Subject missing or empty |
| `SUBJECT_TOO_LONG` | 400 | Subject exceeds 255 characters |
| `INVALID_RUNTIME` | 400 | Source.runtime must be 'node' or 'browser' |
| `INVALID_SOURCE` | 400 | Source object missing or invalid |
| `CONTENT_TOO_LARGE` | 413 | Log content exceeds 10KB |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeds 1MB |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from this IP (>100/min) |
| `INVALID_TIME_RANGE` | 400 | TimeFrom or timeTo not ISO 8601 |
| `INVALID_LIMIT` | 400 | Limit not 1-1000 |
| `INVALID_OFFSET` | 400 | Offset negative or non-integer |
| `INVALID_JSON` | 400 | Request body is not valid JSON |
| `SERVER_ERROR` | 500 | Internal server error |
| `NETWORK_ERROR` | 0 | Frontend network connectivity issue |

## Limits Summary

| Limit | Value | Applied |
|-------|-------|---------|
| Rate Limit | 100 req/min per IP | POST /api/logs/collect |
| Request Size | 1 MB | All requests |
| Content Size | 10 KB | Log entry content field |
| Subject Length | 255 chars | Log entry subject field |
| Query Limit | 1000 max | GET /api/logs/search |
| Default Queries | 100 per page | GET /api/logs/search |

## Deployment Considerations

1. **Rate Limiting:** In-memory store is not suitable for multi-server deployments. For production:
   - Use Redis-based rate limiting (e.g., `express-rate-limit` with redis store)
   - Or use API gateway rate limiting

2. **Error Monitoring:** Consider integrating error tracking:
   - Sentry for error reporting
   - Structured logging for audit trail
   - Server-side error statistics

3. **Client-Side Resilience:**
   - Retry logic automatically handles transient failures
   - WebSocket reconnection is automatic
   - Users see helpful error messages with guidance

4. **Security:**
   - All inputs validated before processing
   - No execution of untrusted content
   - Rate limiting prevents DOS attacks
   - Size limits prevent memory exhaustion

## Continuation to Phase 7

Phase 6 completes error handling and validation. Next phase (Phase 7) will focus on:
- OpenAPI/Swagger documentation
- Getting started guide
- Environment configuration documentation
- Deployment instructions
