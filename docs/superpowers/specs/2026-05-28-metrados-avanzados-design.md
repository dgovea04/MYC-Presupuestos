# Advanced Quantity Takeoff Module Design

## Overview

MYC Presupuestos will add a new `metrados-avanzados` module for advanced construction quantity takeoff sheets. The first version will be persistent from the beginning, backed by Prisma, and will provide a modern SaaS workflow inspired by advanced Excel metrado templates.

The module focuses on:

- Creating and managing metrado sheets by project, budget, and partida.
- Editing compact Excel-style rows with formula-driven partials.
- Calculating totals with decimal-safe math.
- Validating row inputs before totals are sent back to budgets.
- Keeping export/import and future Google Sheets or AI suggestions behind clean service boundaries.

## Route And Entry Point

The main route will be:

- `app/metrados-avanzados/page.tsx`

The route will require an authenticated session and render inside `AppShell`, consistent with dashboard and budget pages. It will load user-owned projects, budgets, budget items, templates, and recent metrado sheets through `lib/data/metrados.ts`.

The sidebar should add a direct entry:

- Label: `Metrados`
- Href: `/metrados-avanzados`
- Icon: `Ruler`, `Table2`, or another available lucide icon that reads as quantity takeoff.

## Component Structure

Create reusable components under `components/metrados/`:

- `MetradosDashboard.tsx`: overall module shell, recent sheets, filters, and active editor state.
- `MetradoTemplateSelector.tsx`: template cards for Concrete, Rebar, Formwork, Masonry, Plaster, Paint, Excavation, Flooring, Roofing, and Custom.
- `MetradoSheetTable.tsx`: client-side editable spreadsheet-style table.
- `MetradoFormulaBar.tsx`: active cell and formula display/editor.
- `MetradoSummaryPanel.tsx`: totals by unit and linked partida status.
- `MetradoValidationPanel.tsx`: row-level and sheet-level validation alerts.
- `MetradoExportActions.tsx`: save draft, export, import, and send total to linked partida.

The route file should stay small. It should fetch data, map Prisma records into typed view models, and delegate rendering to these components.

## Domain Types

Add strict shared types in `types/metrado.ts`:

- `MetradoTemplateType`
- `MetradoUnit`
- `MetradoSheetStatus`
- `MetradoSheetRecord`
- `MetradoRowRecord`
- `MetradoTemplateRecord`
- `MetradoFormulaRecord`
- `MetradoPartidaLinkRecord`
- `MetradoValidationIssue`
- `MetradoCalculationResult`

Allowed units for the first version:

- `m`
- `m2`
- `m3`
- `kg`
- `und`
- `glb`

Avoid `any`. Formula inputs should be represented with explicit keys such as `largo`, `ancho`, `alto`, `cantidad`, `longitud`, `pesoUnitario`, `area`, `factor`, and `manual`.

## Prisma Data Model

Add models to `prisma/schema.prisma` using Prisma-style PascalCase names while matching the required conceptual tables:

- `MetradoSheet` maps to `metrado_sheets`
- `MetradoRow` maps to `metrado_rows`
- `MetradoTemplate` maps to `metrado_templates`
- `MetradoFormula` maps to `metrado_formulas`
- `MetradoPartidaLink` maps to `metrado_partida_links`

Core relationships:

- `MetradoSheet.userId -> User.id`
- `MetradoSheet.projectId -> Project.id`
- `MetradoSheet.budgetId -> Budget.id`
- `MetradoSheet.templateId -> MetradoTemplate.id`
- `MetradoRow.sheetId -> MetradoSheet.id`
- `MetradoPartidaLink.sheetId -> MetradoSheet.id`
- `MetradoPartidaLink.budgetItemId -> BudgetItem.id`

`MetradoSheet` should store current total, unit, status, and timestamps. `MetradoRow` should store sector/eje/nivel grouping fields, description, unit, formula key, decimal inputs as JSON, calculated partial, validation status, and sort order.

`BudgetItem` should gain a relation to `MetradoPartidaLink` so a metrado can update the linked partida quantity.

## Calculation And Formula Engine

Add calculation logic under:

- `lib/calculations/metrados.ts`
- `lib/metrados/formula-engine.ts`
- `lib/metrados/templates.ts`
- `lib/metrados/validation.ts`

All numeric calculations must use `decimal.js`. The formula engine must not use `eval`, `Function`, or arbitrary JavaScript parsing. It will resolve known formula keys from template definitions.

Initial formula keys:

- `volume`: `largo * ancho * alto`
- `area`: `largo * ancho`
- `linear`: `longitud * cantidad`
- `rebarWeight`: `cantidad * longitud * pesoUnitario`
- `formworkArea`: `perimetro * altura`
- `factorArea`: `area * factor`
- `manual`: `manual`

Rows with invalid or missing required inputs should calculate a zero partial and emit validation issues. Sheet totals should group by unit and expose the primary linked total when the row units match the sheet or linked partida unit.

## Data Access And API Layer

Add `lib/data/metrados.ts` for Prisma reads and writes:

- list sheets for a user
- create sheet
- update sheet metadata
- upsert rows
- delete rows
- duplicate rows
- link sheet to budget item
- send total to linked budget item

Add API routes under `app/api/metrados-avanzados/`:

- `route.ts`: list/create sheets
- `[id]/route.ts`: read/update/delete sheet
- `[id]/rows/route.ts`: row upsert/delete payloads
- `[id]/export/route.ts`: Excel export
- `[id]/import/route.ts`: import boundary
- `[id]/send-to-partida/route.ts`: update linked budget item quantity

Server handlers should validate ownership through the authenticated user and project/company relationships before returning or mutating data.

## Excel And Future Integrations

Add export/import services:

- `lib/metrados/excel-export.ts`
- `lib/metrados/excel-import.ts`

Excel export should use `exceljs`, freeze headers, include metadata, preserve grouping fields, formula labels, inputs, partials, totals, and validation status.

Excel import can start as a structured parsing boundary that accepts workbook rows into typed draft rows. It should return validation issues rather than mutating the sheet blindly. The Google Sheets future path should be represented as an adapter interface, not as a dependency in this version.

## User Experience

The dashboard should feel like the rest of the MYC SaaS app: clean, technical, compact, and professional.

The first screen should show:

- Sheet count and recent activity.
- Drafts needing validation.
- Recently linked partidas.
- A create-new-sheet flow.

The editor should show:

- A compact formula bar above the table.
- Sticky table headers.
- Inline editing for grouping fields, description, unit, formula, and inputs.
- Row actions for add, duplicate, and delete.
- Clear totals in the summary panel.
- Validation alerts grouped by severity.
- Save draft, export Excel, import Excel, and send total actions.

The table should be useful immediately, but full spreadsheet navigation can be incremental. The first version should prioritize reliable editing, visible formulas, and safe totals.

## Validation Rules

Validation should flag:

- Missing project, budget, partida, or template selection.
- Unsupported unit.
- Required formula inputs missing or negative when not allowed.
- Mixed units when sending a total to a linked partida.
- Rows with a formula key not supported by the selected template.
- Empty sheets.

Warnings should not block saving drafts. Errors should block sending totals to linked partidas.

## Testing

Add focused tests for:

- Formula calculations in `lib/calculations/metrados.test.ts`.
- Template formula resolution.
- Validation rules.
- Totals grouped by unit.
- Send-to-partida service behavior with decimal-safe totals.
- Excel export shape where practical.

Tests should use real domain code and avoid UI implementation details except for component-level tests that verify visible workflow states.

## Implementation Boundaries

This version will not add Google Sheets OAuth, AI-generated formulas, collaborative live editing, or a full Excel keyboard engine. It will prepare the architecture for those features through service boundaries and explicit types.

The implementation should reuse existing app patterns, UI primitives, `AppShell`, lucide icons, `decimal.js`, Prisma, and `exceljs`. It should avoid new dependencies unless a concrete blocker appears.
