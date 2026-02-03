# Development Patterns

Consult this doc when starting new features, debugging issues, or reviewing the development methodology.

## Development Methodology

1. **Deep Dive Analysis**: Thoroughly analyze task requirements and constraints.
2. **Planning**: Develop clear architectural plan.
3. **Test Driven Development**: Write tests for desired outcomes before implementation.
4. **Implementation**: Implement step-by-step following best practices.
5. **Review and Optimize**: Review code for optimization opportunities.
6. **Finalization**: Ensure code is secure, performant, and meets requirements.

## Debugging Process

- Conduct differential diagnosis before bug fixes.
- Ask "Is this THE issue or just AN issue?" before fixing.
- Make one major change at a time and test before proceeding.
- Maintain debugging backlog for non-critical issues found during investigation.
- Check system architecture to avoid redundant functionality.

## Code Style

- Write concise, technical TypeScript code.
- Use functional and declarative programming patterns; avoid classes (except singleton services).
- Favor iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`).
- Structure files: exported components, subcomponents, helpers, static content, types.
- Use lowercase with dashes for directories (e.g., `components/auth-wizard`).

## Electron Architecture

- Maintain clear separation between main process and renderer process code.
- Use IPC (ipcMain/ipcRenderer) for all main-renderer communication.
- Never use Node.js APIs directly in renderer; expose via preload script with contextBridge.
- Keep main process focused on system operations (file I/O, native APIs, drive detection).
- Keep renderer process focused on UI/UX.

## Error Handling

- Use early returns for error conditions.
- Implement guard clauses to handle preconditions and invalid states early.
- Use `TransferError` class from `src/main/errors/TransferError.ts` for consistent error handling.
- Validate using Zod for schema validation.
- Log errors comprehensively for debugging.

## Performance

- Offload heavy operations (checksums, file scanning) to worker threads if needed.
- Debounce frequent IPC messages (progress updates to ~100ms intervals).
- Use streaming for large file operations.
- Implement proper memory management for long-running transfers.
- Use dynamic imports for code splitting where appropriate.

## Services Pattern

Use singleton services for business logic abstraction:

```typescript
class MyService {
  private static instance: MyService

  static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService()
    }
    return MyService.instance
  }

  async performOperation(): Promise<Result> {
    // Business logic here
  }
}

export const myService = MyService.getInstance()
```

## Configuration Changes

When adding new config fields:

1. Update `AppConfig` type in `src/shared/types/config.ts`
2. Add to `DEFAULT_CONFIG` in `configManager.ts`
3. Increment `CONFIG_VERSION` if breaking change
4. Add migration logic in `migrateConfig()` if needed

## Cross-Platform Path Handling

- Always use `path.join()` and `path.resolve()` for path operations.
- Never hardcode `/` or `\` separators.
- Use `process.platform` checks for platform-specific logic.
- Test on Windows (drive letters), macOS, and Linux (mount points).

## Constants Organization

Constants are organized in `src/main/constants/`:

- `fileConstants.ts` - File size units, buffer sizes, progress thresholds, time constants
- `transferConstants.ts` - Concurrency limits, timing, retry configuration
- `pollingConstants.ts` - Drive monitoring intervals
- `version.ts` - APP_VERSION, CONFIG_VERSION, MIN_SUPPORTED_CONFIG_VERSION
