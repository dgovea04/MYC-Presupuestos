# Task 7 Report: Google OAuth Demo Coverage

## Status

Completed.

## Files Changed

- `lib/auth/options.ts`
  - New Google users now use `registerUserWithCompanyAndDemo`.
  - Existing Google users now resolve their company with `ensureUserHasCompany` and ensure a demo project with `ensureDemoProjectForCompany`.
  - Preserved the existing `emailVerifiedAt: new Date()` value for verified Google registrations.
- `lib/auth/options.test.ts`
  - Added direct callback coverage for new Google users creating a company and demo project.
  - Added direct callback coverage for existing Google users receiving demo-project provisioning.
- `lib/auth/google-oauth-integration.test.ts`
  - Updated registration and demo-project mocks to match the new auth callback dependencies while retaining existing email-verification coverage.

## Commands Run

| Command | Result |
| --- | --- |
| `npm run test -- lib/auth/options.test.ts` | Expected red state: 12 passed, 2 failed. New-user registration returned `false`; existing-user demo provisioning was not called. |
| `npm run test -- lib/auth/options.test.ts lib/auth/registration.test.ts` | Passed: 2 files, 21 tests. |
| `npm run test -- lib/auth/google-oauth-integration.test.ts` | Passed: 1 file, 6 tests. |
| `git diff --check` | Passed with no whitespace errors. |
| `git add lib/auth/options.ts lib/auth/options.test.ts lib/auth/google-oauth-integration.test.ts` | Completed. |
| `git commit -m "feat: create demo project for google signups"` | Completed. |

## Commit

`d57869507c44cb195695d85c7887fa70fc4fe621` - `feat: create demo project for google signups`

## Self-Review

- The implementation follows the task brief's required calls and argument values.
- OAuth failures during either company repair or demo provisioning continue to deny sign-in through the existing error boundary.
- The new-user test keeps the exact `emailVerifiedAt: expect.any(Date)` expectation, preserving the pre-existing verified-email behavior.
- No dependencies were added and no financial calculation logic was touched.

## Review Fix: Existing-User Integration Coverage

### Status

Completed on 2026-08-13.

### Fix

- `lib/auth/google-oauth-integration.test.ts`
  - Configured `ensureUserHasCompanyMock` to return `company-maria` in both existing Google-user flows.
  - Added assertions that `ensureDemoProjectForCompany` receives `{ userId: "user-maria", companyId: "company-maria", enabled: true }` in both flows.
  - Preserved the existing verified-email expectations.

### Verification

| Command | Result |
| --- | --- |
| `npm run test -- lib/auth/google-oauth-integration.test.ts lib/auth/options.test.ts` | Passed: 2 files, 20 tests. |

### Concerns

None identified for this test-quality fix.
