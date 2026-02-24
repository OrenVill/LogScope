# Project Conventions

## Naming

### Files
- **Backend:** `camelCase.ts` for source files
- **Frontend:** `PascalCase.tsx` for React components, `camelCase.ts` for utilities
- **Tests:** Co-located with source: `component.test.tsx`, `service.test.ts`
- **Types:** Grouped in `types/` folders

### Variables & Functions
- `camelCase` for variables, functions, and methods
- `PascalCase` for React components, classes, and types
- `UPPER_SNAKE_CASE` for constants

### Interfaces & Types
- Prefix interfaces with `I` (e.g., `IFileStorage`, `IQueryIndex`, `IStarredStorage`)
- Use descriptive type names (e.g., `LogEntry`, `SearchFilters`, `ApiResponse`)

### CSS
- Bootstrap utility classes preferred
- Custom CSS in component-specific files (e.g., `LogTable.css`)

## File Organization

### Backend (`server/src/`)
```
index.ts              # Entry point
types/                # Type definitions
  LogEntry.ts
  ApiResponse.ts
  index.ts            # Re-exports
storage/              # Data layer
  fileStorage.ts      # File I/O operations
  starredStorage.ts   # Starred logs management
  index.ts            # Query index
cleanup/              # Background services
  autoCleanup.ts
api/                  # Express routes
  routes/
    logsRouter.ts
  middleware/
    validation.ts
    errorHandler.ts
ws/                   # WebSocket
  wsServer.ts
__tests__/            # Test files
```

### Frontend (`web/src/`)
```
App.tsx               # Main component
main.tsx              # Entry point
types/                # Type definitions
  api.ts
  log.ts
api/                  # API client
  logsService.ts
components/           # React components
  FilterPanel.tsx
  LogTable.tsx
  StatsPanel.tsx
```

## Code Patterns

### API Responses
Always use the standard response format:
```typescript
// Success
{ success: true, data: T, total?: number, limit?: number, offset?: number }

// Error
{ success: false, error: string, errorCode: string }
```

### Factory Functions
Use factory functions for creating storage/service instances:
```typescript
export const createFileStorage = (logDir: string): IFileStorage => { ... }
export const createStarredStorage = (logDir: string): IStarredStorage => { ... }
export const createQueryIndex = (): IQueryIndex => { ... }
```

### Error Handling
- Backend: Try/catch with console.error, return standardized error response
- Frontend: Handle errors in API service, propagate via state

### State Management (Frontend)
- React hooks (`useState`, `useEffect`, `useCallback`, `useRef`)
- No external state library (simple enough for local state)
- LocalStorage for persistence (dark mode, sidebar state)

### TypeScript
- Use `import type` for type-only imports
- Strict mode enabled
- Explicit return types on public functions

## Commit Messages

Format: `[task ID] Short description`

Examples:
```
[M9-T1] Add starred storage for log pinning
[M10-T2] Create docker-compose.yml with volume mapping
```

For commits without task IDs (maintenance, fixes):
```
fix: Resolve WebSocket reconnection race condition
chore: Update dependencies
docs: Add DOCKER.md documentation
```

## Testing

### Backend (Vitest)
- Unit tests for validation, storage operations
- Integration tests for API routes
- Run: `cd server && npm test`

### Frontend (Vitest)
- Component tests with @testing-library/react
- API service tests with mocked fetch
- Run: `cd web && npm test`

### Coverage Goals
- Critical paths: 80%+ coverage
- Validation logic: 100% coverage
- UI components: Key interactions covered

## Dependencies

Before adding a new dependency:
1. Check if it can be done with built-in features
2. Verify active maintenance (commits in last 6 months)
3. Check bundle size impact
4. Ensure MIT/Apache 2.0 license
5. Log decision in `docs/decisions.md` if non-trivial
