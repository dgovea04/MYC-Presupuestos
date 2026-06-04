# Polynomial Formula Automatic Final Adjustment Design

## Goal

Add an optional automatic final-adjustment action for polynomial formulas. The current smart generation remains the first-stage proposal: it can produce up to 9-10 preliminary monomials so the user can inspect IU grouping and manually reduce them. The new action takes that current editable proposal and produces a final normative grouping, while still letting the user preview and choose whether to apply it.

## User Experience

In the monomials section, place `Aplicar ajuste automático` beside `Juntar monomios`.

The user flow is:

1. User generates the preliminary formula.
2. User can manually merge with `Juntar monomios`, as today.
3. User can click `Aplicar ajuste automático`.
4. The system opens a preview before replacing the editable monomials.
5. The preview shows current monomials, proposed final monomials, merge explanations, coefficient totals, and rule compliance.
6. User clicks `Aplicar propuesta` to replace the editable formula, or cancels and keeps editing manually.

The action must never silently overwrite the table.

## Normative Rules

The automatic final adjustment must target a valid final formula:

- Final monomial count should be between 5 and 8 when the budget has enough economic diversity.
- No final monomial coefficient may be lower than `0.050`.
- Coefficients use three decimals and must sum to exactly `1.000`.
- Labor should remain a fixed independent monomial when present.
- General expenses and profit should remain a fixed independent monomial when present.
- Low-incidence resources or monomials are merged with an affinity-compatible group first, then with the largest compatible incidence as fallback.
- The system must not invent artificial monomials only to reach five terms. If the real composition cannot produce five meaningful groups, it should explain that the result has fewer than five economically valid groups.

## Affinity Model

The automatic engine should be deterministic and testable. It should rank merge targets by:

1. Same normalized IU code.
2. Same IU family.
3. Compatible construction families.
4. Same broad group.
5. Highest-incidence compatible monomial.

Suggested compatible family clusters:

- Cement, aggregates, masonry, concrete-related materials.
- Steel and metal-related materials.
- Wood, formwork, carpentry.
- Finishes, paint, ceramic, flooring.
- Sanitary installation materials.
- Electrical installation materials.
- Equipment and tools.
- Other residual materials.

The engine may merge across clusters only when needed to satisfy minimum coefficient or maximum monomial count, and it must emit a diagnostic explaining that fallback.

## Learning From Experience

The system can learn from previous user manual merges, but this learning must guide rather than override normative rules.

Experience should be collected from prior manual `Juntar monomios` outcomes in:

- The same formula.
- Other formulas in the same project.
- Other projects accessible to the user, when enough comparable data exists.

The learned signal should store or derive patterns such as:

- Source IU family or IU code merged into target symbol/family.
- Broad group compatibility.
- Project/subbudget specialty context when available.
- Resulting final symbol and representative IU.
- Frequency and recency of similar decisions.

Use this signal as a scoring boost in the affinity model. For example, if a user repeatedly merged small wood/formwork components into a `MA` or `CE` style monomial in prior formulas, the automatic adjustment can prefer a similar target when the current composition is comparable.

Learning constraints:

- Never create a learned merge that violates coefficient minimum, monomial count, or coefficient sum rules.
- Never apply a learned pattern without showing it in the preview explanation.
- Prefer deterministic fallback when no strong historical pattern exists.
- Keep the learning layer isolated from UI and calculations so it can be tested independently.

## Architecture

Add a pure domain service, likely under `lib/polynomial-formula/`, for final adjustment:

- Input: current `PolynomialMonomialRecord[]`, optional experience profile, and options.
- Output: proposed final monomials, merge plan, diagnostics, and rule validation.

Suggested modules:

- `final-adjustment-engine.ts`: deterministic final grouping and coefficient normalization.
- `final-adjustment-experience.ts`: derives historical merge preferences from saved formulas/manual merge history.
- `final-adjustment-types.ts`: inputs, outputs, diagnostics, and rule metadata.

The existing `smart-monomial-engine` remains responsible for the preliminary proposal. The final-adjustment engine consumes its output or the user-edited monomial table.

## Data Flow

1. Formula generation creates preliminary monomials with composition snapshots.
2. UI passes current monomials to an automatic final-adjustment action.
3. The action loads optional experience data for the project/user.
4. The domain engine computes a final merge proposal.
5. UI renders preview and diagnostics.
6. If accepted, the editor replaces `formula.monomials` with the proposed final monomials.
7. Save persists the final result through the existing formula save flow.

The initial implementation can compute experience from existing saved formula composition and merge outcomes if enough data already exists. If explicit merge history is not currently persisted, add a small merge-history record only if needed; otherwise start with deterministic rules and design the experience interface for later persistence.

## Error Handling

The preview should show warnings instead of applying when:

- The result cannot satisfy minimum coefficient.
- There are fewer than five economically meaningful groups.
- Required composition data is missing.
- A learned pattern conflicts with normative rules.
- Coefficients cannot be normalized to `1.000` at three decimals.

Hard errors should block `Aplicar propuesta`. Warnings may allow applying if the result is still valid and the user accepts.

## Testing

Add focused tests for:

- Final output has 5-8 monomials when possible.
- No coefficient below `0.050`.
- Labor and general expenses remain independent.
- Low-incidence monomials merge by affinity before largest-incidence fallback.
- Coefficients round to three decimals and sum to `1.000`.
- Learned experience boosts compatible merges.
- Learned experience never overrides normative constraints.
- Preview action does not mutate current monomials until user applies.
- Applying proposal replaces monomials and preserves composition traceability.

Use the existing structures and architecture spreadsheets as reference fixtures for expected grouping style, but not as hard templates.

## Out of Scope

- Replacing the first-stage smart generation.
- Using AI or non-deterministic model calls for normative grouping.
- Automatically saving the adjusted formula without user confirmation.
- Forcing fixed symbols from structures or architecture examples for every budget.
