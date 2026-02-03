# Electron Security

Consult this doc when adding IPC handlers, modifying preload scripts, handling user-provided paths, or running external commands.

## Non-Negotiable Rules

- `contextIsolation: true` - Always. Never disable.
- `nodeIntegration: false` - Always. Never enable.
- Validate ALL IPC inputs from renderer before processing.
- Sanitize file paths to prevent traversal attacks.
- No shell command injection - use `execFile()` with explicit args, never `shell: true`.

## IPC Input Validation

Every IPC handler MUST validate inputs from renderer:

```typescript
import { validateString, validateNumber } from './utils/ipcValidator'
import { isPathSafe, sanitizePath } from './utils/securityValidation'

ipcMain.handle(IPC_CHANNELS.READ_FILE, async (_, filePath: unknown) => {
  // 1. Type validation
  const path = validateString(filePath, 'filePath')

  // 2. Path safety check
  if (!isPathSafe(path)) {
    throw new Error('Invalid file path')
  }

  // 3. Sanitize
  const safePath = sanitizePath(path)

  // 4. Perform operation
  return fs.readFile(safePath)
})
```

### Validator Functions

Use validators from `src/main/utils/ipcValidator.ts`:

- `validateString(value, name)` - Throws if not string
- `validateNumber(value, name, { min, max })` - With range constraints
- `validateBoolean(value, name)`
- `validateArray(value, name)`
- `validateObject(value, name)`

## Path Validation

### Never Trust Renderer Paths

Pattern: Validate -> Sanitize -> Verify -> Use

```typescript
async function handleFilePath(untrustedPath: unknown): Promise<string> {
  if (typeof untrustedPath !== 'string') {
    throw new Error('Path must be a string')
  }

  // Check for traversal attacks
  if (untrustedPath.includes('..') || untrustedPath.includes('\0')) {
    throw new Error('Invalid path characters')
  }

  // Resolve to absolute path
  const resolvedPath = path.resolve(untrustedPath)

  // Verify it's within allowed directories
  const allowedDirs = [app.getPath('userData'), ...userSelectedDirs]
  const isAllowed = allowedDirs.some((dir) => resolvedPath.startsWith(dir))

  if (!isAllowed) {
    throw new Error('Path not in allowed directory')
  }

  return resolvedPath
}
```

### Path Validator Module

Use `PathValidator` from `src/main/pathValidator.ts` and security utilities from `src/main/utils/securityValidation.ts`:

- `isPathSafe(path)` - No traversal attacks
- `isWithinDirectory(filePath, baseDir)` - Containment check
- `sanitizePath(path)` - Clean path before use

## Shell Command Safety

```typescript
import { execFile } from 'child_process'

// CORRECT: execFile with explicit command and args
execFile('/usr/bin/ls', ['-la', sanitizedPath], (error, stdout) => { ... })

// DANGEROUS: Never use shell: true with user input
exec(`ls -la ${userPath}`, { shell: true })  // VULNERABLE
```

## Preload Script Safety

Only expose specific, limited functions - never a generic IPC proxy:

```typescript
// Good: Specific functions
contextBridge.exposeInMainWorld('api', {
  startTransfer: (files: string[]) => ipcRenderer.invoke('transfer:start', files),
  cancelTransfer: () => ipcRenderer.invoke('transfer:cancel')
})

// Bad: Generic proxy exposes all channels
contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
})
```

## Web Content Security

- Restrict navigation to app URLs only.
- Block new window creation; open external URLs in system browser via `shell.openExternal`.
- Register safe protocol handlers that verify paths are within app directory.

## Error Message Security

Don't expose system details (full paths, config internals) in error messages sent to renderer. Log the full error server-side, send a generic message to the renderer.

## Checklist

- [ ] All IPC handlers validate their inputs
- [ ] Paths from renderer are validated and sanitized
- [ ] No `nodeIntegration: true` or `contextIsolation: false`
- [ ] No `shell: true` with user input
- [ ] Error messages don't expose system details
- [ ] Preload exposes minimal, specific APIs
- [ ] Navigation is restricted to known URLs
