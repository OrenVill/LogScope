# Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| R001 | File storage doesn't scale for high volume | Low | Medium | Document as development tool, not production; add cleanup | Mitigated |
| R002 | Memory exhaustion from large query index | Low | High | Implement pagination, limit result sets, auto-cleanup | Mitigated |
| R003 | Logs exposed if service publicly accessible | Medium | High | Document as local-only; recommend reverse proxy for remote | Open |
| R004 | WebSocket reconnection loops | Medium | Low | Implemented backoff and error suppression | Mitigated |
| R005 | Starred logs prevent all cleanup | Low | Medium | Capacity cleanup deletes enough to get under limit | Mitigated |
| R006 | Rate limit too restrictive | Low | Medium | Increased to 10,000 req/min | Closed |

## Risk Explanations

### R001 — File Storage Scalability
- **Description:** JSON file storage will become slow with millions of logs
- **Likelihood:** Low (development tool, not meant for production volumes)
- **Mitigation:** Auto-cleanup limits total logs; documentation clarifies use case
- **Status:** Mitigated

### R002 — Memory Exhaustion
- **Description:** In-memory query index could grow unbounded
- **Likelihood:** Low (cleanup limits log count)
- **Mitigation:** Auto-cleanup, pagination, configurable limits
- **Status:** Mitigated

### R003 — Log Exposure
- **Description:** If a user runs LogScope on `0.0.0.0` or exposes it publicly, logs are accessible without authentication
- **Likelihood:** Medium (users might deploy to remote servers)
- **Mitigation:** Documentation recommends reverse proxy with auth; consider API key auth in v1.1
- **Status:** Open — recommend adding optional API key auth

### R004 — WebSocket Reconnection
- **Description:** Failed WebSocket connections could cause infinite reconnection loops
- **Likelihood:** Medium (network issues common in development)
- **Mitigation:** Implemented error suppression for initial connection, reconnect logic with delays
- **Status:** Mitigated

### R005 — Starred Logs Block Cleanup
- **Description:** If user stars too many logs, cleanup can't free space
- **Likelihood:** Low (users unlikely to star hundreds of logs)
- **Mitigation:** Cleanup deletes non-starred logs first; if all remaining are starred, cleanup stops gracefully
- **Status:** Mitigated

### R006 — Rate Limiting
- **Description:** Original 100 req/min limit blocked legitimate high-volume testing
- **Likelihood:** Was occurring during development
- **Mitigation:** Increased to 10,000 req/min
- **Status:** Closed
