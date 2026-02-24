# Environment Configuration

LogScope configuration is managed through environment variables. This document describes all available options.

## Quick Port Configuration

The easiest way to run LogScope on custom ports:

```bash
# Terminal 1: Backend on custom port
PORT=3001 npm run dev

# Terminal 2: Frontend on custom port (with backend URL)
VITE_API_URL=http://localhost:3001 VITE_PORT=5174 npm run dev
```

Then access the UI at `http://localhost:5174`

## Detailed Configuration

### Backend Server (Node.js/Express)

### Port Configuration

**`PORT`**
- **Type:** `integer`
- **Default:** `3000`
- **Description:** HTTP and WebSocket server port
- **Example:** `PORT=3001 npm run dev`

### Storage Configuration

**`LOG_DIR`**
- **Type:** `string`
- **Default:** `./logs` (relative to server directory)
- **Description:** Directory where log files are stored
- **Absolute Path Example:** `LOG_DIR=/var/log/logscope npm run dev`
- **Note:** Directory is created automatically if it doesn't exist

### Query Index Configuration

**`MAX_INDEX_SIZE`**
- **Type:** `integer`
- **Default:** `10000`
- **Description:** Maximum number of log entries to maintain in memory
- **Range:** 1000 - 1000000
- **Behavior:** When exceeded, oldest logs are removed (FIFO)
- **Example:** `MAX_INDEX_SIZE=50000 npm run dev`

### Auto-Cleanup

**`CLEANUP_INTERVAL_MS`**
- **Type:** `integer` (milliseconds)
- **Default:** `300000` (5 minutes)
- **Description:** How often the auto-cleanup service runs
- **Example:** `CLEANUP_INTERVAL_MS=60000 npm run dev`

**`LOG_MAX_AGE_MS`**
- **Type:** `integer` (milliseconds)
- **Default:** `3600000` (1 hour)
- **Description:** Logs older than this value are automatically deleted. Starred (pinned) logs are exempt.
- **Example:** `LOG_MAX_AGE_MS=1800000 npm run dev` (30 minutes)

**`LOG_MAX_TOTAL`**
- **Type:** `integer`
- **Default:** `500`
- **Description:** Combined log count (backend + frontend) that triggers a capacity cleanup. When exceeded, the oldest `LOG_DELETE_COUNT` non-starred logs are removed.
- **Example:** `LOG_MAX_TOTAL=1000 npm run dev`

**`LOG_DELETE_COUNT`**
- **Type:** `integer`
- **Default:** `100`
- **Description:** Number of oldest logs to delete when the `LOG_MAX_TOTAL` capacity limit is hit.
- **Example:** `LOG_DELETE_COUNT=200 npm run dev`

### Security

**`API_KEY`**
- **Type:** `string`
- **Default:** (empty — authentication disabled)
- **Description:** When set, all `/api/logs/*` endpoints and WebSocket `/ws` connections require a matching `X-API-Key` header. Requests without a valid key receive `401 Unauthorized`. When unset, LogScope runs fully open (suitable for local-only development).
- **Recommended:** At least 16 characters
- **Example:** `API_KEY=my-secret-dev-key-1234 npm run dev`
- **Note:** Use HTTPS when transmitting the key over non-localhost networks.

### Node.js Environment

**`NODE_ENV`**
- **Type:** `string`
- **Default:** `development`
- **Valid Values:** `development`, `production`, `test`
- **Description:** Runtime environment mode
- **Benefits (production):**
  - Disables verbose logging
  - Enables optimizations
  - Changes error message detail level

Example:
```bash
NODE_ENV=production npm run dev
```

### Logging

**`LOG_LEVEL`** (optional)
- **Type:** `string`
- **Default:** `info`
- **Valid Values:** `debug`, `info`, `warn`, `error`
- **Description:** Server log verbosity level
- **Example:** `LOG_LEVEL=debug npm run dev`

### Advanced Options

**`MAX_REQUEST_SIZE`** (optional)
- **Type:** `string`
- **Default:** `1mb`
- **Description:** Maximum request body size
- **Example:** `MAX_REQUEST_SIZE=2mb npm run dev`
- **Valid Formats:** `100b`, `10kb`, `1mb`, `1gb`

Note: Individual log content size is limited to 10KB regardless of this setting.

**`RATE_LIMIT_WINDOW`** (optional)
- **Type:** `integer`
- **Default:** `60000` (milliseconds)
- **Description:** Rate limit time window
- **Example:** `RATE_LIMIT_WINDOW=120000 npm run dev` (2 minutes)

**`RATE_LIMIT_MAX_REQUESTS`** (optional)
- **Type:** `integer`
- **Default:** `100`
- **Description:** Maximum requests per window per IP
- **Example:** `RATE_LIMIT_MAX_REQUESTS=200 npm run dev`

## Frontend (React/Vite)

### Port Configuration

**`VITE_PORT`**
- **Type:** `integer`
- **Default:** `5173`
- **Description:** React dev server port
- **Example:** `VITE_PORT=5174 npm run dev`
- **Note:** Configured in `vite.config.ts`, reads from environment variable

### API Configuration

**`VITE_API_KEY`**
- **Type:** `string`
- **Default:** (empty — no key sent)
- **Description:** When the backend has `API_KEY` set, the frontend must provide the same key via this variable. It is attached as an `X-API-Key` header on every API request and as a `?apiKey=` query parameter on WebSocket connections.
- **Example:** `VITE_API_KEY=my-secret-dev-key-1234 npm run dev`

**`VITE_API_URL`**
- **Type:** `string`
- **Default:** `http://localhost:3000` (development)
- **Description:** Backend API server URL
- **Example Development:** `VITE_API_URL=http://localhost:3001 npm run dev`
- **Example Production:** `VITE_API_URL=https://api.logscope.example.com npm run build`

### Port Configuration

**`VITE_PORT`** (optional)
- **Type:** `integer`
- **Default:** `5173`
- **Description:** Vite development server port
- **Example:** `VITE_PORT=3000 npm run dev`
- **Note:** Configured in `vite.config.ts`, not typically set as env var

## Configuration Examples

### Local Development

```bash
# Minimal setup (all defaults)
cd server && npm run dev
cd web && npm run dev
```

### Custom Ports

```bash
# Terminal 1: Backend on port 3001
cd server
PORT=3001 npm run dev

# Terminal 2: Frontend on port 5174
cd web
VITE_API_URL=http://localhost:3001 npm run dev
```

### Alternative Storage Location

```bash
# Store logs in /tmp
cd server
LOG_DIR=/tmp/logscope npm run dev
```

### Larger Memory Index (High-Volume Logging)

```bash
# For systems with many logs
cd server
MAX_INDEX_SIZE=100000 npm run dev
```

### Production Setup

```bash
# Backend
NODE_ENV=production PORT=3000 LOG_DIR=/var/log/logscope MAX_INDEX_SIZE=50000 npm run dev

# Frontend
NODE_ENV=production VITE_API_URL=https://logscope.example.com npm run build
```

### Strict Rate Limiting

```bash
# Tighter limits for public API
RATE_LIMIT_MAX_REQUESTS=50 RATE_LIMIT_WINDOW=60000 npm run dev
```

## Environment File Support

Create a `.env` file in the respective directory to manage environment variables:

### Backend `.env` file

```properties
# .env in /server directory
PORT=3000
LOG_DIR=./logs
MAX_INDEX_SIZE=10000
NODE_ENV=development
LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=100
# API_KEY=my-secret-dev-key-1234   # uncomment to enable API key auth
```

Load with:
```bash
# Using dotenv (configured in server/src/index.ts)
npm run dev
```

### Frontend `.env` file

```properties
# .env in /web directory
VITE_API_URL=http://localhost:3000
# VITE_API_KEY=my-secret-dev-key-1234   # must match backend API_KEY
```

Usage in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## Development vs Production

### Development Configuration

```bash
# Recommended dev setup
PORT=3000
NODE_ENV=development
LOG_DIR=./logs
MAX_INDEX_SIZE=10000
LOG_LEVEL=debug
```

**Characteristics:**
- Verbose logging
- Hot reload enabled
- All errors shown in detail
- No production optimizations

### Production Configuration

```bash
# Recommended production setup
PORT=3000
NODE_ENV=production
LOG_DIR=/var/log/logscope
MAX_INDEX_SIZE=50000
LOG_LEVEL=info
RATE_LIMIT_MAX_REQUESTS=100
```

**Characteristics:**
- Minimal logging
- Optimized performance
- Secure error messages
- Enabled rate limiting

## Rate Limiting Configuration

Rate limiting protects against abuse. Configure based on your expected traffic:

**Low Traffic** (testing/staging):
```bash
RATE_LIMIT_MAX_REQUESTS=100    # 100 req/min per IP
```

**Medium Traffic** (production with burst):
```bash
RATE_LIMIT_MAX_REQUESTS=200    # 200 req/min per IP
```

**High Traffic** (high-volume services):
```bash
RATE_LIMIT_MAX_REQUESTS=500    # 500 req/min per IP
```

## Docker Configuration

If running LogScope in Docker, pass environment variables:

```bash
docker run -e PORT=3000 \
           -e LOG_DIR=/logs \
           -e NODE_ENV=production \
           logscope-server:latest
```

Or with `.env` file:
```bash
docker run --env-file .env logscope-server:latest
```

## Troubleshooting Environment Variables

### Variables Not Taking Effect

**Check:** Environment variables are set before running the command
```bash
# Correct
PORT=3001 npm run dev

# Incorrect (variable not set)
npm run dev PORT=3001
```

### File Permissions with Custom LOG_DIR

If using a custom `LOG_DIR` with restricted permissions:
```bash
# Ensure the directory is writable
mkdir -p /var/log/logscope
chmod 755 /var/log/logscope
chown $USER:$USER /var/log/logscope
```

### Port Already in Use

If `PORT` is already in use:
```bash
# Find what's using the port
lsof -i :3000

# Use a different port
PORT=3001 npm run dev
```

## Validation

LogScope validates configuration on startup:

- **Invalid PORT:** Must be 1-65535
- **Invalid LOG_DIR:** Must be writable directory
- **Invalid MAX_INDEX_SIZE:** Must be between 1000-1000000
- **Invalid NODE_ENV:** Must be development/production/test

If validation fails, the server exits with an error message.

## Security Considerations

⚠️ **Important:**
- Store `.env` files in `.gitignore` (never commit credentials)
- Use absolute paths for `LOG_DIR` in production
- Restrict `LOG_DIR` permissions to the application user only
- Monitor disk space for logs directory
- Implement log rotation (not built into LogScope v1)
- Adjust `RATE_LIMIT_MAX_REQUESTS` based on actual traffic

## Monitoring Configuration

To monitor current configuration:

```bash
# Backend health check returns configuration info
curl http://localhost:3000/api/logs/health
```

Response includes log counts:
```json
{
  "success": true,
  "data": {
    "backend": { "count": 1234 },
    "frontend": { "count": 567 },
    "total": 1801
  }
}
```

## Next Steps

- See [GETTING_STARTED.md](./GETTING_STARTED.md) for setup instructions
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for local setup and configuration
- See [openapi.yaml](./openapi.yaml) for API documentation
