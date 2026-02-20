# Changelog

All notable changes to this project are recorded below.

## [1.0.0] - 2026-02-19 — Initial stable release
A complete first stable release of LogScope: collection, persistence, query, streaming, UI, tests, accessibility and CI.

### Highlights
- Lazy-loading search results (lightweight summaries) with on-demand full-log fetch on expand.
- Real-time streaming via WebSocket (/ws) with optional server-side filters.
- File-based persistence and an in-memory query index for fast local queries.
- Full test coverage: Vitest unit tests + Playwright E2E (includes Axe accessibility scans).
- CI pipeline (GitHub Actions) that lints, builds, runs unit tests and E2E — Node 20+ compatible.

### Features
- Backend API
  - POST /api/logs/collect — collect structured logs (server assigns eventId)
  - GET /api/logs/search — flexible search with time/level/subject/text filters (returns lightweight summaries by default)
  - GET /api/logs/:eventId — fetch a full LogEntry by ID
  - GET /api/logs/correlation/request/:requestId and /correlation/session/:sessionId — find correlated logs
  - GET /health — service & WebSocket health
- WebSocket
  - /ws endpoint: real-time push of new LogEntry objects, per-client filter subscription
- Frontend UI
  - `LogTable` with expandable rows, lazy-load spinner, cached full-entry fetch, copy-to-clipboard for JSON
  - Filters, correlation search, dark mode toggle, runtime (frontend/backend) filter, level filter, sort
  - Deduplication of logs to avoid duplicate React keys
- Data model
  - LogEntry: eventId, timestamp (ISO 8601 UTC), level, subject, message/data, source (function, file, process, runtime, serviceName), correlation (requestId/sessionId/userId)
  - LogSummary: lightweight projection used for search results

### Storage & indexing
- File-based storage: `server/logs/backend.json` and `server/logs/frontend.json`
- In-memory query index built on startup for efficient search and pagination

### Testing & QA
- Unit tests (Vitest) covering business logic and storage
- Playwright E2E suite including accessibility scans with Axe
- Added tests for lazy-loading, WebSocket real-time behavior, correlation filtering, dark mode and clipboard
- Hardened flaky tests (table-render waits, backend seeding) to be stable in CI

### CI / DevOps
- GitHub Actions workflow: lint → server build & tests → start backend → web build → vitest → Playwright E2E
- CI uses Node 20.19.0 (required by Vite)
- Playwright browser caching implemented to speed up E2E runs
- Playwright runs `vite preview` in CI for stability and increased webServer timeout to handle slow VMs

### Accessibility & UX
- Axe-driven fixes: improved color contrast, accessible headings and focus behavior
- UI polish: navbar/logo sizing, clearer badges, spinner/empty states

### Fixes & Improvements
- Fixed duplicate React key warnings (dedupe on load and on WS push)
- Fixed WebSocket lifecycle and reconnection handling
- Fixed server test import paths and web TypeScript build (excluded test/spec files from app build)
- Improved input validation and rate limiting on `POST /api/logs/collect`
- ESLint fixes and code-quality improvements

### Developer experience
- Strict TypeScript in both `server` and `web` packages
- Local development: `npm run dev` (server + web), automatic reloading (nodemon + Vite)
- Shared types between frontend and backend for consistency
- Documentation: Getting started, environment, deployment and OpenAPI spec included in repo

### Breaking changes / Notes
- Node.js: development & CI require Node >= 20 (Vite compatibility)
- No authentication in v1 (trusted local environment)

### Chore & internal
- Versioned as `1.0.0` — initial stable release
- CHANGELOG added and release tag created

### Contributors
- Oren (author / primary developer)

---
For full details and incremental commits, see the merged PRs and commit history (PR #2 contains the bulk of work for v1.0.0).
