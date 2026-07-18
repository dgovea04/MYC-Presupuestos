# Khipu Risk Agent And Monte Carlo Improvements Design

## Context

MC Presupuestos already has a Monte Carlo risk module with a dedicated budget page, risk variables, correlations, a web worker simulation engine, persisted runs, charts, schedule duration simulation, and PDF export.

The current module is strong as a manual analytical tool. The next product step is to make it agent-assisted without allowing the agent to mutate financial risk data silently. Khipu should propose variables, explain assumptions, let the user review and edit, and only save or execute after explicit confirmation.

## Goals

- Improve Monte Carlo precision, auditability, reproducibility, and scalability.
- Add automatic risk variable suggestions for quantity, unit price, and duration.
- Add named risk scenarios that can be reviewed, saved, simulated, and compared.
- Connect Khipu Agente to the risk module through explicit tools.
- Require human review before saving variables, correlations, scenarios, or simulation runs.
- Keep all financial and simulation logic isolated from UI.

## Non-Goals

- No automatic budget mutation from risk results.
- No market price fabrication by the LLM.
- No replacement of the current `lib/risk/monte-carlo-engine.ts` architecture.
- No new large UI framework.
- No unconstrained free-form agent writes to Prisma tables.

## Current Implementation Summary

Implemented today:

- `RiskVariable` for quantity, unit price, and duration uncertainty.
- `RiskCorrelation` with pairwise coefficients.
- `RiskSimulationRun` with percentiles, histogram, S-curve, and schedule summary.
- `runMonteCarloSimulation` in `lib/risk/monte-carlo-engine.ts`.
- Decimal-safe item total replacement during simulation.
- Statistics helpers in `lib/risk/statistics.ts`.
- Client web worker execution.
- UI for variables, validation, correlations, schedule exposure, charts, percentiles, and PDF export.
- Khipu skill registration for `montecarlo_risk_analysis`, currently advisory only.

Main gaps:

- No persisted seed or model snapshot for reproducibility.
- Statistics use `number` after per-iteration totals.
- No saved scenarios.
- No automatic variable suggestion service.
- No Khipu agent tools for risk read, suggest, save, simulate, or summarize.
- No risk-specific approval workflow in the agent bundle.

## Product Flow

### Agent-Assisted Risk Setup

1. User asks Khipu to analyze risk for a budget.
2. Khipu reads current risk payload and schedule context.
3. Khipu proposes variables with min, most likely, max, distribution, confidence, and reason.
4. The UI shows suggested variables in a review table.
5. User accepts, edits, or rejects each suggestion.
6. User confirms "Guardar variables y ejecutar simulacion".
7. The system saves accepted variables, creates or updates a scenario, runs Monte Carlo, persists the run, and shows real backend results.

### Manual Risk Setup

The existing manual variable and correlation workflow remains. Agent suggestions are additive, not mandatory.

### Scenario Comparison

Users can create scenarios such as:

- Base tecnico
- Conservador
- Lluvias y baja productividad
- Inflacion de materiales
- Agresivo / optimista

Each scenario stores variable values and correlations. Simulations are linked to scenarios so results can be compared.

## Data Model

### New Model: RiskScenario

Fields:

- `id`
- `budgetId`
- `name`
- `description`
- `source`: `MANUAL | AGENT`
- `status`: `DRAFT | APPROVED | ARCHIVED`
- `createdByUserId`
- `createdAt`
- `updatedAt`

### Extend RiskVariable

Add optional:

- `scenarioId`
- `source`: `MANUAL | AGENT | HEURISTIC`
- `confidence`: decimal from 0 to 1
- `rationale`: text

Existing unique behavior must remain intact:

- global/default variables keep `scenarioId = null`
- global/default variables remain unique per `(budgetId, budgetItemId, variableType)`
- scenario variables are unique per `(budgetId, scenarioId, budgetItemId, variableType)`

PostgreSQL treats `NULL` values as distinct inside regular unique indexes, so this must be implemented with partial unique SQL indexes:

- `RiskVariable_budget_global_unique` on `(budgetId, budgetItemId, variableType)` where `scenarioId IS NULL`
- `RiskVariable_budget_scenario_unique` on `(budgetId, scenarioId, budgetItemId, variableType)` where `scenarioId IS NOT NULL`

Prisma schema should keep non-unique indexes for query support and the migration should create the partial unique indexes manually.

### Extend RiskCorrelation

Add optional:

- `scenarioId`
- `source`
- `rationale`

### Extend RiskSimulationRun

Add:

- `scenarioId`
- `seed`
- `engineVersion`
- `modelSnapshot`
- `createdByUserId`

`modelSnapshot` stores the exact variables, correlations, budget base total, affected items, schedule lines, iteration count, and engine version used for the run.

## Simulation Engine Improvements

### Reproducibility

Add seeded PRNG support to the public simulation API:

```ts
export type MonteCarloSimulationOptions = {
  seed?: string;
  random?: () => number;
  onProgress?: (completedIterations: number, totalIterations: number) => void;
  progressInterval?: number;
  histogramBinCount?: number;
  sCurvePointCount?: number;
};
```

If `random` is provided, it wins. If `seed` is provided, build deterministic random from the seed. If neither is provided, keep `Math.random`.

### Decimal-Safe Statistics Boundary

Keep per-iteration values as numbers for charting, but introduce decimal-safe summary helpers for mean and variance-sensitive fields where practical. Percentiles can still operate on sorted finite numbers, but summary rounding must remain centralized in `lib/risk/statistics.ts`.

### Model Snapshot

Before saving a run, the server must rebuild the authoritative simulation input from stored variables/scenario data instead of trusting client totals. The saved run stores the resulting snapshot.

## Risk Variable Suggestions

Create a deterministic suggestion service first. The LLM may explain and rank, but numeric proposals must pass the deterministic schema and bounds.

Inputs:

- risk payload
- work schedule summary
- optional strategy: `balanced | conservative | aggressive`
- optional maximum suggestions

Outputs:

```ts
export type RiskVariableSuggestion = {
  id: string;
  budgetId: string;
  budgetItemId: string;
  variableType: RiskVariableType;
  distributionType: RiskDistributionType;
  minimum: number;
  mostLikely: number;
  maximum: number;
  confidence: number;
  reason: string;
  source: "HEURISTIC" | "AGENT";
  impactScore: number;
};
```

Heuristics:

- High partial amount: suggest `QUANTITY` or `UNIT_PRICE`.
- Critical schedule item with duration: suggest `DURATION`.
- High unit price and low quantity: prefer `UNIT_PRICE`.
- Large quantity and measurable construction unit: prefer `QUANTITY`.
- Missing or weak existing risk coverage: prioritize uncovered items.
- Critical path item with high partial amount: produce both cost and duration suggestions only when within max suggestion limit.

Default ranges:

- Balanced quantity: min 95%, likely 100%, max 110%.
- Conservative quantity: min 95%, likely 100%, max 115%.
- Aggressive quantity: min 98%, likely 100%, max 105%.
- Balanced unit price: min 97%, likely 100%, max 108%.
- Conservative unit price: min 98%, likely 100%, max 112%.
- Duration: min 90%, likely 100%, max 125% for critical items.

Distribution defaults:

- `PERT` for agent/heuristic suggestions because it softens extremes.
- `TRIANGULAR` remains available for manual controls.

## Khipu Agent Tools

Add risk tools to the agent registry:

### `getRiskAnalysis`

- Risk: `read`
- Input: `{ budgetId: string }`
- Output: risk payload summary with variables, correlations, latest run, and coverage metrics.

### `suggestRiskVariables`

- Risk: `read`
- Input: `{ budgetId: string; strategy?: "balanced" | "conservative" | "aggressive"; maxSuggestions?: number }`
- Output: suggestions plus coverage summary.

### `previewRiskScenario`

- Risk: `read`
- Input: scenario draft with accepted suggestions.
- Output: validation, expected coverage, affected total, and warnings.

### `saveRiskScenario`

- Risk: `financial`
- Requires approval.
- Input: scenario name, variables, correlations.
- Output: saved scenario id and normalized variables.

### `runRiskSimulation`

- Risk: `financial`
- Requires approval.
- Input: `{ budgetId: string; scenarioId?: string; seed?: string }`
- Server rebuilds input, runs simulation, saves run, returns real results.

### `summarizeRiskSimulation`

- Risk: `read`
- Input: `{ budgetId: string; runId?: string }`
- Output: plain-language summary, contingency recommendations, top tornado drivers, cost/plazo risks.

## Agent Safety Rules

- Khipu may suggest variables without approval.
- Khipu may not save variables, correlations, scenarios, or runs without explicit confirmation.
- Khipu may not invent P50, P80, P90, histograms, or schedule duration percentiles.
- Khipu must label suggested values as assumptions until confirmed and simulated.
- Khipu must report when data is missing: no APU, no cronograma, no variables, no critical path.
- Financial writes use existing agent approval policy with `financial` risk.

## UI Changes

Add a review surface inside the risk page:

- "Sugerencias de Khipu" panel.
- Table with item, type, distribution, min, probable, max, confidence, reason.
- Row actions: accept, edit, reject.
- Bulk actions: accept selected, reject low confidence, save draft scenario.
- Primary action: "Guardar y ejecutar simulacion".

Existing manual variable modal remains unchanged, except it can open with a suggestion prefilled.

## Reports And Exports

Risk PDF should include:

- scenario name
- seed
- engine version
- model snapshot summary
- coverage metrics
- Khipu-generated rationale for accepted suggestions when present

MCP export should include scenarios and runs with snapshot metadata.

## Testing Strategy

Unit tests:

- seeded PRNG determinism
- suggestion heuristics
- scenario validation
- model snapshot builder
- agent tool input/output schemas

Integration tests:

- save scenario
- run simulation from scenario
- stale run invalidation
- approval-required path for financial agent tools

UI tests:

- suggestion panel renders
- edit/accept/reject behavior
- "Guardar y ejecutar simulacion" calls save then run
- latest run updates after success

## Rollout Plan

Phase 1: Engine auditability and deterministic suggestions.

Phase 2: Scenario persistence and server-side simulation runs.

Phase 3: Risk review UI and Khipu suggestion panel.

Phase 4: Khipu agent tools with approval flow.

Phase 5: Reporting, MCP export, and comparison analytics.

## Open Decisions

- Default max suggestions: use 12 for first release.
- Default scenario name: `Escenario Khipu - YYYY-MM-DD HH:mm`.
- Default strategy: `balanced`.
- Saved run execution location: server-side for agent/tool execution; client worker remains for manual page execution until unified.
