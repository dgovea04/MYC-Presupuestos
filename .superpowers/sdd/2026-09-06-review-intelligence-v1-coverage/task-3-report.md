# Task 3 report — Matching enriquecido y carga de APU

## Outcome

Implemented enriched review-evidence matching and read-only APU data handoff.

- `BudgetItemMatchInput` and `EvidenceMatchInput` now support optional `technicalSpecification`, Decimal `yield`, and `apuComponents`.
- Candidate signals now expose `specification`, `yield`, `apuComponents`, and `unitAlias`.
- Scores remain Decimal-based and normalize only over signals whose source data is available.
- Yield similarity uses Decimal arithmetic; APU components use normalized-text intersection over the budget item's components.
- Non-empty conflicting codes still force zero score, LOW confidence, and ineligible findings. Empty codes do not create a conflict.
- The review-runs POST query now reads APU performance plus resource quantity/type and resource/catalog labels. It passes a Decimal `yield` and read-only component descriptors (`type | quantity | label`) to `runReviewJob`.

## TDD evidence

### RED

Added matching and route expectations before production changes, then ran:

```text
npm.cmd test -- lib/review-intelligence/matching.test.ts app/api/budgets/[id]/review-runs/route.test.ts
```

Expected failures were observed:

```text
matching.test.ts: missing specification, yield, apuComponents, and unitAlias signals
matching.test.ts: expected equivalent-unit signal, received 0
route.test.ts: APU select did not include performance or resourceType
```

The command reported 3 failed tests and 20 passed tests.

### GREEN

Implemented the smallest matching and route changes needed for those tests, then reran the focused command successfully:

```text
Test Files  2 passed (2)
Tests       23 passed (23)
```

## Verification

```text
npm.cmd test -- lib/review-intelligence/matching.test.ts app/api/budgets/[id]/review-runs/route.test.ts
Test Files  2 passed (2)
Tests       23 passed (23)

npm.cmd test -- lib/review-intelligence
Test Files  25 passed (25)
Tests       181 passed (181)
```

`git diff --check` also passed.

## Scope and safeguards

- No Prisma migrations, rules, UI, endpoints, or budget/APU mutations were added.
- Existing authorization, tenant filtering, selected-sheet evidence filtering, idempotency, and provenance flow are unchanged.
- The component descriptors retain type and quantity for matching context while preserving the required `string[]` interface.
