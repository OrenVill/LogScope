# Implementation Plan

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5.4/5.9 | Type safety, modern JS features |
| Backend Framework | Express 4.19 | Simple, well-known, minimal overhead |
| Frontend Framework | React 19 + Vite 7 | Modern React with fast dev server |
| Styling | Bootstrap 5 | Quick UI development, dark mode support |
| Real-time | WebSocket (ws) | Native browser support, bidirectional |
| Storage | File-based JSON | Zero dependencies, human-readable |
| Testing | Vitest | Fast, modern, TypeScript-first |

## Project Structure

```
LogScope/
├── .github/
│   └── copilot-instructions.md   # AI agent instructions
├── docs/                          # Project documentation
│   ├── spec.md
│   ├── plan.md
│   ├── progress.md
│   ├── conventions.md
│   ├── decisions.md
│   ├── lessons.md
│   └── risks.md
├── server/                        # Backend
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── types/                # Type definitions
│   │   ├── storage/              # File I/O, query index
│   │   ├── cleanup/              # Auto-cleanup service
│   │   ├── api/                  # Express routes & middleware
│   │   ├── ws/                   # WebSocket server
│   │   └── __tests__/            # Backend tests
│   ├── logs/                     # Log storage directory
│   ├── package.json
│   └── tsconfig.json
├── web/                          # Frontend
│   ├── src/
│   │   ├── App.tsx               # Main component
│   │   ├── main.tsx              # Entry point
│   │   ├── types/                # Type definitions
│   │   ├── api/                  # API client
│   │   └── components/           # React components
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── logs/                         # Runtime log storage
├── .env.example
├── package.json                  # Root package (scripts)
├── server.js                     # Production server entry
├── Dockerfile
├── docker-compose.yml
├── README.md
├── CHANGELOG.md
└── [other docs]
```

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐
│   Browser UI    │────▶│  Vite Dev Server │ (development)
│   (React App)   │     │  or Static Files │ (production)
└────────┬────────┘     └─────────────────┘
         │
         │ HTTP / WebSocket
         ▼
┌─────────────────────────────────────────┐
│            Express Server                │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ REST API    │  │ WebSocket Server │  │
│  │ /api/logs/* │  │ /ws              │  │
│  └──────┬──────┘  └────────┬─────────┘  │
│         │                  │            │
│         ▼                  │            │
│  ┌─────────────────────────┴──────────┐ │
│  │         Query Index (memory)        │ │
│  └─────────────────────────┬──────────┘ │
│                            │            │
│  ┌─────────────────────────▼──────────┐ │
│  │        File Storage (JSON)          │ │
│  │  backend.json | frontend.json       │ │
│  │         starred.json                │ │
│  └─────────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │     Auto-Cleanup Service            │ │
│  │  (runs every CLEANUP_INTERVAL_MS)   │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Testing Strategy

### Unit Tests
- **Backend:** Validation logic, storage operations, query filtering
- **Frontend:** Component rendering, user interactions
- **Tool:** Vitest

### Integration Tests
- **Backend:** API endpoint responses, error handling
- **Tool:** Vitest with supertest-like patterns

### E2E Tests
- **Setup:** Playwright configured in `web/`
- **Coverage:** Critical flows (search, filter, real-time toggle)

### Verification Commands
```bash
# Backend
cd server && npm test

# Frontend
cd web && npm test

# E2E (if running)
cd web && npm run test:e2e

# Full lint + type check
cd server && npm run build
cd web && npm run lint && npm run build
```

## Development Approach

### Phase 1-8 (Complete)
Core functionality delivered: log collection, querying, real-time streaming, UI, documentation.

### Phase 9-10 (Complete)
Enhanced features: auto-cleanup, star/pin, Docker support.

### Future Milestones (Proposed)
- **M11:** Optional API key authentication for remote deployments
- **M12:** Log export (JSON, CSV)
- **M13:** Dashboard with aggregation charts

## Deployment Options

1. **Local Development (Default)**
   ```bash
   npm start
   ```

2. **Docker**
   ```bash
   docker-compose up
   ```

3. **Remote Server**
   - Use reverse proxy (nginx/caddy) with authentication
   - Or wait for API key auth feature (proposed M11)
