# React Patterns

Consult this doc when building or modifying renderer components, working with Zustand, or adding hooks.

## Component File Structure

Organize component files in this order:

1. Imports (React, then libraries, then local)
2. Types/Interfaces
3. Constants
4. Helper functions
5. Main component
6. Subcomponents (if small, otherwise separate files)
7. DisplayName (for forwardRef components)
8. Export

## Zustand Store Selectors

Always use selectors to prevent unnecessary re-renders:

```tsx
// Good: Memoized selectors
import { useTransferProgress, useIsTransferring } from '~/store/selectors'

const TransferStatus = () => {
  const progress = useTransferProgress()
  const isTransferring = useIsTransferring()
}

// Bad: Selecting entire slices
const TransferStatus = () => {
  const { progress, currentFile, speed, eta } = useStore((state) => state.transfer)
  // Re-renders on ANY transfer state change
}
```

Call store actions directly, don't pass as props:

```tsx
const startTransfer = useStore((state) => state.startTransfer)
```

## IPC from Renderer

Use the `useIpc` hook for all IPC operations. It provides 50+ typed methods for config, drive, transfer, history, and log management.

## Event Handlers

- Prefix handlers with `handle` (e.g., `handleClick`, `handleFileSelect`).
- Use `useCallback` for handlers passed to child components or used in effects.
- Inline handlers are fine for simple cases not passed to children.

## Props

- Name interfaces as `ComponentNameProps`.
- Make props optional with sensible defaults unless truly required.
- Always include `className?: string` for customization.
- Spread remaining native element props for flexibility.

## forwardRef

Use `forwardRef` for components wrapping native elements. Always set `displayName`.

## Conditional Rendering

- Use early returns for cleaner conditional rendering.
- Use `&&` for simple conditionals, ternary for either/or.
- Avoid nested ternaries.

## Lists

Always use stable, unique keys (e.g., `file.id`). Never use array index as key.

## Custom Hooks

- Prefix with `use`.
- Return objects for multiple values, simple values for single.

## Performance

- Avoid inline object/array literals in JSX (creates new reference every render).
- Use `useMemo` for expensive computations.
- Wrap feature sections with error boundaries.

## Import Alias

Renderer uses `@renderer` alias mapped to `src/renderer/src/`:

```tsx
import { Button } from '@renderer/components/ui/Button'
```

## Accessibility

Include proper ARIA attributes on interactive elements:

```tsx
<button aria-label="Close dialog" aria-pressed={isActive} aria-disabled={isLoading}>
  <XIcon />
</button>
```
