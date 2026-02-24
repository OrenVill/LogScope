# LogScope - Getting Started Guide

Welcome to LogScope! This is a self-hosted structured log collection and query service for local development. This guide will help you set up and start using it on your own device.

## Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher
- **Git:** for cloning the repository

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/OrenVill/LogScope.git
cd LogScope
```

### 2. Install Dependencies

Install dependencies for both backend and frontend:

```bash
# Install root dependencies (if any)
npm install

# Install backend dependencies
cd server
npm install
cd ..

# Install frontend dependencies
cd web
npm install
cd ..
```

## Quick Start (Development)

### Default Ports

By default:
- **Backend:** `http://localhost:3000`
- **Frontend:** `http://localhost:5173`

### Using Custom Ports

You can easily change ports via environment variables:

```bash
# Terminal 1: Backend on port 3001
cd server
PORT=3001 npm run dev

# Terminal 2: Frontend on port 5174 (pointing to backend on 3001)
cd web
VITE_API_URL=http://localhost:3001 VITE_PORT=5174 npm run dev
```

Then open `http://localhost:5174` in your browser.

### Start the Backend Server

Open a terminal and run:

```bash
cd server
npm run dev
```

You should see:
```
Server running on http://localhost:3000
WebSocket endpoint: ws://localhost:3000/ws
Log directory: ./logs
```

### Start the Frontend Development Server

Open a new terminal and run:

```bash
cd web
npm run dev
```

You should see:
```
VITE v7.3.1 ready in XXX ms
➜  Local:   http://127.0.0.1:5173/
```

### Access the UI

Open your browser and navigate to:
```
http://localhost:5173
```

Or if using custom port:
```
http://localhost:5174
```

You should see the LogScope dashboard with:
- **Header:** LogScope title with status indicator
  - 🟢 **Green**: All systems operational (no errors, warnings, or critical logs)
  - 🔴 **Red**: Critical alert (critical logs detected)
- **Sidebar:** Search filters and real-time mode toggle
- **Main Content:** Log table

## Sending Your First Log

### Using curl (Backend Log)

```bash
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"2026-02-19T12:00:00Z",
    "level":"info",
    "subject":"user_login",
    "content":"User logged in successfully",
    "source":{
      "runtime":"node",
      "function":"handleLogin",
      "file":"auth.ts",
      "process":"1234",
      "serviceName":"auth-service"
    },
    "correlation":{
      "requestId":"req-12345",
      "sessionId":"sess-67890"
    }
  }'
```

### Using curl (Frontend Log)

```bash
curl -X POST http://localhost:3000/api/logs/collect \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp":"2026-02-19T12:00:00Z",
    "level":"warn",
    "subject":"api_timeout",
    "content":"Request took 30 seconds",
    "source":{
      "runtime":"browser",
      "function":"fetchUser",
      "file":"api.ts",
      "process":"browser",
      "serviceName":"web-app"
    }
  }'
```

## Using the Dashboard

### Filter Logs

On the **Sidebar:**
1. Enter a **Subject** to filter logs by category
2. Select a **Log Level** (debug, info, warn, error, critical, success)
3. Enter **Text** to search in log content
4. Set **Time Range** to filter by date/time
5. Use **Request ID** or **Session ID** for correlation tracking

Click **Search** to apply filters.

### Runtime Filtering

In the **Main Content** area:
- **All Logs:** View logs from all sources
- **🖥️ Backend:** View only Node.js/Express logs
- **🌐 Frontend:** View only browser logs

### Sort Logs

Click on **Timestamp** or **Level** column header to sort:
- **Timestamp:** Sort by time (descending by default)
- **Level:** Sort by severity level (critical > error > warn > success > info > debug)

### Real-Time Mode

Toggle **Real-Time Mode** in the sidebar to:
- Stream incoming logs in real-time via WebSocket
- Automatically receive new logs without polling
- See logs appear at the top of the list instantly

## Log Levels

LogScope supports six log levels, ordered by severity:

| Level | Icon | Color | Use Case |
|-------|------|-------|----------|
| **debug** | 🐛 | Gray | Development debugging information |
| **info** | ℹ️ | Blue | General informational messages |
| **success** | ✅ | Green | Successful operations |
| **warn** | ⚠️ | Orange | Warnings and non-critical issues |
| **error** | ❌ | Red | Error conditions |
| **critical** | 🚨 | Bright Red | Critical system failures (triggers header alert) |

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│             Browser / Frontend Logs                   │
│  (React App → WebSocket/HTTP → Backend)               │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│     Node.js / Express Backend Services                │
│  (Generate logs directly)                             │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│          LogScope Server (localhost:3000)             │
│                                                       │
│  • HTTP API: Collect, Search, Correlate logs         │
│  • WebSocket: Real-time streaming (/ws)              │
│  • File Storage: Persistent JSON logs                │
│  • Query Index: In-memory search index                │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│      LogScope Dashboard (localhost:5173)              │
│                                                       │
│  • React UI for viewing and searching logs            │
│  • Real-time updates via WebSocket                   │
│  • Comprehensive filtering                           │
└──────────────────────────────────────────────────────┘
```

## API Quick Reference

### Collect Log (POST)
```bash
POST /api/logs/collect
Content-Type: application/json

{
  "timestamp": "ISO 8601 UTC",
  "level": "debug|info|warn|error|critical|success",
  "subject": "string (max 255 chars)",
  "content": "string or object",
  "source": {
    "runtime": "node|browser",
    "function": "string",
    "file": "string",
    "process": "string",
    "serviceName": "string"
  },
  "correlation": {
    "requestId": "string (optional)",
    "sessionId": "string (optional)",
    "userId": "string (optional)"
  }
}
```

### Search Logs (GET)
```bash
GET /api/logs/search?timeFrom=...&timeTo=...&level=...&subject=...&text=...&requestId=...&sessionId=...&limit=100&offset=0
```

### Get by Request ID (GET)
```bash
GET /api/logs/correlation/request/{requestId}
```

### Get by Session ID (GET)
```bash
GET /api/logs/correlation/session/{sessionId}
```

### Health Check (GET)
```bash
GET /api/logs/health
```

### Real-Time Stream (WebSocket)
```bash
ws://localhost:3000/ws

# After connection, subscribe to filtered logs:
{
  "type": "subscribe",
  "filters": {
    "level": "error",
    "subject": "api"
  }
}
```

## Common Tasks

### Find All Errors from a Specific Service

```bash
curl "http://localhost:3000/api/logs/search?level=error&subject=auth-service"
```

### Trace a User Session

```bash
curl "http://localhost:3000/api/logs/correlation/session/sess-12345"
```

### Monitor Real-Time Critical Logs

1. Open the dashboard
2. Enable **Real-Time Mode**
3. Critical logs will appear at the top with a red alert in the header

### Export Logs for Analysis

```bash
# Get all logs as JSON
curl "http://localhost:3000/api/logs/search?limit=1000" > logs.json

# Get logs in a specific time range
curl "http://localhost:3000/api/logs/search?timeFrom=2026-02-19T00:00:00Z&timeTo=2026-02-19T23:59:59Z&limit=1000" > daily_logs.json
```

## Troubleshooting

### Backend Server Won't Start

**Problem:** Port 3000 already in use

**Solution:** 
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process (replace PID)
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

### Frontend Won't Connect to Backend

**Problem:** "Network error" or logs not loading

**Solution:**
1. Verify backend is running on `http://localhost:3000`
2. Check browser console for detailed error messages
3. Ensure no firewall blocking localhost connections

### Real-Time Mode Not Working

**Problem:** WebSocket connection fails

**Solution:**
1. Check backend server logs for errors
2. Verify WebSocket server started: look for "WebSocket server initialized on /ws"
3. Try disabling and re-enabling real-time mode

### Logs Directory Not Found

**Problem:** "ENOENT: no such file or directory, open 'logs/backend.json'"

**Solution:**
```bash
# Backend creates logs directory automatically on startup
# If missing, create it manually:
mkdir -p logs
```

## Environment Variables

See [ENVIRONMENT.md](./ENVIRONMENT.md) for detailed configuration options.

**Common variables:**
- `PORT`: Server port (default: 3000)
- `LOG_DIR`: Directory for storing log files (default: ./logs)
- `MAX_INDEX_SIZE`: Maximum logs in memory (default: 10000)
- `NODE_ENV`: Environment (development, production)

Example:
```bash
PORT=3001 LOG_DIR=/var/log/logscope npm run dev
```

## Next Steps

1. **Integration:** Integrate LogScope client into your application
2. **Local Setup:** Customize [ENVIRONMENT.md](./ENVIRONMENT.md) settings for your needs
3. **Monitoring:** Use critical log alerts to catch issues during development
4. **Correlation:** Use request/session IDs for end-to-end tracing

## Key Features

✅ **Structured Logging:** Categorize logs by level, subject, and runtime  
✅ **Real-Time Streaming:** WebSocket for live log updates  
✅ **Comprehensive Search:** Filter by time, level, content, and correlation  
✅ **Dual Runtime Support:** Track backend and frontend logs together  
✅ **Error Handling:** Validation, rate limiting, and graceful degradation  
✅ **Web Dashboard:** User-friendly React interface  

## API Documentation

Full OpenAPI/Swagger documentation available in [openapi.yaml](./openapi.yaml)

View interactive documentation:
- **Swagger UI:** Host openapi.yaml on a Swagger UI server
- **ReDoc:** Host openapi.yaml on a ReDoc server

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/OrenVill/LogScope/issues
- Discussions: https://github.com/OrenVill/LogScope/discussions

## License

MIT License - See LICENSE file for details
