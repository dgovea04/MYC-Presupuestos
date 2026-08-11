# Admin Manual Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to manually mark a user's email as verified from the existing admin access form.

**Architecture:** Reuse the current admin user management path. Add a small data service that updates `User.emailVerifiedAt`, expose it through a protected admin endpoint, include verification state in dashboard user rows, and render a conditional button in `AdminUserAccessForm`.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, Vitest, React Testing Library, Tailwind/shadcn-style components.

## Global Constraints

- Use TypeScript strict mode.
- Never use `any`.
- Keep edits scoped to existing admin/auth patterns.
- Admin-only action must use `requireAdminSession`.
- UI should remain clean, compact, and consistent with the existing admin form.

---

### Task 1: Data And API

**Files:**
- Modify: `lib/data/admin-users.ts`
- Modify: `lib/data/admin-users.test.ts`
- Create: `app/api/admin/users/[id]/verify-email/route.ts`
- Create: `app/api/admin/users/[id]/verify-email/route.test.ts`

**Interfaces:**
- Produces: `verifyUserEmailManually(userId: string): Promise<void>`
- Produces: `PATCH(request: Request, { params }: { params: Promise<{ id: string }> })`

- [ ] Write failing service test asserting `emailVerifiedAt` is set to a `Date`.
- [ ] Write failing route test asserting non-admin requests return `403`.
- [ ] Write failing route test asserting admin requests call `verifyUserEmailManually`, revalidate `/admin`, and return `{ ok: true }`.
- [ ] Implement `verifyUserEmailManually`.
- [ ] Implement the route.
- [ ] Run `npm run test -- lib/data/admin-users.test.ts app/api/admin/users/[id]/verify-email/route.test.ts`.

### Task 2: Dashboard Data And Form UI

**Files:**
- Modify: `lib/data/admin-dashboard.ts`
- Modify: `components/admin/admin-user-access-form.tsx`
- Create: `components/admin/admin-user-access-form.test.tsx`

**Interfaces:**
- Consumes: `AdminUserRow.emailVerifiedAt: string | null`
- Consumes: `PATCH /api/admin/users/:id/verify-email`

- [ ] Add failing component test showing the manual validation button for a selected user with `emailVerifiedAt: null`.
- [ ] Add failing component test ensuring verified users show the verified state and no validation button.
- [ ] Include `emailVerifiedAt` in admin dashboard user selects and rows.
- [ ] Add `emailVerifiedAt` to the form row type.
- [ ] Render compact email verification state and a conditional `Validar correo` button.
- [ ] Run `npm run test -- components/admin/admin-user-access-form.test.tsx`.

### Task 3: Focused Verification

**Files:**
- Verify all files changed in Tasks 1 and 2.

- [ ] Run `npm run test -- lib/data/admin-users.test.ts app/api/admin/users/[id]/route.test.ts app/api/admin/users/[id]/verify-email/route.test.ts components/admin/admin-user-access-form.test.tsx`.
- [ ] Run `git diff -- lib/data/admin-users.ts lib/data/admin-dashboard.ts components/admin/admin-user-access-form.tsx app/api/admin/users/[id]/verify-email/route.ts`.
