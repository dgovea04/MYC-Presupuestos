# Khipu Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Khipu's visible identity with a sober technical tagline, clearer supporting microcopy, and a compact brand chip in the `/ai` workspace.

**Architecture:** Keep this as a presentation-only pass inside the existing `AIWorkspace` client component. Do not change API routes, provider behavior, bridge events, token accounting, RAG, persistence, or budget calculations. Tests should lock the new copy and preserve existing provider/action/runtime behavior.

**Tech Stack:** Next.js App Router, React client component, TypeScript strict, Tailwind CSS, lucide-react, Vitest jsdom.

---

## File Structure

- Modify: `components/ai/AIWorkspace.bridge.test.tsx`
  - Owns jsdom coverage for visible Khipu workspace identity, provider controls, bridge behavior, and local recent activity.
- Modify: `components/ai/AIWorkspace.tsx`
  - Owns the visible `/ai` workspace header, brand chip, tagline, supporting microcopy, provider summary, command actions, request form, result rendering, and browser-local recent activity.

Do not modify:

- `lib/ai/*`
- `app/api/ai/*`
- `prisma/*`
- budget calculation modules
- S10 import/export modules
- unrelated dashboard, onboarding, or budget editor changes already present in the working tree

---

### Task 1: Lock Khipu Identity Copy With A Failing Test

**Files:**
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Update the workspace shell test expectations**

In `components/ai/AIWorkspace.bridge.test.tsx`, inside `it("renders Khipu as an operational workspace with command actions and runtime status", ...)`, replace the current header copy assertions:

```tsx
    expect(getByText("Khipu")).toBeTruthy();
    expect(getByText("Asistente tecnico")).toBeTruthy();
    expect(getTextContaining("Asistente tecnico para presupuestos, APU, revision y autocompletado")).toBeTruthy();
```

with:

```tsx
    expect(getByText("Khipu")).toBeTruthy();
    expect(getByText("Asistente tecnico de obra")).toBeTruthy();
    expect(getTextContaining("Criterio tecnico para presupuestos de obra.")).toBeTruthy();
    expect(getTextContaining("Revisa APU, genera partidas y responde con contexto del presupuesto activo.")).toBeTruthy();
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: FAIL because the current workspace still renders `Asistente tecnico` and the older descriptive sentence.

- [ ] **Step 3: Commit the failing test**

```bash
git add components/ai/AIWorkspace.bridge.test.tsx
git commit -m "test: describe khipu identity copy"
```

---

### Task 2: Implement The Khipu Brand Chip And Header Copy

**Files:**
- Modify: `components/ai/AIWorkspace.tsx`
- Test: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Replace the generic badge/header copy**

In `components/ai/AIWorkspace.tsx`, replace this block:

```tsx
              <div className="max-w-3xl space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                  Asistente tecnico
                </span>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Khipu</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                    Asistente tecnico para presupuestos, APU, revision y autocompletado en MYC Presupuestos.
                  </p>
                </div>
              </div>
```

with:

```tsx
              <div className="max-w-3xl space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                  <BotMessageSquare className="h-3.5 w-3.5" />
                  Khipu
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Asistente tecnico de obra</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                    Criterio tecnico para presupuestos de obra.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                    Revisa APU, genera partidas y responde con contexto del presupuesto activo.
                  </p>
                </div>
              </div>
```

This uses the existing `BotMessageSquare` import and does not introduce a new logo asset.

- [ ] **Step 2: Run the focused test and verify it passes**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: PASS. The test should now find the brand chip label, descriptor, tagline, supporting copy, provider controls, command actions, and bridge behavior.

- [ ] **Step 3: Commit the implementation**

```bash
git add components/ai/AIWorkspace.tsx
git commit -m "feat: polish khipu identity header"
```

---

### Task 3: Final Verification

**Files:**
- Verify: `components/ai/AIWorkspace.tsx`
- Verify: `components/ai/AIWorkspace.bridge.test.tsx`
- Verify: `app/ai/page.test.tsx`

- [ ] **Step 1: Run the identity test suite**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx app/ai/page.test.tsx
```

Expected: PASS. `AIWorkspace.bridge.test.tsx` should pass all Khipu identity and bridge tests, and `app/ai/page.test.tsx` should still pass entitlement and URL hydration tests.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 3: Confirm the old assistant name remains absent**

Run:

```bash
rg -n "(?i)copilo(to|t)" app components lib docs prd README.md
```

Expected: no output. `rg` exits with code 1 when there are no matches; that is expected for this command.

- [ ] **Step 4: Confirm only expected files changed**

Run:

```bash
git status --short
```

Expected: Khipu identity work should only include committed changes to:

- `components/ai/AIWorkspace.bridge.test.tsx`
- `components/ai/AIWorkspace.tsx`

The working tree may still show pre-existing unrelated changes in:

- `app/dashboard/page.tsx`
- `components/budget/budget-editor.tsx`
- `lib/dashboard/onboarding.test.ts`
- `lib/dashboard/onboarding.ts`

Do not stage, commit, revert, or modify those unrelated files.

- [ ] **Step 5: Commit verification note if needed**

If no files changed during verification, do not create a commit. If the verification step required a small test or copy adjustment, commit only the Khipu files:

```bash
git add components/ai/AIWorkspace.bridge.test.tsx components/ai/AIWorkspace.tsx
git commit -m "fix: finalize khipu identity copy"
```

---

## Self-Review Checklist

- The plan implements the approved tagline: `Criterio tecnico para presupuestos de obra.`
- The plan implements the approved supporting copy: `Revisa APU, genera partidas y responde con contexto del presupuesto activo.`
- The brand chip uses an existing lucide icon and does not add a logo asset.
- The plan does not touch API routes, provider routing, RAG, persistence, streaming, metrics, Prisma, S10 import, or budget calculations.
- The plan includes TDD steps, exact commands, expected outcomes, and commit points.
