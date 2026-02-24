# Task Backlog

## ✅ Completed Milestones

All milestones M1-M11 have been completed. See `docs/progress.md` for details.

### Milestone 11: Optional API Key Authentication ✅
> **Priority:** Should Have (for remote deployment security)
> **Status:** Complete

- [x] `M11-T1` — `API_KEY` environment variable support. Passthrough when unset.
- [x] `M11-T2` — Auth middleware with constant-time comparison (`crypto.timingSafeEqual`), `X-API-Key` header.
- [x] `M11-T3` — Applied to all `/api/logs/*` routes.
- [x] `M11-T4` — WebSocket auth via `X-API-Key` header or `?apiKey=` query param.
- [x] `M11-T5` — Frontend attaches key from `VITE_API_KEY` env var automatically.
- [x] `M11-T6` — Updated `.env.example`, `ENVIRONMENT.md`, `README.md`, `openapi.yaml`.
- [x] `M11-T7` — Backward compatible: no key set = fully open access.

---

## 🔜 Proposed Future Milestones

### Milestone 12: Log Export
> **Priority:** Could Have
> **Status:** Not Started

- [ ] `M12-T1` — Add GET /api/logs/export endpoint with format query param. **Verify:** Returns JSON/CSV
- [ ] `M12-T2` — Implement JSON export with filters. **Verify:** Exports match search criteria
- [ ] `M12-T3` — Implement CSV export with column mapping. **Verify:** Valid CSV file
- [ ] `M12-T4` — Add download button to UI. **Verify:** File downloads in browser
- [ ] `M12-T5` — Handle large exports with streaming. **Verify:** Large exports don't crash

### Milestone 13: Dashboard with Aggregation
> **Priority:** Could Have
> **Status:** Not Started

- [ ] `M13-T1` — Design dashboard layout with charts. **Verify:** Mockup approved
- [ ] `M13-T2` — Add aggregation endpoint (logs per level, per hour). **Verify:** Returns aggregated data
- [ ] `M13-T3` — Implement log level distribution chart. **Verify:** Chart renders
- [ ] `M13-T4` — Implement timeline chart (logs over time). **Verify:** Chart renders
- [ ] `M13-T5` — Add dashboard tab/route. **Verify:** Navigation works

---

## 🐛 Bug Fixes & Maintenance

- [ ] `BUG-001` — Fix `act(...)` warning in LogTable tests. **Priority:** Low (cosmetic)

---

## 📝 Notes

- Milestones 11-13 are proposed features, not committed work
- Prioritize M11 (API key auth) if users request remote deployment support
- Each milestone should be discussed with user before starting
