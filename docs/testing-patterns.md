# Testing Patterns

Consult this doc when writing tests, setting up mocks, or working with the test infrastructure.

## Test File Organization

```
tests/
├── main/           # Main process tests (node environment)
├── renderer/       # Renderer tests (jsdom environment)
├── integration/    # Cross-module integration tests
├── shared/         # Shared type/utility tests
└── __mocks__/      # Shared mocks (electron.ts, etc.)
```

### File Naming

- Unit tests: `moduleName.test.ts`
- Integration tests: `feature.integration.test.ts`
- Test utilities: `testUtils.ts` (no `.test` suffix)

## Running Tests

```bash
npm test                  # All tests
npm run test:main         # Main process only
npm run test:renderer     # Renderer only
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

## TDD Workflow

1. Write failing test first
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Repeat

## Mocking Electron APIs

Use the shared mock at `tests/__mocks__/electron.ts`:

```typescript
jest.mock('electron')
import { app, BrowserWindow, ipcMain } from 'electron'
```

## File System Tests

Use temporary directories:

```typescript
let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transferbox-test-'))
})

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true })
})
```

## IPC Handler Tests

Test handlers in isolation by capturing registered handlers:

```typescript
let handlers: Map<string, Function>

beforeEach(() => {
  handlers = new Map()
  jest.spyOn(ipcMain, 'handle').mockImplementation((channel, handler) => {
    handlers.set(channel, handler)
    return ipcMain
  })
  setupIpcHandlers()
})

it('handles request', async () => {
  const handler = handlers.get('drive:scan')
  const result = await handler({ sender: {} }, '/path/to/drive')
  expect(result).toEqual(expect.arrayContaining([...]))
})
```

## Renderer Component Tests

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

it('renders and handles interaction', () => {
  render(<FileList files={mockFiles} onSelect={jest.fn()} />)
  expect(screen.getByText('file1.txt')).toBeInTheDocument()
  fireEvent.click(screen.getByText('file1.txt'))
})
```

## Mocking window.api

```typescript
const mockApi = {
  startTransfer: jest.fn(),
  cancelTransfer: jest.fn(),
  getConfig: jest.fn().mockResolvedValue({}),
  onTransferProgress: jest.fn().mockReturnValue(() => {})
}

beforeEach(() => {
  window.api = mockApi
  jest.clearAllMocks()
})
```

## Testing with Zustand Store

Create test store wrappers with partial initial state for controlled testing. See `tests/renderer/` for examples.

## Async Testing

Use `waitFor` for async state updates:

```typescript
await waitFor(() => {
  expect(screen.getByText('Transfer complete')).toBeInTheDocument()
})
```

For loading state tests, create controllable promises:

```typescript
let resolveTransfer: Function
mockApi.startTransfer.mockReturnValue(
  new Promise((resolve) => {
    resolveTransfer = resolve
  })
)
```

## Test Data Factories

Create factories for consistent test data:

```typescript
export const createFileInfo = (overrides: Partial<FileInfo> = {}): FileInfo => ({
  id: `file-${Math.random().toString(36).substr(2, 9)}`,
  name: 'test-file.txt',
  path: '/path/to/test-file.txt',
  size: 1024,
  modifiedAt: Date.now(),
  ...overrides
})
```

## Coverage

Target coverage on:

- Main process modules in `src/main/**/*.ts` (excluding `index.ts`)
- Preload scripts in `src/preload/**/*.ts`
- Critical renderer components and hooks

Reports generated in `coverage/` directory.
