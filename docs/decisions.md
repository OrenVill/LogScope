# Decisions Log

## D001 — File-Based Storage Over Database
- **Date:** Project inception
- **Context:** Needed to choose data persistence strategy
- **Options Considered:**
  1. SQLite — Pros: SQL queries, indexing. Cons: Extra dependency, setup complexity
  2. File-based JSON — Pros: Zero dependencies, human-readable, easy debugging. Cons: Not scalable for large volumes
- **Decision:** File-based JSON storage
- **Rationale:** LogScope is a development tool for local use. Simplicity and zero-dependency setup are more valuable than scalability. JSON files can be easily inspected and debugged.
- **Decided by:** Project design

## D002 — Bootstrap 5 for UI Styling
- **Date:** Phase 5
- **Context:** Needed a CSS framework for the frontend
- **Options Considered:**
  1. Tailwind CSS — Pros: Utility-first, flexible. Cons: Learning curve, build setup
  2. Bootstrap 5 — Pros: Familiar, components ready, easy dark mode. Cons: Opinionated
  3. Plain CSS — Pros: No dependencies. Cons: Time-consuming
- **Decision:** Bootstrap 5
- **Rationale:** Quick to implement with good component library. Dark mode support built-in. Familiar to most developers.
- **Decided by:** Agent

## D003 — In-Memory Query Index
- **Date:** Phase 3
- **Context:** Needed efficient log querying
- **Options Considered:**
  1. Full file scan on each query — Pros: Simple. Cons: Slow for large files
  2. In-memory index — Pros: Fast queries. Cons: Memory usage, rebuilds on restart
- **Decision:** In-memory index rebuilt on startup
- **Rationale:** For development volumes (hundreds to low thousands of logs), in-memory is fast enough and avoids external index dependencies.
- **Decided by:** Agent

## D004 — No Authentication in v1
- **Date:** Project inception
- **Context:** Whether to implement auth for log access
- **Options Considered:**
  1. API key authentication — Pros: Secure for remote. Cons: Setup friction
  2. No authentication — Pros: Zero config. Cons: Insecure if exposed
- **Decision:** No authentication in v1
- **Rationale:** LogScope is designed for local development on a user's own machine. Adding auth creates friction for the primary use case. Document reverse proxy approach for remote deployments.
- **Decided by:** User (design constraint)

## D005 — Rate Limit at 10,000 req/min
- **Date:** Phase 6 (updated during auto-cleanup work)
- **Context:** Rate limit was blocking high-volume log ingestion during testing
- **Options Considered:**
  1. 100 req/min — Original value. Too restrictive.
  2. 10,000 req/min — Very permissive for local development
  3. Disable rate limiting — Risky if accidentally exposed
- **Decision:** 10,000 requests per minute
- **Rationale:** High enough for burst logging during development, low enough to provide some protection. Local development doesn't need strict limits.
- **Decided by:** User/Agent during debugging

## D006 — Auto-Cleanup with Star Protection
- **Date:** 2026-02-24
- **Context:** Needed automatic log cleanup to prevent unbounded storage growth
- **Options Considered:**
  1. Time-based only — Delete logs older than X
  2. Capacity-based only — Delete oldest when count exceeds Y
  3. Both with star protection — Combine both, but protect pinned logs
- **Decision:** Combined time + capacity cleanup with star protection
- **Rationale:** Time-based handles stale logs, capacity-based handles burst scenarios. Star/pin feature lets users protect important logs from both cleanup types.
- **Decided by:** User

## D007 — Docker as Optional Deployment
- **Date:** 2026-02-24
- **Context:** User wanted Docker support for containerized deployment
- **Options Considered:**
  1. Docker as primary deployment method
  2. Docker as optional alternative
- **Decision:** Docker as optional, separate documentation (DOCKER.md)
- **Rationale:** Keep README focused on simple npm-based setup. Docker adds complexity but useful for some users.
- **Decided by:** User

## D008 — Approval Mode
- **Date:** 2026-02-24
- **Context:** Adopting AI Agent Instructions template
- **Decision:** 🔓 Milestone mode (default)
- **Rationale:** User didn't specify preference; milestone mode balances autonomy with checkpoints
- **Decided by:** Default
