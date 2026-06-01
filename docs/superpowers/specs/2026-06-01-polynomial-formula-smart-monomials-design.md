# Smart Polynomial Formula Monomials Design

## Context

MYC Presupuestos currently generates polynomial formula monomials from broad budget cost groups:

- `LABOR`
- `MATERIALS`
- `EQUIPMENT`
- `OTHERS`
- `GENERAL_EXPENSES_PROFIT`

This is a useful base, but it is too coarse for Peruvian polynomial formulas when materials contain high-incidence inputs such as cement, steel, aggregates, masonry, wood, finishes, sanitary materials, or electrical materials.

Reference workbooks reviewed:

- `presupuesto-ejemplo/Formula_Polinomica-estructuras.xlsx`
- `presupuesto-ejemplo/Formula Polinomica-arquitectura.xlsx`
- `presupuesto-ejemplo/Formula_Polinomica-sanitarias.xlsx`
- `presupuesto-ejemplo/Formula_Polinomica-electricas.xlsx`

The references show a two-level model:

- Final formula monomials with a factor/coefficient used in `K`.
- Internal IU composition rows with percentage and coefficient contribution for auditability.

The goal is to make formula generation more advanced and intelligent while preserving user control for the final grouping.

## Goals

- Start every calculation from the existing broad cost groups.
- Always keep `LABOR` as its own monomial.
- Always keep `GENERAL_EXPENSES_PROFIT` as its own monomial.
- Expand `MATERIALS` by IU family because material inputs usually drive the formula structure.
- Keep `EQUIPMENT` as a monomial only when its coefficient is at least `0.050`; otherwise recommend or preliminarily merge it.
- Avoid leaving `OTHERS` as a final monomial when it is `0.000` or below `0.050`.
- Generate a preliminary proposal with at most 10 monomials.
- Let the user perform the final manual merge, for example reducing 9 monomials to 5.
- Show a DEV composition view for each monomial, similar to the Excel references.
- Keep IU family classification internal to polynomial formula logic. Do not modify the official IU catalog.
- Preserve financial and coefficient precision rules:
  - Amount display follows global currency decimal settings.
  - Coefficients and K values always use 3 decimals.
  - Calculation logic remains isolated from UI and testable.

## Non-Goals

- Do not change the official IU catalog schema or add permanent catalog categories.
- Do not replace the existing formula module architecture.
- Do not force the final monomial grouping automatically without user control.
- Do not implement configurable rule editing in the first version.
- Do not attempt to exactly clone the Excel visual layout as the main UI.

## Proposed Architecture

### Calculation Layer

`lib/calculations/polynomial-formula.ts` remains the home for pure rules:

- Coefficient rounding.
- K rounding.
- Coefficient sum validation.
- Minimum coefficient diagnostics.
- Group merge calculations.
- Maximum monomial count validation.

New pure functions should be added here or in a focused sibling calculation module when the file becomes too large.

### IU Family Classification

Add an internal classifier:

`lib/polynomial-formula/iu-family-classifier.ts`

This module maps IU code/name into a polynomial formula family. It is only for formula grouping and does not mutate IU records.

Initial family examples:

- `LABOR`
- `GENERAL_EXPENSES`
- `STEEL`
- `CEMENT`
- `AGGREGATES`
- `MASONRY`
- `WOOD`
- `FINISHES`
- `SANITARY_INSTALLATIONS`
- `ELECTRICAL_INSTALLATIONS`
- `EQUIPMENT`
- `OTHERS`

The classifier should be deterministic and covered by tests. It can use IU code-first rules where known and name-token fallback rules where needed.

### Data Orchestration

`lib/data/polynomial-formulas.ts` should orchestrate:

- Loading budget items, APU resources, resource IU codes, and amounts.
- Building broad cost groups first.
- Expanding materials into IU-family incidence groups.
- Applying preliminary merge rules.
- Persisting formula monomials.
- Persisting composition snapshots for auditability.

### UI Layer

Components under `components/budget` should only render and edit:

- Proposed/final monomials.
- Validation diagnostics.
- DEV composition details.
- Manual merge actions.

No grouping calculations should live in React components.

## Generation Flow

1. User clicks `Generar formula`.
2. System calculates broad groups:
   - `LABOR`
   - `MATERIALS`
   - `EQUIPMENT`
   - `OTHERS`
   - `GENERAL_EXPENSES_PROFIT`
3. `LABOR` is kept as an anchor monomial.
4. `GENERAL_EXPENSES_PROFIT` is kept as an anchor monomial.
5. `MATERIALS` is expanded by IU and then grouped by internal IU family.
6. `EQUIPMENT` is kept only if coefficient is at least `0.050`; otherwise it is flagged for merge.
7. `OTHERS` is flagged when it is `0.000` or below `0.050`.
8. If the proposal has more than 10 monomials:
   - Merge small groups within the same family first.
   - If still above 10, merge the lowest-incidence groups even across different families.
9. The generated proposal is saved with at most 10 monomials.
10. The user can manually select monomials and merge them.
11. Manual merge recalculates amount, coefficient, display code/name, representative IU, and composition.
12. The final formula uses aggregated monomial coefficients in K, while composition rows remain available for review.

## Monomial Data Model

### Final Monomial

Each final/proposed monomial should expose:

- `id`
- `code`
- `name`
- `costGroupKey`
- `amount`
- `coefficient`
- `baseIndexCode`
- `baseIndexName`
- `baseIndexValue`
- `sortOrder`
- `composition`

### Composition Row

Each composition row should expose:

- IU code
- IU name
- IU family
- Amount
- Percentage within the monomial
- Coefficient contribution
- Source resource/item references when available

## Persistence Strategy

Persist composition snapshots rather than deriving them only at render time.

Recommended extension to `PolynomialMonomialComponent`:

- `unifiedIndexCode`
- `unifiedIndexName`
- `iuFamily`
- `participationPercentage`
- `coefficientContribution`

Reasons:

- Formula audit trails must remain stable even if resources or IU naming later changes.
- Manual merges need to preserve the internal composition.
- DEV review needs to display the exact basis of the generated formula.

Migration should preserve existing components by leaving new fields nullable where needed.

## Preliminary Merge Rules

Preliminary merge is a suggestion and preparation step, not the user's final decision.

Rules:

- Preserve `LABOR`.
- Preserve `GENERAL_EXPENSES_PROFIT`.
- Split `MATERIALS` by IU family.
- Keep high-incidence material families as separate monomials.
- Mark groups below `0.050` as weak.
- Prefer merging weak groups into compatible family groups.
- If more than 10 monomials remain, merge lowest-incidence groups until count is 10.
- Track every merge in composition rows.

The user can then manually merge further.

## Manual Merge UX

Add an explicit `Juntar monomios` action to the monomials section.

Flow:

1. User selects two or more monomials.
2. User clicks `Juntar monomios`.
3. UI shows a compact merge dialog:
   - Result code.
   - Result name.
   - Representative IU.
   - Preview amount and coefficient.
   - Composition rows that will be combined.
4. User confirms.
5. UI recalculates the formula proposal.
6. Validation updates immediately.

The merge should be reversible only through normal editing/regeneration in the first version. Full undo history is not required for DEV.

## Validation UX

Replace the current simple validation with an operational diagnostic summary:

- `Suma coeficientes`: must be `1.000`.
- `Anclas`: `LABOR` and `GENERAL_EXPENSES_PROFIT` present.
- `Monomios`: current count against max 10.
- `Coeficientes bajos`: list non-anchor monomials below `0.050`.
- `Varios`: flag if `OTHERS` remains at `0.000` or below `0.050`.
- `Indices pendientes`: base indices missing.
- `Sugerencias`: preliminary merge recommendations.

Warnings should not hide the table; they should guide the user to finalize the formula.

## DEV Composition View

Add an expandable detail view under each monomial.

Columns:

- IU
- Familia
- Monto
- % dentro del monomio
- Coeficiente aportado

Formatting:

- Amounts use global currency decimal settings.
- Percentages use 2 decimals.
- Coefficient contribution uses 3 decimals.
- Coefficients in formula/K always use 3 decimals.

This DEV view can be visually compact and explicit, prioritizing auditability over polish.

## Error Handling

- If a resource lacks IU, include it in an `OTHERS` or `UNASSIGNED` composition bucket and warn.
- If an IU cannot be classified, classify as `OTHERS` and warn only when it materially affects grouping.
- If base index data is missing for a representative IU, keep the monomial but mark index assignment pending.
- If merge would create invalid coefficient sum due to rounding drift, rebalance with the existing coefficient rounding allocation strategy.

## Testing Plan

Add or update unit tests for:

- `LABOR` is always preserved.
- `GENERAL_EXPENSES_PROFIT` is always preserved.
- `MATERIALS` expands by IU family.
- `EQUIPMENT` remains only when coefficient is at least `0.050`.
- `OTHERS` below `0.050` is flagged for merge.
- Preliminary proposal never exceeds 10 monomials.
- Coefficients sum to `1.000`.
- Manual merge recalculates amount and coefficient.
- Manual merge preserves composition rows.
- IU family classifier does not modify IU catalog records.
- Amount formatting follows global currency decimals.
- Coefficient and K formatting remain fixed at 3 decimals.

## Rollout

Phase 1:

- Add IU classifier.
- Add smart generation service.
- Persist composition snapshot fields.
- Add tests.

Phase 2:

- Update formula generation to use the smart proposal.
- Add validation diagnostics.
- Add DEV composition view.

Phase 3:

- Add manual merge action.
- Add merge dialog.
- Add merge tests.

Phase 4:

- Refine labels and representative IU selection with real project data.
- Compare against the four Excel references.

## Resolved Decisions

- Visual companion is not needed.
- User wants the system to make preliminary joins.
- User performs the final join manually.
- IU families are internal to formula logic only.
- Development view should show composition detail.
- Broad groups are always the starting point.
- Materials are the primary target for IU-family expansion.
