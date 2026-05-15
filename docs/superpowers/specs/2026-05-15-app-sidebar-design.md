# App Sidebar Design

## Context

The authenticated application shell currently uses a simple fixed left sidebar inside `components/layout/app-shell.tsx`.

Today the sidebar has four main limitations:

- Branding is text-only and does not use the existing MYC logo asset already present in the project.
- The headline `APU para obras en Peru` is narrower than the product scope described in `DESIGN.md` and the project rules.
- The user section is visually minimal and does not feel aligned with the rest of the dashboard polish.
- On very wide screens the expanded sidebar consumes more horizontal attention than necessary and makes the content area feel less balanced.

This phase should improve the authenticated sidebar experience without changing routing, business logic, or dashboard information architecture.

## Goal

Upgrade the left application sidebar so it feels more premium, more branded, and more space-efficient on large screens.

The new sidebar should:

- Show MYC branding more clearly
- Replace the current heading with product language aligned to construction budgeting
- Improve the user account block
- Support an expanded mode and a mini icon-only mode
- Default to expanded in normal desktop layouts
- Collapse automatically in full-width desktop layouts
- Let the user manually toggle between expanded and mini states

## Non-Goals

- No redesign of page-level content inside dashboard, projects, budgets, resources, or settings
- No navigation restructuring beyond presentation and state behavior
- No changes to authentication flows or sign-out logic
- No new dependencies
- No persistence to the database for sidebar preferences
- No mobile drawer redesign unless a minor adjustment is required for consistency

## Approved Direction

The approved direction is a dual-mode sidebar with automatic full-width collapse and manual override.

Behavior summary:

- Standard desktop: expanded by default
- Very wide desktop (`fullwidth`): mini by default
- User can always toggle between expanded and mini
- The UI should preserve the existing professional MYC tone and stay consistent with the design system in `DESIGN.md`

## UX Model

### 1. Branding

The top of the sidebar should move from a text-only header to a branded block.

Requirements:

- Reuse the existing MYC logo asset or its current wrapper pattern from the landing implementation
- Keep the logo readable in both expanded and mini states
- Replace `APU para obras en Peru` with a broader construction-budgeting message

Recommended copy:

- `Costos y presupuestos de obra`

Accepted alternatives:

- `Plataforma técnica para presupuestar obras`
- `Control técnico de costos de construcción`

The default implementation should use the recommended copy unless local layout constraints make one of the shorter alternatives necessary.

### 2. Navigation

The navigation keeps the same destinations and order:

- Dashboard
- Proyectos
- Presupuestos
- Catalogo de Insumos
- Catalogo de Partidas
- Configuracion

Requirements:

- Expanded mode shows icon + label
- Mini mode shows icon only
- Active and hover states must remain clear in both modes
- Mini mode must still expose accessible labels via tooltip and/or `title` plus screen-reader text

### 3. User Section

The user block should become a stronger dashboard surface.

Expanded mode requirements:

- Show a compact avatar treatment based on initials if no avatar exists
- Show user name with stronger hierarchy
- Show email as secondary metadata
- Show a lightweight status badge such as `Cuenta activa`
- Keep sign-out accessible and visually integrated

Mini mode requirements:

- Reduce to avatar/initials plus a compact sign-out affordance or compact account action area
- Preserve accessible labels for hidden text actions

### 4. Sidebar Toggle

The sidebar needs an explicit control to switch modes.

Requirements:

- The toggle should be visible in the sidebar chrome
- The toggle should communicate current state clearly
- The toggle must be keyboard accessible
- The toggle should work independently of the automatic full-width behavior

### 5. Full-Width Behavior

The application should automatically prefer mini mode on very large screens to improve content balance.

Requirements:

- The breakpoint should target extra-wide desktop layouts only, not normal laptop widths
- The content area should visibly benefit from the narrower sidebar
- The automatic behavior should not feel jumpy during resize

Implementation assumption:

- Use a client-side media query or window-width check tied to a high breakpoint such as `2xl` or a nearby custom threshold

### 6. Preference Handling

The user asked for both automatic and manual behavior, so the interface needs a simple override model.

Recommended behavior:

- Determine the default state from the viewport class
- Let manual toggle override the automatic default for the current browser
- Persist the override in `localStorage`
- Reconcile automatic default and stored preference safely during hydration

This should remain client-side only.

## Component Design

The existing `AppShell` should remain the layout entry point, but the sidebar UI should be decomposed into smaller parts so the file does not become oversized.

Recommended components:

- `AppSidebarShell` or equivalent client wrapper for sidebar state
- `SidebarBrand`
- `SidebarNav`
- `SidebarUserCard`
- `SidebarToggle`

These may live in `components/layout/` and can remain lightweight. The goal is to isolate responsibilities, not create a large component tree.

## Architecture

### Server and Client Boundary

`AppShell` is currently an async server component because it loads session and formatting settings.

Recommended architecture:

- Keep `AppShell` as the server-owned container responsible for session/settings fetching
- Pass minimal session-derived display data into a nested client sidebar component
- Keep sidebar mode state and viewport detection entirely inside the client boundary

This preserves App Router server defaults while limiting client behavior to the interaction layer.

### Data Shape

The client sidebar should receive only what it needs:

- user name
- user email
- derived initials
- navigation items

No business records or dashboard content should be pushed into the sidebar state layer.

## Visual Direction

The sidebar should stay within the existing MYC dashboard visual language:

- dark navy base
- restrained blue accents
- soft borders
- spacious radius
- premium but subtle shadows

Expanded mode should feel like a strong navigation rail.

Mini mode should feel intentional, not like truncated overflow. Spacing, icon centering, and tooltip behavior are critical.

## Accessibility

Requirements:

- All navigation items remain keyboard reachable
- Toggle button has an accessible name
- Mini-mode icons retain screen-reader labels
- Focus states remain visible
- Sign-out remains available without hover-only discovery

Removing visible text in mini mode must not remove semantic meaning.

## Implementation Boundaries

Expected files:

- `components/layout/app-shell.tsx`
- new small sidebar support components in `components/layout/` if needed
- optional related tests for client sidebar behavior if the current test setup makes them practical

Avoid touching:

- business logic in `lib/`
- authenticated page files unless required for shell integration
- data schemas
- API routes

## Testing Strategy

At minimum, verify:

- Expanded mode renders labels and user details
- Mini mode hides labels visually but preserves accessible naming
- Toggle changes mode correctly
- Default mode is expanded on regular desktop assumptions
- Full-width mode initializes as mini
- Existing `AppShell` consumers still render without extra props changes

If unit tests are practical, prefer focused component tests for the client sidebar state logic rather than broad page tests.

## Validation Criteria

The work is successful when:

- The sidebar branding feels clearly MYC and no longer relies on the old `APU para obras en Peru` line
- The user area feels intentionally designed instead of placeholder-like
- The navigation remains easy to scan in expanded mode
- The mini sidebar works comfortably on large screens
- The content area feels more balanced on full-width layouts
- Manual toggle and automatic behavior coexist without confusion
- No dashboard routes lose navigability or accessibility

## Execution Order

1. Extract sidebar responsibilities from `AppShell` into focused layout components
2. Add brand block and replace headline copy
3. Implement expanded and mini navigation rendering
4. Implement improved user card for both modes
5. Add automatic full-width collapse logic and manual toggle
6. Persist the sidebar override locally
7. Run lint/tests and verify responsive behavior
