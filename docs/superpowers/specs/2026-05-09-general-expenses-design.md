# General Expenses Hierarchical Template Design

## Goal

Replace the current flat General Expenses list with a hierarchical, template-driven module for each General Budget. Each General Budget must receive its own editable copy of the base structure from `presupuesto-ejemplo/Gastos_Generales.xlsx`.

## Context

The current implementation stores General Expenses as a flat list of rows with only:

- `name`
- `type`
- `amount`
- `percentage`

That shape is insufficient for the real domain described in `Gastos_Generales.xlsx`, where General Expenses are organized by:

- group
- title
- item
- category
- formulas

The Excel file shows two top-level groups:

- `GASTOS GENERALES FIJO`
- `GASTOS GENERALES VARIABLES`

Each group contains one or more titles, and each title contains one or more items. Items also carry calculation fields and must support category-specific formulas.

## Functional Requirements

### Template Initialization

- A General Budget must lazily initialize its own General Expenses structure from `presupuesto-ejemplo/Gastos_Generales.xlsx`.
- Initialization should happen only once per General Budget.
- The initialized structure must be editable without affecting any other General Budget.
- If the structure already exists for the budget, the module must reuse persisted data instead of recreating it.

### Hierarchy

The persisted structure must support:

- Group
- Title
- Item

Relationships:

- one General Budget has many General Expense Groups
- one Group has many Titles
- one Title has many Items

### Item Categories

Each item must belong to one category:

- `STANDARD`
- `PERSONAL`
- `TESTING`
- `DIRECT_COST_BASED`

UI labels can remain in Spanish:

- `Estandar`
- `Personal`
- `Ensayos`
- `En funcion del Costo Directo`

### Calculation Rules

The `Parcial` for each item must be derived from the item category and current General Budget `Costo Directo`.

Rules:

- `STANDARD`, `PERSONAL`, `TESTING`
  - `partial = quantity * unitPrice`

- `DIRECT_COST_BASED`
  - `partial = quantity * participationPercentage * totalDirectCost`

Notes:

- `participationPercentage` comes from `% Part`
- `totalDirectCost` must come from the current General Budget totals
- title totals are the sum of item partials
- group totals are the sum of title totals
- module total is the sum of group totals

### Editable Fields

Each item should support these editable fields as applicable:

- item code or outline number from template
- description
- category
- unit
- quantity description
- quantity
- `% Part`
- `PU`

Derived fields:

- partial

### UI Requirements

The General Expenses view must stop being a flat table and become a hierarchical editor:

- summary metrics at top
- group blocks
- title sections inside each group
- editable item rows inside each title
- visible subtotals by title and by group

Expected initial groups:

- `GASTOS GENERALES FIJO`
- `GASTOS GENERALES VARIABLES`

The screen must clearly communicate that calculations use the real current Direct Cost from the General Budget.

### CRUD Requirements

The user must be able to:

- edit item values
- add item rows
- delete item rows
- add titles
- delete titles

Optional for first version:

- add new groups beyond the two template groups

## Data Model

### Keep

- `Budget.generalExpensesRate`
  - still used by the main budget totals engine unless explicitly replaced later

### Replace

The current `GeneralExpense` flat entity is no longer the right primary model for this module.

Target entities:

- `GeneralExpenseGroup`
- `GeneralExpenseTitle`
- `GeneralExpenseItem`

Suggested fields:

#### GeneralExpenseGroup

- `id`
- `budgetId`
- `name`
- `kind` with values `FIXED` or `VARIABLE`
- `sortOrder`
- timestamps

#### GeneralExpenseTitle

- `id`
- `groupId`
- `code`
- `name`
- `sortOrder`
- timestamps

#### GeneralExpenseItem

- `id`
- `titleId`
- `code`
- `description`
- `category`
- `unit`
- `quantityDescription`
- `quantity`
- `participationPercentage`
- `unitPrice`
- `sortOrder`
- timestamps

Computed values such as `partial` should preferably be calculated in application code, not persisted as the source of truth, unless persistence is needed for export/performance later.

## Excel Template Parsing

The file `presupuesto-ejemplo/Gastos_Generales.xlsx` is the source of the initial structure.

Observed columns:

- `Item`
- `Descripción`
- `Unidad`
- `Cantidad Descripción`
- `Cantidad Unidad`
- `% Part`
- `PU`
- `Parcial`

The parser must:

- identify the active worksheet
- find the structural rows below the header
- detect groups from rows like `1 GASTOS GENERALES FIJO` and `2 GASTOS GENERALES VARIABLES`
- detect titles from rows like `1.1 ...`
- detect items from rows like `1.1.1 ...`
- map raw spreadsheet rows into the hierarchical entity structure

Category inference rules for template rows should be explicit in code. Initial heuristic:

- rows under personnel titles map to `PERSONAL`
- rows under testing titles map to `TESTING`
- rows like financial charges, tributes, or insurance map to `DIRECT_COST_BASED`
- everything else defaults to `STANDARD`

If needed, this inference can later be replaced by a small manual mapping table.

## API Design

The General Expenses API must evolve from row CRUD to structure CRUD.

Recommended endpoints:

- `GET /api/budgets/[id]/general-expenses`
  - returns initialized hierarchical structure with computed totals

- `POST /api/budgets/[id]/general-expenses/initialize`
  - creates the template copy if missing
  - can be called internally from the loader if preferred

- `PATCH /api/budgets/[id]/general-expenses/items/[itemId]`
  - updates an item

- `POST /api/budgets/[id]/general-expenses/titles/[titleId]/items`
  - creates a new item under a title

- `DELETE /api/budgets/[id]/general-expenses/items/[itemId]`
  - deletes an item

- `POST /api/budgets/[id]/general-expenses/groups/[groupId]/titles`
  - creates a title

- `DELETE /api/budgets/[id]/general-expenses/titles/[titleId]`
  - deletes a title

The backend must always return recalculated totals using the current Direct Cost.

## Calculation Layer

A dedicated calculations module should:

- compute item partial by category
- compute title subtotal
- compute group subtotal
- compute overall subtotal

This logic should be pure and independently tested.

## Error Handling

- If the Excel template file is missing, initialization must fail with a clear error.
- If the template already exists for a budget, initialization must not duplicate rows.
- If an item category is unknown, the system should reject it or safely default only where explicitly intended.

## Testing Strategy

Required tests:

- template parser extracts groups, titles, and items from the Excel workbook
- initialization is idempotent
- category formulas compute expected partials
- totals aggregate correctly
- API guards budget ownership

## Rollout Notes

This phase focuses on the General Expenses module itself.

It does not yet replace the official budget total derived from `generalExpensesRate`, unless a separate follow-up changes the main budget totals calculation policy.
