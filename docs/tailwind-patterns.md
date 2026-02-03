# Tailwind CSS Patterns

Consult this doc when styling components, implementing dark mode, or working with the design system.

## Class Organization

Order Tailwind classes consistently:

1. Layout (display, position, z-index)
2. Box model (width, height, margin, padding)
3. Typography (font, text, leading)
4. Visual (background, border, shadow)
5. Interactive (hover, focus, active states)
6. Responsive (sm:, md:, lg:)
7. Dark mode (dark:)

## Use `cn()` Utility

Always use `cn()` from `~/lib/utils` for conditional classes:

```tsx
import { cn } from '~/lib/utils'

;<button
  className={cn(
    'px-4 py-2 rounded-lg font-medium',
    variant === 'primary' && 'bg-blue-600 text-white',
    disabled && 'opacity-50 cursor-not-allowed'
  )}
/>
```

## Dark Mode

This project uses `darkMode: 'class'`. Always implement both light and dark variants:

```tsx
<div className="bg-white text-gray-900 border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700" />
```

### Standard Color Mappings

| Light             | Dark                                      |
| ----------------- | ----------------------------------------- |
| `bg-white`        | `dark:bg-gray-800` or `dark:bg-slate-900` |
| `bg-gray-50`      | `dark:bg-gray-900`                        |
| `bg-gray-100`     | `dark:bg-gray-800`                        |
| `text-gray-900`   | `dark:text-gray-100`                      |
| `text-gray-700`   | `dark:text-gray-300`                      |
| `text-gray-500`   | `dark:text-gray-400`                      |
| `border-gray-200` | `dark:border-gray-700`                    |
| `border-gray-300` | `dark:border-gray-600`                    |

## Custom Colors

Brand colors (orange spectrum) and slate colors are defined in `tailwind.config.js`:

```tsx
<button className="bg-brand-500 hover:bg-brand-600 text-white" />
```

## Size Variants

Standardize across components:

```tsx
const sizeClasses = {
  xs: 'h-6 px-2 text-xs',
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg'
}
```

## Custom Animations

From `tailwind.config.js`:

- `animate-shimmer` - Loading shimmer
- `animate-float` - Floating effect
- `animate-spin-slow` - Slow spin (3s)
- `animate-pulse-slow` - Slow pulse (3s)

From `main.css`:

- `animate-fade-in-up` / `animate-fade-in-down`
- `animate-scale-in`
- `animate-gradient`

## Focus States

Always implement proper focus states:

```tsx
<button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800" />
```

Never remove focus outline without a replacement.

## Glass Morphism

Use the `.glass` utility class:

```tsx
<div className="glass rounded-lg p-4">{/* Handles light/dark automatically */}</div>
```

## Shadow Utilities

Custom glow shadows:

- `shadow-glow-blue`
- `shadow-glow-green`
- `shadow-glow-purple`

## Spacing

Use standard Tailwind spacing values. Avoid arbitrary values like `p-[13px]`.

## Anti-patterns

1. Don't use `@apply` excessively - prefer utility classes in JSX.
2. Don't create arbitrary values - use the design system.
3. Don't forget dark mode - always test both themes.
4. Don't hardcode colors - use the configured palette.

## Responsive

Desktop-first approach. Only use responsive utilities for window resizing scenarios.

## Scrollbars

Custom scrollbar styles are defined in `main.css`. Use `overflow-y-auto` on scrollable containers.
