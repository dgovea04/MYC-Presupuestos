# Task 3 report: APU to canonical resource resolution

## Status

Implemented and committed as `fix: map backfilled apu resources canonically`.

The repository checkout is directly at `C:\MYC-Presupuestos`; the requested `C:\MYC-Presupuestos\main` directory does not exist. No worktree or subagent was used.

## Changes

- Added `resolveBackfillCanonicalResource` with the required matched/skipped result shape.
- Resolution normalizes description and unit, considers canonical names and aliases, filters global/company scope, and rejects zero or multiple compatible candidates without selecting a tie.
- A matched APU row stores the canonical resource ID, never the operational `Resource.id`.
- Unresolved APU rows are persisted without a canonical relation and are reported with `NO_MATCH` or `AMBIGUOUS` conflicts.
- Added isolated APU resource reporting so one APU persistence error cannot attribute its matched rows to another APU.
- Preserved `OBSERVED` status and Task 2 provenance/idempotency behavior.

## TDD evidence

The added reporting test was run RED first: the missing summary function produced one expected assertion failure while the existing nine tests passed. After implementation, the focused suite passed 14/14 tests.

## Verification

- `npm.cmd test -- lib/knowledge/backfill.test.ts lib/knowledge/review-canonical-resolution.test.ts`: passed, 2 files / 14 tests.
- `git diff --check`: passed.
- Full `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run lint` were started but interrupted by the user before final summaries; their success is not claimed.

## Scope notes

Only the four Task 3 source/test files and this report are included in the commit. The pre-existing untracked `presupuesto-ejemplo/pdf escaneado/` directory was not touched or staged.

## Concerns

The final full-suite, typecheck, and lint exit codes remain unverified because the requested immediate close interrupted those processes. Existing unrelated test output also showed expected test-time Prisma foreign-key logging from analytics fixtures.
