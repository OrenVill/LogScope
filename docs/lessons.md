# Lessons Learned

## L001 — WebSocket undefined reference after code changes
- **Date:** 2026-02-24
- **Task:** M9-T5 (Frontend star column)
- **What was attempted:** Refactoring App.tsx to add sidebar collapse functionality
- **What went wrong:** Accidentally removed `wsRef` initialization line, causing `wsRef.current` to be undefined
- **Root cause:** When adding new features, surrounding code was accidentally deleted during edit
- **Correct approach:** Always verify that existing references and initializations remain intact after edits. Run the app and check for runtime errors before committing.
- **Tags:** `React`, `WebSocket`, `refactoring`

## L002 — Rate limiting blocks high-volume testing
- **Date:** 2026-02-24
- **Task:** M9-T3 (Auto-cleanup testing)
- **What was attempted:** Testing auto-cleanup by sending hundreds of logs quickly
- **What went wrong:** Rate limit of 100 req/min blocked log ingestion after 100 logs
- **Root cause:** Original rate limit was set for casual use, not burst testing
- **Correct approach:** For local development tools, use permissive rate limits (e.g., 10,000 req/min). The limit is a safety net, not a hard restriction.
- **Tags:** `rate-limiting`, `testing`, `configuration`

## L003 — Pagination blocks after cleanup reduces server total
- **Date:** 2026-02-24
- **Task:** M9-T3 (Auto-cleanup)
- **What was attempted:** Using hasMore based on server total count
- **What went wrong:** When cleanup deleted logs, `offset > total` condition prevented further pagination
- **Root cause:** Frontend relied on server's `total` count, which decreased after cleanup while frontend's local count didn't
- **Correct approach:** Base `hasMore` on whether a full page was returned (`returned.length === PAGE_SIZE`), not on server total. Add periodic sync to detect cleanup events and reset pagination.
- **Tags:** `pagination`, `cleanup`, `frontend`

## L004 — Vite build fails on unused variables
- **Date:** 2026-02-24
- **Task:** Release preparation
- **What was attempted:** Running `npm run build` in web/
- **What went wrong:** Build failed due to unused `setLevelFilter` from useState destructuring
- **Root cause:** ESLint passes but Vite's production build is stricter about unused variables
- **Correct approach:** If only the getter is needed from useState, destructure as `const [levelFilter]` without the setter. Always run `npm run build` before marking a task complete.
- **Tags:** `Vite`, `build`, `TypeScript`

## L005 — Empty catch blocks fail lint
- **Date:** 2026-02-24
- **Task:** Release preparation
- **What was attempted:** Using `catch (err) { /* ignore */ }` for expected errors
- **What went wrong:** ESLint error: `'err' is defined but never used`
- **Root cause:** ESLint's no-unused-vars rule applies to catch parameters
- **Correct approach:** Use `catch { /* ignore */ }` (no parameter) when the error object isn't needed. This is valid TypeScript syntax.
- **Tags:** `ESLint`, `error-handling`, `TypeScript`

## L006 — Missing useEffect dependencies
- **Date:** 2026-02-24
- **Task:** Release preparation
- **What was attempted:** Using `disconnectWebSocket` in cleanup effect without listing it as dependency
- **What went wrong:** ESLint warning about missing dependency in useEffect
- **Root cause:** React hooks exhaustive-deps rule requires all referenced functions in dependency array
- **Correct approach:** Either add the function to dependencies (if stable via useCallback) or disable the rule with eslint-disable comment if intentional.
- **Tags:** `React`, `hooks`, `ESLint`
