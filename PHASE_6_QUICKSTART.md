# Phase 6: Error Handling & Validation - Quick Start Guide

## What's New in Phase 6

Phase 6 adds comprehensive error handling, input validation, and resilience features to ensure LogScope is production-ready with graceful error management.

## Key Features

### 1. **Input Validation**
- **Timestamp:** Must be valid ISO 8601 UTC format
- **Log Level:** Must be one of: `debug`, `info`, `warn`, `error`, `success`
- **Subject:** Required, non-empty, max 255 characters
- **Source Runtime:** Must be `node` or `browser`
- **Content:** Limited to 10KB per entry

### 2. **Rate Limiting**
- **Limit:** 100 requests per minute per IP
- **Status:** Returns 429 with error code `RATE_LIMIT_EXCEEDED`
- **Headers:** Includes `X-RateLimit-*` headers with reset time

### 3. **Request Size Limits**
- **Payload:** 1MB maximum per request
- **Status:** Returns 413 with error code `PAYLOAD_TOO_LARGE`

### 4. **Frontend Retry Logic**
- **Automatic Retries:** Up to 3 attempts on transient failures
- **Exponential Backoff:** 200ms → 400ms → 800ms (capped at 3s)
- **WebSocket Reconnection:** Up to 5 reconnect attempts with backoff

### 5. **Error Response Format**
```json
{
  "success": false,
  "error": "Human-readable message",
  "errorCode": "MACHINE_READABLE_CODE"
}
```

## Testing Phase 6

### Prerequisites
Ensure both services are running:
```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend  
cd web && npm run dev
```

### Manual Tests

**Test 1: Valid Log Entry**
```bash
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"2024-01-01T00:00:00Z",
    "level":"info",
    "subject":"login",
    "source":{"runtime":"browser"}
  }'

# Expected: 201 Created with eventId
```

**Test 2: Invalid Timestamp**
```bash
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"2024-01-01",
    "level":"info",
    "subject":"test",
    "source":{"runtime":"node"}
  }'

# Expected: 400 Bad Request with INVALID_TIMESTAMP
```

**Test 3: Rate Limit (100+ requests in succession)**
```bash
# Send 105 rapid requests
for i in {1..105}; do
  curl -X POST http://localhost:3000/api/logs/collect \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\":\"2024-01-01T00:00:00Z\",\"level\":\"info\",\"subject\":\"test-$i\",\"source\":{\"runtime\":\"node\"}}" &
done
wait

# Last few should return 429 Too Many Requests
```

**Test 4: Search Parameter Validation**
```bash
# Test invalid limit (> 1000)
curl "http://localhost:3000/api/logs/search?limit=2000"
# Expected: 400 Bad Request with INVALID_LIMIT

# Test invalid timeFrom
curl "http://localhost:3000/api/logs/search?timeFrom=2024-13-45"
# Expected: 400 Bad Request with INVALID_TIME_RANGE

# Test valid search with limits
curl "http://localhost:3000/api/logs/search?limit=50&offset=0"
# Expected: 200 OK with logs
```

**Test 5: Frontend Error Handling**
1. Stop the backend server
2. In the UI, try to view logs or search
3. Observe the error message with retry logic
4. Restart the backend server
5. Logs should reload automatically after retry attempts

### Run Full Test Suite
```bash
chmod +x test-phase-6.sh
./test-phase-6.sh
```

This script validates:
- Input validation for all fields
- Rate limiting behavior
- Search parameter validation
- HTTP status codes

## Files Modified/Created

### Backend
- `server/src/api/middleware/validation.ts` - Rate limiting and validation middleware
- `server/src/api/routes/logsRouter.ts` - Integrated validation middlewares
- `server/src/api/middleware/errorHandler.ts` - Enhanced error handling
- `server/src/index.ts` - Added 1MB request size limit

### Frontend
- `web/src/api/logsService.ts` - Added retry logic and WebSocket reconnection
- `web/src/App.tsx` - Enhanced error display with error codes

### Documentation
- `PHASE_6_IMPLEMENTATION.md` - Comprehensive Phase 6 documentation
- `test-phase-6.sh` - Automated test script

## Error Codes Reference

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_TIMESTAMP` | 400 | Not ISO 8601 format |
| `INVALID_LEVEL` | 400 | Not in enum list |
| `INVALID_SUBJECT` | 400 | Missing or empty |
| `SUBJECT_TOO_LONG` | 400 | > 255 characters |
| `INVALID_RUNTIME` | 400 | Not 'node' or 'browser' |
| `CONTENT_TOO_LARGE` | 413 | > 10KB |
| `PAYLOAD_TOO_LARGE` | 413 | > 1MB |
| `RATE_LIMIT_EXCEEDED` | 429 | > 100/min per IP |
| `INVALID_TIME_RANGE` | 400 | Wrong date format |
| `INVALID_LIMIT` | 400 | Not 1-1000 |
| `INVALID_OFFSET` | 400 | Negative or non-integer |

## Limits Quick Reference

| Item | Limit |
|------|-------|
| Requests per minute | 100 (per IP) |
| Request body size | 1 MB |
| Log content size | 10 KB |
| Subject length | 255 characters |
| Query result limit | 1000 max |
| Search default | 100 per page |

## Frontend Retry Behavior

When network errors occur:
1. **First Attempt:** Immediate
2. **First Retry:** Wait 200ms
3. **Second Retry:** Wait 400ms
4. **Third Retry:** Wait 800ms

If all retries fail, user sees an error message with error code.

WebSocket reconnection:
- Attempts up to 5 times
- Waits 1s, 1.5s, 2.25s, 3.4s, 5s between attempts
- Shows "WebSocket error" message if all attempts fail

## What's Next (Phase 7)

Phase 7 will focus on:
- OpenAPI/Swagger API documentation
- Getting started guide
- Environment variable configuration
- Deployment instructions for production
- Architecture documentation

## Notes

- Rate limiting is per-IP in this version (suitable for testing/trusted environments)
- For production, use Redis-based rate limiting across multiple servers
- All log content is treated as untrusted input (validated but not executed)
- Error messages are user-friendly while maintaining debug information via error codes
