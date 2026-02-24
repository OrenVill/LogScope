# LogScope

A self-hosted structured log collection and query service for web applications. Clone the repository, run the service locally on your own device, and use it for development and debugging.

**Purpose:** Enable developers to detect errors, explore root causes, recognize patterns, and analyze event sequences through correlated structured logging in a local, self-contained environment.

## Quick Start

### Option 1: Automated Configuration (Recommended)

**Linux/macOS:**
```bash
./configure.sh
```

**Windows:**
```cmd
configure.bat
```

These scripts will:
- Prompt you for the app port
- Copy `.env.example` → `.env` and update `PORT` and `VITE_API_URL`


### Option 2: Manual Configuration

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your preferred ports:**
   ```bash
   PORT=3000              # Backend port
   VITE_PORT=5173         # Frontend port
   VITE_API_URL=http://localhost:3000  # Backend URL for frontend
   ```

## Install dependecies

  ```
  npm install
  ```

### Starting the server
You can start LogScope in two ways: a single-process production-style run (recommended for local hosting) or a development workflow with hot-reload.

#### Production (single-process — recommended)
Builds the frontend and backend, then runs the server that serves the built SPA alongside the API and WebSocket on a single port.

From the repository root:

```bash
npm start
```

Notes:
- `npm start` builds `web` (Vite production build) and `server` (TypeScript), then launches `server/dist/index.js` via `server.js`.
- The running server serves static assets from `web/dist` and exposes the API and `/ws` on `PORT`.
- Useful flags:
  - Skip build step: `SKIP_BUILD=1 npm start` or `node server.js --no-build`
  - Override port: `PORT=3001 npm start`
  - Override frontend dist location: `FRONTEND_DIST=/path/to/dist npm start`

#### Development (recommended for active development)
Run frontend and backend dev servers separately so each has hot-reload and faster iteration.

Terminal 1 — Backend (hot-reload):

```bash
cd server
PORT=3000 npm run dev
```

Terminal 2 — Frontend (Vite dev server):

```bash
cd web
VITE_API_URL=http://localhost:3000 VITE_PORT=5173 npm run dev
```

Tip: use `./configure.sh` or `configure.bat` to create/update `.env` with the desired backend `PORT` and `VITE_API_URL` before running either mode.


## Features

- **Structured Logging:** Collect logs from backend (Node/Express) and frontend (browser) with rich metadata
- **Log Querying:** Search and filter logs by timestamp, level, subject, source, and correlation IDs
- **Real-Time Streaming:** WebSocket connection for live log updates
- **Status Indicators:**
  - 🟢 **Green Status:** System is operational with zero errors, warnings, or critical issues
  - 🔴 **Red Alert:** Critical logs detected in the system
- **Self-Hosted:** Run entirely on your local machine with no internet dependency
- **Development-Focused:** Designed for local debugging and exploration, not production monitoring

## Project Structure

```
LogScope/
├── server/              # Node.js/Express backend
│   ├── src/
│   │   ├── api/        # REST API endpoints
│   │   ├── storage/    # File-based log storage
│   │   └── types/      # TypeScript definitions
│   └── package.json
├── web/                # React frontend
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── api/       # API client
│   │   └── types/     # Type definitions
│   └── package.json
├── .env.example        # Environment configuration template
├── configure.sh        # Linux/macOS quick setup script
├── configure.bat       # Windows quick setup script
└── logs/               # Storage for collected logs (auto-created)
```

## Documentation

- **[Getting Started Guide](./GETTING_STARTED.md)** - Detailed setup and basic usage
- **[Environment Configuration](./ENVIRONMENT.md)** - All available configuration options
- **[API Documentation](./docs/openapi.yaml)** - Complete REST API specification
- **[Deployment Guide](./DEPLOYMENT.md)** - Advanced hosting and production considerations

## Configuration

Full configuration via environment variables:

| Variable | Default | Description |
|----------|---------|---|
| `PORT` | `3000` | Backend server port |
| `VITE_PORT` | `5173` | Frontend dev server port |
| `VITE_API_URL` | `http://localhost:3000` | Backend URL for frontend to connect to |
| `LOG_DIR` | `./logs` | Directory where logs are stored |
| `MAX_INDEX_SIZE` | `10000` | Maximum logs kept in memory index |
| `NODE_ENV` | `development` | Node environment |
| `LOG_LEVEL` | `info` | Minimum log level to display |

### Custom Port Example

To run backend on port 3001 and frontend on port 5174:

```bash
# Terminal 1
PORT=3001 npm run dev

# Terminal 2
VITE_API_URL=http://localhost:3001 VITE_PORT=5174 npm run dev
```

## System Status Indicators

### Green Status (✅ ALL SYSTEMS OPERATIONAL)
Appears when the system contains **zero errors, warnings, or critical logs**. This indicates everything is working as expected.

### Red Alert (🚨 CRITICAL ALERT)
Appears when **any critical-level logs** are detected. Click the alert to see details of the critical issues.

Both indicators appear in the top-right corner of the navbar with animated pulsing effects.

## Log Entry Format

Each log contains:
- **Metadata:** timestamp, level, subject, source information
- **Content:** Flexible JSON payload for any data
- **Correlation:** Request ID, session ID, and user ID for tracing
- **Source:** Function, file, process, runtime (Node/browser), and service name

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js 20 + Express 4.19.2 + TypeScript 5.4 |
| Frontend | React 19.2 + Vite 7.3.1 + TypeScript 5.9 |
| UI Framework | Bootstrap 5 |
| Storage | File-based JSON (logs/backend.json, logs/frontend.json) |

## Security & Privacy

- **Self-Hosted Only:** No data leaves your machine
- **Local Storage:** All logs stored in `./logs` directory
- **No Third-Party Services:** Complete control over your data

### Optional API Key Authentication

LogScope can optionally require an API key on all endpoints. This is useful when exposing the service on a LAN or via Docker port mapping.

```bash
# Backend: set the key
API_KEY=my-secret-key-1234 npm run dev

# Frontend: provide the same key
VITE_API_KEY=my-secret-key-1234 npm run dev
```

When `API_KEY` is set:
- All `/api/logs/*` REST endpoints require an `X-API-Key` header
- WebSocket `/ws` connections require the key via `?apiKey=` query param or `X-API-Key` header
- The `/health` endpoint remains unauthenticated
- Keys shorter than 16 characters produce a startup warning

When `API_KEY` is **not** set, LogScope runs fully open (default, suitable for local development).

## Development

### Requirements
- Node.js 18+
- npm 9+

### Install Dependencies
```bash
npm install
cd server && npm install
cd ../web && npm install
```

### Run with Auto-Reload
Both services automatically reload when code changes (file watching enabled):
- Backend: Uses nodemon with polling
- Frontend: Uses Vite dev server with polling


### Test the API
Example log submission:
```bash
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "info",
    "subject": "user-action",
    "content": "User logged in successfully",
    "source": {
      "function": "handleLogin",
      "file": "auth.ts",
      "process": "main",
      "runtime": "browser",
      "serviceName": "webapp"
    }
  }'
```

## Troubleshooting

### Port Already in Use
If you get "port already in use" errors:
- Change `PORT` for backend: `PORT=3001 npm run dev`
- Change `VITE_PORT` for frontend: `VITE_PORT=5174 npm run dev`
- Update `VITE_API_URL` to match your backend port

### Frontend Can't Connect to Backend
Ensure the frontend's `VITE_API_URL` matches your backend's actual address and port.

### No Logs Appearing
1. Check that both services are running
2. Verify the API endpoint is correct
3. Check browser console for network errors
4. Ensure logs are being sent to the correct endpoint

## API Endpoints

### Core Endpoints
- `POST /api/logs/collect` - Submit new logs
- `GET /api/logs/search` - Query logs with filters
- `WS /ws` - WebSocket for real-time log streaming

See [API Documentation](./docs/openapi.yaml) for complete reference.

## License

MIT

## Support

For issues, questions, or contributions, please refer to the documentation files:
- [Getting Started](./GETTING_STARTED.md)
- [Environment Variables](./ENVIRONMENT.md)
- [API Documentation](./docs/openapi.yaml)
- [Deployment Guide](./DEPLOYMENT.md)

---

**LogScope** - Your local development logging companion 🚀
