# Project Duplication Design

## Context

The projects table currently supports opening, editing, and deleting projects from `components/projects/projects-table.tsx`.

The user wants a new `Duplicar` action that creates a new project from an existing one. In this codebase, a project can own a large technical tree through `Project -> Budget -> BudgetLevel/BudgetItem/Apu/...`, plus project-level polynomial formulas.

Because this application models construction budgeting workflows with strict financial precision, the duplication behavior must be explicit about what is copied and what is reset.

## Goal

Add a project duplication flow that creates a new project by cloning the source project's editable technical base while resetting generated or historical operational data.

The result should let the user use an existing project as a template for a new one without carrying over prior execution history.

## Non-Goals

- No redesign of the projects page beyond adding the new action
- No changes to the project creation form
- No new database schema changes
- No cloning of exported files or report records
- No duplication across users or companies

## Approved Behavior

The approved duplication mode is:

- Copy the project record and its technical budgeting structure
- Reset historical or derived execution data

### Data copied

- Project metadata:
  - company
  - name, with a copy suffix
  - client
  - location
  - project type
  - dates
  - status
- Budget tree:
  - general budget
  - sub-budgets
  - parent-child relationships
  - rate fields and totals stored on the copied records
- Budget structure:
  - budget levels
  - budget items
  - APU records
  - APU resources
  - general expense records
  - general expense groups
  - general expense titles
  - general expense items
  - footer rows
- Polynomial formula structure:
  - formulas
  - monomials
  - monomial components

### Data not copied

- Work schedules
- Work schedule items
- Work schedule monthly distributions
- Valuations
- Adjustment calculations
- Adjustment calculation terms
- Generated report records

## Naming Rule

The duplicated project should default to:

- `<original name> (copia)`

If that exact name already exists for the same user/company portfolio, the backend should still create a valid duplicate by appending a numeric suffix:

- `<original name> (copia 2)`
- `<original name> (copia 3)`

The rule should be deterministic and server-side so the UI does not have to guess availability.

## UX Flow

The projects table should expose a `Duplicar` action alongside the current row actions.

Recommended flow:

1. User clicks `Duplicar`
2. UI disables the action for that row while the request is in flight
3. Backend creates the duplicate
4. Table updates and shared dashboard/budget views are revalidated
5. User can open the new project immediately

This should match the tone of the current CRUD flows and reuse the existing optimistic refresh pattern where practical.

## Architecture

## Backend

Add a dedicated duplication service in the project data layer.

Recommended entry point:

- `duplicateProject(sourceProjectId, userId)`

Responsibilities:

- Validate source project ownership
- Load the full source graph needed for duplication
- Create a new project inside a single transaction
- Maintain old-to-new ID maps for each copied relation layer
- Copy allowed records in dependency order
- Skip excluded historical records

This logic should live in `lib/data/projects.ts` or a nearby focused service, not in the route handler.

### Route

Add a dedicated endpoint:

- `POST /api/projects/[id]/duplicate`

Responsibilities:

- Validate session
- Invoke duplication service
- Record an activity event for the new project
- Revalidate affected pages
- Return the duplicated project payload

## Data Copy Order

To keep relationships valid, duplication should happen in this order:

1. Project
2. Budgets
3. Budget levels
4. Budget items
5. APUs
6. APU resources
7. General expenses and hierarchy
8. Footer rows
9. Polynomial formulas
10. Polynomial monomials
11. Polynomial monomial components

Each stage should use explicit ID maps from source IDs to destination IDs.

## Reset Rules

The duplicated project should not inherit prior execution state.

Rules:

- No work schedule records are created from the source
- No valuation rows are copied
- No adjustment/reajuste history is copied
- No report export history is copied

This keeps the duplicate usable as a new base project rather than a financial snapshot.

## Error Handling

Requirements:

- If the project does not belong to the authenticated user, return a permission error
- If duplication fails midway, the transaction must roll back fully
- The UI should show a concise row-level or page-level error message using the current table pattern

## Testing Strategy

Add tests first for the duplication behavior.

At minimum, verify:

- A duplicate project is created for an owned source project
- The new project gets a copy-safe name
- Budgets and nested technical records are cloned
- Parent-child relationships are remapped correctly
- Polynomial formula relations point to cloned budgets/items/resources
- Work schedules are not copied
- Valuations and adjustments are not copied
- Unauthorized users cannot duplicate a project

Prefer data-layer tests for the duplication service plus a focused API route test if the current test setup makes it practical.

## Validation Criteria

The work is successful when:

- The projects table shows a `Duplicar` action
- Duplicating a project creates a new project without mutating the source
- The duplicate keeps the editable technical setup needed to continue budgeting work
- The duplicate does not carry historical schedule or financial execution data
- The new project appears correctly in projects, dashboard, and budgets views

## Implementation Notes

- Reuse existing authentication, activity log, and revalidation patterns from the current project routes
- Keep calculation logic isolated from UI
- Preserve decimal-safe values exactly as stored; do not recalculate values during the clone unless a later validation step explicitly requires it
- Keep the duplication logic testable without depending on UI components
