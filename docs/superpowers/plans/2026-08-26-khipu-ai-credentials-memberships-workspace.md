# Khipu IA Credentials, Memberships and Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement explicit platform, Workspace, and BYOK AI credential modes with membership-aware limits, billing attribution, administration, and auditability.

**Architecture:** Add a central credential/policy resolver between AI routes and providers. Store credentials by scope, derive policy from the active Workspace and membership, and record every execution with credential source, billing scope, cost, and request identity.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, Zod, existing AI gateway, existing Workspace entitlements, Vitest, Tailwind/shadcn patterns.

**Spec:** `docs/superpowers/specs/2026-08-26-khipu-ai-credentials-memberships-workspace-design.md`

## Global Constraints

- Use TypeScript strict mode and never use `any`.
- Financial amounts use decimal-safe representation; token counts remain integer values.
- Keep credential resolution and usage calculations outside UI components.
- Preserve the existing provider gateway and Workspace architecture.
- Encrypt secrets with a dedicated production `ENCRYPTION_KEY` or use a Secret Manager reference.
- Never return complete API keys to browser code, logs, analytics, or error responses.
- Streaming and non-streaming routes must share the same credential and policy resolution behavior.

---

### Task 1: Add domain types and Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/ai/credentials/types.ts`
- Create: `lib/ai/credentials/policy-types.ts`
- Create: `prisma/migrations/20260826120000_add_scoped_ai_credentials_and_policies/migration.sql`
- Test: `lib/ai/credentials/types.test.ts`

**Interfaces:**
- Produce `AiCredentialScope`, `AiCredentialStatus`, `AiPolicyMode`, `ResolvedAiCredential`, and policy input/output types.

- [ ] Add `AiCredential`, `AiPolicy`, and the usage/ledger fields defined in the spec.
- [ ] Add owner and provider indexes plus uniqueness constraints for active credentials.
- [ ] Add enums instead of unvalidated strings where Prisma supports them.
- [ ] Add Zod schemas for API-facing inputs and reject invalid scope/owner combinations.
- [ ] Test valid and invalid policy/credential payloads.
- [ ] Run `npx prisma validate` and the focused type tests.

### Task 2: Migrate existing user and system credentials

**Files:**
- Create: `lib/ai/credentials/migration.ts`
- Modify: `lib/data/settings.ts`
- Modify: `lib/data/system-settings.ts`
- Create: `lib/ai/credentials/migration.test.ts`

**Interfaces:**
- Produce `migrateLegacyAiCredentials()` and read/write adapters for `AiCredential`.

- [ ] Implement an idempotent migration from `UserSettings` and `SystemSettings`.
- [ ] Preserve existing encryption format and only decrypt inside server-side migration code.
- [ ] Make new writes target `AiCredential` while retaining legacy reads temporarily.
- [ ] Return masked status only from settings APIs.
- [ ] Test repeat execution, empty keys, invalid encrypted values, and duplicate providers.
- [ ] Document the deployment order: schema migration, backfill, resolver rollout, legacy write removal.

### Task 3: Implement Workspace AI policies

**Files:**
- Create: `lib/ai/credentials/policy-service.ts`
- Modify: `lib/workspace/entitlements.ts`
- Modify: `lib/workspace/context.ts`
- Create: `app/api/workspaces/[id]/ai-policy/route.ts`
- Create: `app/api/workspaces/[id]/ai-policy/route.test.ts`
- Test: `lib/ai/credentials/policy-service.test.ts`

**Interfaces:**
- Produce `getEffectiveAiPolicy({ userId, workspaceId })`, `updateWorkspaceAiPolicy(...)`, and `assertAiPolicyAllows(...)`.

- [ ] Derive plan restrictions from the effective Workspace license.
- [ ] Implement `PLATFORM`, `WORKSPACE`, `BYOK_ALLOWED`, and `BYOK_ONLY` modes.
- [ ] Authorize reads/writes by Workspace membership and role.
- [ ] Restrict policy updates to Owner/Admin or the existing billing administrator role.
- [ ] Invalidate Workspace policy/license caches after updates.
- [ ] Test missing membership, suspended membership, plan restrictions, and each mode.

### Task 4: Implement the central credential resolver

**Files:**
- Create: `lib/ai/credentials/resolver.ts`
- Modify: `lib/ai/gateway/execute.ts`
- Modify: `app/api/ai/chat/stream/route.ts`
- Create: `lib/ai/credentials/resolver.test.ts`

**Interfaces:**
- Produce `resolveAiCredential({ userId, workspaceId, provider, task })` returning `ResolvedAiCredential`.

- [ ] Resolve the active Workspace from the authenticated session and validate membership.
- [ ] Apply policy before reading any secret.
- [ ] Implement `USER → WORKSPACE → PLATFORM → ENVIRONMENT` only when policy permits it.
- [ ] Implement Workspace-only mode with controlled platform fallback.
- [ ] Replace duplicated key selection in execute and streaming chat with the resolver.
- [ ] Preserve model preferences while separating provider selection from credential selection.
- [ ] Test all provider sources, fallback-disabled behavior, missing keys, invalid policies, and active Workspace changes.

### Task 5: Make usage accounting scope-aware

**Files:**
- Modify: `lib/ai/usage.ts`
- Modify: `lib/data/account.ts`
- Modify: `lib/data/admin-dashboard.ts`
- Create: `lib/ai/usage-scope.test.ts`
- Modify: `app/api/workspaces/[id]/usage/route.ts`

**Interfaces:**
- Produce `assertAiBudgetAvailable(...)`, `reserveAiUsage(...)`, `recordScopedAiUsage(...)`, and `releaseAiUsage(...)` with Workspace and billing scope fields.

- [ ] Keep atomic reservation and consumption behavior under concurrent requests.
- [ ] Apply user and Workspace limits according to the resolved billing scope.
- [ ] Do not decrement platform allowance for BYOK unless explicitly configured.
- [ ] Record provider, model, credential source, request ID, token counts, and estimated/actual cost.
- [ ] Keep monetary values in minor units or Prisma Decimal; do not use floating-point accumulation for billing.
- [ ] Test platform, Workspace, BYOK, over-limit, release, adjustment, and concurrency cases.

### Task 6: Add provider validation, rotation, and audit events

**Files:**
- Create: `lib/ai/credentials/validation-service.ts`
- Create: `lib/ai/credentials/audit.ts`
- Modify: `lib/workspace/audit.ts`
- Create: `app/api/workspaces/[id]/ai-credentials/route.ts`
- Create: `app/api/workspaces/[id]/ai-credentials/test/route.ts`
- Create: `app/api/workspaces/[id]/ai-credentials/route.test.ts`

- [ ] Add server-side provider connection tests with timeout and safe error normalization.
- [ ] Add create, rotate, revoke, and status operations without returning secrets.
- [ ] Record actor, Workspace, provider, operation, result, and timestamp in audit events.
- [ ] Add rate limiting and prevent secrets from entering structured logs.
- [ ] Test authorization, masking, invalid credentials, rotation, revocation, and audit output.

### Task 7: Build admin and Workspace management UI

**Files:**
- Modify: `components/admin/admin-cloud-ai-settings.tsx`
- Create: `components/settings/workspace-ai-policy-card.tsx`
- Create: `components/settings/workspace-ai-credentials-card.tsx`
- Modify: `components/settings/settings-page-content.tsx`
- Modify: `app/admin/settings/page.tsx` or the repository's existing admin settings entry point, preserving the route already used by `admin-cloud-ai-settings.tsx`
- Test: `components/settings/workspace-ai-policy-card.test.tsx`
- Test: `components/settings/workspace-ai-credentials-card.test.tsx`

- [ ] Replace ambiguous provider wording with explicit source, payer, and scope copy.
- [ ] Show active source, provider, model, allowance, and Workspace policy.
- [ ] Provide separate controls for platform, Workspace, and user credentials.
- [ ] Show masked keys only and require explicit confirmation before rotation/revocation.
- [ ] Hide Workspace controls for users without the required role.
- [ ] Test keyboard access, loading/error states, policy restrictions, and no-secret rendering.

### Task 8: Align feature authorization and route behavior

**Files:**
- Modify: `lib/ai/route-handler.ts`
- Modify: `lib/workspace/feature-registry.ts`
- Modify: `app/api/ai/*/route.ts` as identified by the route matrix
- Create: `lib/ai/route-access-matrix.ts`
- Create: `lib/ai/route-access-matrix.test.ts`

- [ ] Define separate entitlements for Khipu Chat, APU, review, autocomplete, PDF AI, and Khipu Agent.
- [ ] Stop using a broad `ai.local` check for cloud-only capabilities where inappropriate.
- [ ] Ensure suspended users and inactive Workspace members are rejected consistently.
- [ ] Ensure agent write actions use the same policy and budget checks as chat.
- [ ] Test every route for anonymous, suspended, inactive-member, plan-denied, BYOK, and Workspace-key scenarios.

### Task 9: Add observability and reporting

**Files:**
- Create: `lib/ai/credentials/metrics.ts`
- Modify: `lib/data/admin-dashboard.ts`
- Modify: `components/dashboard/khipu-quality-metrics.tsx`
- Create: `app/api/admin/ai-usage/route.ts`
- Create: `app/api/admin/ai-usage/route.test.ts`

- [ ] Report usage by Workspace, user, provider, model, source, task, success, fallback, and cost.
- [ ] Add alerts at 80%, 90%, and 100% of configured budgets.
- [ ] Exclude prompts, API keys, emails, RUCs, and budget contents from analytics payloads.
- [ ] Add provider failure and fallback metrics.
- [ ] Test aggregation boundaries, empty data, and authorization.

### Task 10: Roll out safely and verify production readiness

**Files:**
- Create: `docs/ai-credentials-runbook.md`
- Modify: `docs/beta-launch-runbook.md`
- Modify: `docs/ai-local-qa.md`
- Create: `lib/ai/credentials/rollout-checklist.test.ts`

- [ ] Add feature flag for resolver rollout and a temporary legacy fallback switch.
- [ ] Run schema migration and idempotent credential backfill in staging.
- [ ] Verify `ENCRYPTION_KEY` is configured and key rotation procedure is documented.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test`.
- [ ] Run `node ./node_modules/next/dist/bin/next build`.
- [ ] Execute manual checks for platform, Workspace, BYOK, fallback, streaming, agent, limits, and revocation.
- [ ] Remove legacy writes only after all production reads use the scoped resolver.

## Definition of Done

- The specification's acceptance criteria pass in automated tests and manual QA.
- Admin, Workspace admin, and user interfaces clearly communicate source and payer.
- Every AI execution is attributable to a Workspace/user and credential source.
- Limits are enforced atomically and BYOK does not silently consume platform allowance.
- Production secrets are encrypted or managed by a Secret Manager, rotated, masked, audited, and absent from logs.
