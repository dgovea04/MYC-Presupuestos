# Loading Skeleton System

## Levels

- Shell loading uses `AppShellSkeleton`.
- Page loading uses a page skeleton from `components/loading`.
- Section loading uses semantic section skeletons.
- Table loading uses `SkeletonTable`.
- Form loading uses `SkeletonForm`.
- Chart loading uses `SkeletonChart`.
- Local actions use button-level loading states.

## Rules

- Do not use a centered spinner for full-page table, form, chart, or dashboard loading.
- Do not hand-roll `animate-pulse`; use `components/ui/loading`.
- Do not replace already-visible page content during refetch unless the page route itself changes.
- Do not hide the app shell for section-level loads.
- Do not modify financial calculations or API contracts for skeleton work.
- Keep decorative blocks `aria-hidden`.
- Use `aria-busy` and an accessible label for user-facing loading regions.

## Route Loading Guidance

Route-level `loading.tsx` files should render the closest matching page skeleton. When using `AppShell`, pass a content skeleton only once. If a future authenticated route group provides shell at layout level, route loading files should stop rendering `AppShell` and render only page content skeletons.

## Section Loading Guidance

Suspense fallbacks inside loaded pages should represent only their own section. They must not duplicate the entire page skeleton.

## Action Loading Guidance

Use `Loader2` inside buttons only for local actions such as saving, deleting, exporting, testing, downloading, or generating.

## Current Allowed Exceptions

- Button-level `Loader2` is allowed for local action states.
- Existing client modules may temporarily keep text loading while they are migrated, but new table/form/chart loading states must use semantic skeletons.
- Route-level `loading.tsx` may render `AppShell` until an authenticated layout boundary is introduced.
