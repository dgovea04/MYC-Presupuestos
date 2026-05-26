# Monte Carlo Risk Analysis Design

## Context

MYC Presupuestos needs a risk analysis module for construction budgets inspired by @RISK, XL Risk, Primavera Risk, and Oracle Crystal Ball. Phase 1 focuses on uncertainty in quantities/metrados only, using triangular distributions and 10,000 Monte Carlo iterations.

The module must feel professional, engineering-oriented, financial-grade, Excel-inspired, and consistent with the existing modern SaaS UI.

## Scope

Phase 1 includes:

- Quantity deviation risk only.
- Triangular distribution only.
- Fixed 10,000 iterations.
- Histogram chart.
- Cumulative S-curve chart.
- Percentiles P10, P50, P80, P90, and P95.
- Mean, median, variance, standard deviation, skewness, and kurtosis.
- Persistent risk variables in the database.
- Persistent summary of the latest simulation run.
- Web worker execution for heavy calculations.
- Reusable UI components and isolated calculation logic.

Phase 1 excludes:

- Unit price risk.
- PERT, normal, or uniform distributions.
- Correlations.
- Tornado/sensitivity chart.
- PDF or Excel export.
- Persisting all 10,000 iteration-level results.

## Routing

Create a new budget-scoped route:

```txt
app/budgets/[id]/risk-analysis/page.tsx
```

The route must work for both budget kinds:

- `SUB_BUDGET`: analyze the budget's own `BudgetItem` rows.
- `GENERAL`: analyze a consolidated set of all `BudgetItem` rows from the project's child sub budgets, preserving the source sub budget name for context.

The page remains a Server Component by default. It loads authenticated budget context and passes serializable data into the client dashboard.

## Data Model

Add persistent risk models to Prisma.

### RiskVariable

Stores uncertainty ranges for budget items.

Fields:

- `id`
- `budgetId`
- `budgetItemId`
- `variableType`: phase 1 supports `QUANTITY`.
- `distributionType`: phase 1 supports `TRIANGULAR`.
- `minimum`
- `mostLikely`
- `maximum`
- `enabled`
- `createdAt`
- `updatedAt`

Rules:

- A risk variable belongs to the analysis budget through `budgetId`.
- `budgetItemId` points to the concrete item being simulated.
- For a general budget, `budgetItemId` may point to an item in a child sub budget from the same project.
- Use decimal columns for persisted financial and quantity parameters.
- Add useful indexes for `budgetId`, `budgetItemId`, and a uniqueness constraint that prevents duplicate quantity variables for the same analysis budget and item.

### RiskSimulationRun

Stores the latest summarized simulation output without keeping all iteration results.

Fields:

- `id`
- `budgetId`
- `iterations`
- `baseTotal`
- `mean`
- `median`
- `variance`
- `standardDeviation`
- `skewness`
- `kurtosis`
- `p10`
- `p50`
- `p80`
- `p90`
- `p95`
- `histogramBins`
- `sCurvePoints`
- `createdAt`

Rules:

- Store chart data as JSON.
- Do not persist each iteration result in Phase 1.
- The UI reads the most recent run for a budget as the last known result.

## Normalized Input

The simulation dashboard works from a normalized item shape:

```ts
type RiskBudgetItem = {
  itemId: string;
  budgetId: string;
  sourceBudgetName: string;
  code: string;
  description: string;
  unit: string;
  baseQuantity: number;
  unitPrice: number;
  baseTotal: number;
};
```

For sub budgets, `sourceBudgetName` is the current budget name. For general budgets, it is the child sub budget name.

## Simulation Engine

Create pure, testable logic under `lib/risk/`.

Files:

- `lib/risk/types.ts`
- `lib/risk/monte-carlo-engine.ts`
- `lib/risk/monte-carlo-worker-client.ts`
- `lib/risk/monte-carlo.worker.ts`
- `lib/risk/statistics.ts` if splitting metrics improves clarity.

Core algorithm:

1. Start with the base total.
2. For each iteration, loop through enabled variables.
3. Generate a simulated quantity using triangular distribution.
4. Replace the item's base partial with `simulatedQuantity * unitPrice`.
5. Sum the simulated budget total.
6. Store iteration totals in memory.
7. Sort totals and derive summary statistics, percentiles, histogram bins, and S-curve points.

Triangular distribution:

- Validate `minimum <= mostLikely <= maximum`.
- Validate non-negative parameters.
- Sample using the inverse CDF.
- Always keep generated values inside `[minimum, maximum]`.

Financial handling:

- Persisted parameters use decimal-safe storage.
- UI/API formatting uses the project's currency settings.
- Worker calculations use `number` for performance and round final financial outputs consistently.
- Calculation logic stays outside UI components.

## Web Worker

Run 10,000 iterations in a web worker to keep the UI responsive.

Worker input:

- normalized items
- enabled variables
- fixed iterations count
- budget totals context

Worker output:

- progress events
- final simulation summary
- validation or execution errors

The worker must not import server-only modules or Prisma code.

## API Design

Add budget-scoped route handlers.

```txt
GET /api/budgets/[id]/risk-analysis
PUT /api/budgets/[id]/risk-analysis/variables
POST /api/budgets/[id]/risk-analysis/runs
```

### GET

Returns:

- normalized budget items
- current risk variables
- latest simulation run summary
- budget/project context

Authorization:

- The budget must belong to the authenticated user's company.

### PUT Variables

Supports create, update, enable/disable, and delete semantics for risk variables.

Validation:

- Zod schema.
- No `any`.
- Phase 1 accepts only `QUANTITY` and `TRIANGULAR`.
- Values must be non-negative.
- `minimum <= mostLikely <= maximum`.
- The target item must be accessible from the analysis budget.

### POST Runs

Persists the summarized result of a completed worker simulation.

Validation:

- fixed `iterations = 10000`.
- all required metrics present.
- histogram and S-curve JSON match expected shapes.
- user has access to the budget.

## Client State

Use Zustand for dashboard state.

Store responsibilities:

- active variables
- last simulation result
- simulation status: idle, running, completed, failed
- progress
- modal state
- selected or edited variable
- client-side validation messages

The API remains the source of truth for persisted variables and last run summaries.

## UI Design

The screen should feel like a risk workbook inside a modern SaaS product: compact, dense, readable, and Excel-inspired.

Create components under `components/risk/`:

- `risk-analysis-dashboard.tsx`
- `risk-variables-table.tsx`
- `risk-variable-modal.tsx`
- `risk-kpi-cards.tsx`
- `histogram-chart.tsx`
- `s-curve-chart.tsx`
- `percentiles-table.tsx`
- `simulation-toolbar.tsx`
- `risk-validation-panel.tsx`

Dashboard layout:

- Compact header with budget name, budget type, base total, latest run timestamp, and run action.
- KPI cards for P50, P80, P90, standard deviation, variance, and kurtosis.
- Main risk variable table with spreadsheet-like density.
- Histogram chart.
- S-curve chart.
- Percentiles table with amount, delta from base, and contingency percentage.
- Validation panel for invalid ranges, disabled variables, and items with missing quantity or unit price.

Risk variable modal:

- Create or edit one variable for an item.
- Shows item code, description, unit, base quantity, unit price, and base partial.
- Inputs for minimum, most likely, and maximum.
- Toggle enabled state.
- Save and delete actions.

Charts:

- Use Recharts.
- Histogram uses simulation cost bins.
- S-curve uses cumulative probability points.
- Charts must gracefully handle no-result and empty-variable states.

Table:

- Use TanStack Table.
- Columns: partida, source sub budget, base quantity, min, most likely, max, enabled state, actions.
- Sticky header and compact rows.
- Clear invalid range styling.

## Navigation

Add visible access points:

- Budget quick action card: "Riesgos Monte Carlo".
- Sub budget flow/action entry to `/budgets/[id]/risk-analysis`.
- Sidebar may expose a top-level "Riesgos" entry if a useful index page is added later; Phase 1 only requires budget-scoped access.

## Error Handling

User-facing cases:

- No budget items available.
- No variables configured.
- Invalid variable ranges.
- Simulation worker failure.
- API save failure.
- Attempt to reference an inaccessible item.

The UI should keep existing data visible after failures and show concise recovery actions.

## Testing

Unit tests:

- Triangular sampling keeps values in range.
- Percentile calculations.
- Mean, median, variance, standard deviation.
- Skewness and kurtosis.
- Histogram bin generation.
- S-curve generation.
- Simulation result shape for deterministic random input.

API/validation tests:

- Reject inaccessible budgets.
- Reject item references outside the budget/project scope.
- Reject invalid triangular ranges.
- Persist and retrieve variables.
- Persist latest run summary.

UI tests:

- Dashboard renders with empty state.
- Variables table renders configured variables.
- Modal validates range order.
- Last simulation summary displays percentiles and KPIs.

Verification:

- `npm run test`
- `npm run lint`
- `npm run build`

## Implementation Notes

- Follow existing App Router patterns.
- Keep Server Components by default and isolate client interactivity in dashboard components.
- Do not introduce statistical dependencies unless implementation proves the local engine is insufficient.
- Use existing UI primitives from `components/ui`.
- Keep calculation formulas independent from React.
- Avoid unrelated architecture changes.
