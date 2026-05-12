# Default Currency Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted `defaultCurrency` user setting, expose it in the settings UI, and use it when creating new project budgets.

**Architecture:** Extend the existing `UserSettings` flow end-to-end instead of creating a parallel preferences path. Keep validation and defaults in the settings domain, keep UI thin, and inject the chosen currency into project creation so budget initialization no longer hardcodes `PEN`.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, PostgreSQL, Zod, Vitest

---

## File Structure

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_user_default_currency/migration.sql`
- Modify: `types/settings.ts`
- Modify: `lib/validations/settings.ts`
- Create: `lib/validations/settings.test.ts`
- Modify: `lib/data/settings.ts`
- Create: `lib/data/settings.test.ts`
- Modify: `app/api/settings/route.ts`
- Modify: `components/settings/user-settings-form.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `lib/data/projects.ts`
- Create: `lib/data/projects.test.ts`

### Task 1: Add database support for `defaultCurrency`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_user_default_currency/migration.sql`

- [ ] **Step 1: Write the schema change**

Add the new field to `UserSettings` with a safe default:

```prisma
model UserSettings {
  id               String   @id @default(cuid())
  userId           String   @unique
  currencyDecimals Int      @default(2)
  defaultCurrency  String   @default("PEN")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

- [ ] **Step 2: Add the migration**

Create a migration with:

```sql
ALTER TABLE "UserSettings"
ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'PEN';
```

- [ ] **Step 3: Validate the schema diff**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add default currency to user settings schema"
```

### Task 2: Extend settings types and validation

**Files:**
- Modify: `types/settings.ts`
- Modify: `lib/validations/settings.ts`
- Create: `lib/validations/settings.test.ts`

- [ ] **Step 1: Write the failing validation test**

Create `lib/validations/settings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { userSettingsSchema } from "@/lib/validations/settings";

describe("userSettingsSchema", () => {
  it("accepts PEN and USD as supported default currencies", () => {
    expect(userSettingsSchema.parse({ currencyDecimals: 2, defaultCurrency: "PEN" })).toEqual({
      currencyDecimals: 2,
      defaultCurrency: "PEN",
    });

    expect(userSettingsSchema.parse({ currencyDecimals: 2, defaultCurrency: "USD" })).toEqual({
      currencyDecimals: 2,
      defaultCurrency: "USD",
    });
  });

  it("rejects unsupported default currencies", () => {
    expect(() => userSettingsSchema.parse({ currencyDecimals: 2, defaultCurrency: "EUR" })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/validations/settings.test.ts`
Expected: FAIL because `defaultCurrency` is not part of the schema yet

- [ ] **Step 3: Implement the types and schema**

Update `types/settings.ts`:

```ts
export type UserSettingsRecord = {
  currencyDecimals: number;
  defaultCurrency: "PEN" | "USD";
};
```

Update `lib/validations/settings.ts`:

```ts
import { z } from "zod";

export const userSettingsSchema = z.object({
  currencyDecimals: z.coerce.number().int().min(0).max(4),
  defaultCurrency: z.enum(["PEN", "USD"]),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- lib/validations/settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add types/settings.ts lib/validations/settings.ts lib/validations/settings.test.ts
git commit -m "feat: validate default currency in user settings"
```

### Task 3: Persist and read the full settings record

**Files:**
- Modify: `lib/data/settings.ts`
- Create: `lib/data/settings.test.ts`

- [ ] **Step 1: Write the failing data-layer tests**

Create `lib/data/settings.test.ts` with module-level Prisma mocking:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = {
  queryRaw: vi.fn(),
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
  },
}));

import { defaultUserSettings, getUserSettings, updateUserSettings } from "@/lib/data/settings";

describe("settings data", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
  });

  it("returns fallback defaults when there is no settings row", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    await expect(getUserSettings("user-1")).resolves.toEqual(defaultUserSettings);
  });

  it("persists and returns both decimals and default currency", async () => {
    mocks.queryRaw.mockResolvedValue([{ currencyDecimals: 3, defaultCurrency: "USD" }]);

    await expect(updateUserSettings("user-1", { currencyDecimals: 3, defaultCurrency: "USD" })).resolves.toEqual({
      currencyDecimals: 3,
      defaultCurrency: "USD",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- lib/data/settings.test.ts`
Expected: FAIL because the queries and defaults only cover `currencyDecimals`

- [ ] **Step 3: Implement the settings data changes**

Update `lib/data/settings.ts` so both reads and writes include `defaultCurrency`:

```ts
export const defaultUserSettings: UserSettingsRecord = {
  currencyDecimals: 2,
  defaultCurrency: "PEN",
};

export async function getUserSettings(userId: string): Promise<UserSettingsRecord> {
  const [settings] = await prisma.$queryRaw<Array<{ currencyDecimals: number; defaultCurrency: "PEN" | "USD" }>>`
    SELECT "currencyDecimals", "defaultCurrency"
    FROM "UserSettings"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;

  return {
    ...defaultUserSettings,
    ...settings,
  };
}

export async function updateUserSettings(userId: string, input: UserSettingsInput): Promise<UserSettingsRecord> {
  const data = userSettingsSchema.parse(input);

  const [settings] = await prisma.$queryRaw<Array<{ currencyDecimals: number; defaultCurrency: "PEN" | "USD" }>>`
    INSERT INTO "UserSettings" ("id", "userId", "currencyDecimals", "defaultCurrency", "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${data.currencyDecimals}, ${data.defaultCurrency}, NOW(), NOW())
    ON CONFLICT ("userId")
    DO UPDATE SET
      "currencyDecimals" = EXCLUDED."currencyDecimals",
      "defaultCurrency" = EXCLUDED."defaultCurrency",
      "updatedAt" = NOW()
    RETURNING "currencyDecimals", "defaultCurrency"
  `;

  return settings;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- lib/data/settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/data/settings.ts lib/data/settings.test.ts
git commit -m "feat: persist default currency in settings data layer"
```

### Task 4: Update the settings API and UI

**Files:**
- Modify: `components/settings/user-settings-form.tsx`
- Modify: `app/settings/page.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `app/api/settings/route.ts`

- [ ] **Step 1: Write the failing form-facing behavior mentally as explicit acceptance criteria**

Use these checks while implementing:

```text
1. The settings page loads the current default currency and decimals.
2. The form preview updates when either field changes.
3. The PATCH payload includes both `currencyDecimals` and `defaultCurrency`.
4. The settings page no longer advertises "Moneda por defecto" as a missing future feature.
```

- [ ] **Step 2: Update the form props and local state**

Refactor `components/settings/user-settings-form.tsx` to accept the full record:

```ts
type UserSettingsFormProps = {
  initialSettings: {
    currencyDecimals: number;
    defaultCurrency: "PEN" | "USD";
  };
};
```

Store both values in state and send:

```ts
body: JSON.stringify({
  currencyDecimals: Number(currencyDecimals),
  defaultCurrency,
}),
```

- [ ] **Step 3: Update the preview and controls**

Add a currency selector and make the preview use both values:

```tsx
<Label htmlFor="defaultCurrency">Moneda por defecto</Label>
<Select id="defaultCurrency" value={defaultCurrency} onChange={(event) => setDefaultCurrency(event.target.value as "PEN" | "USD")}>
  <option value="PEN">Sol peruano (PEN)</option>
  <option value="USD">Dolar estadounidense (USD)</option>
</Select>
```

```ts
const preview = formatCurrency(7723.48, defaultCurrency, Number(currencyDecimals));
```

- [ ] **Step 4: Wire the page and shell to the full settings object**

Update `app/settings/page.tsx`:

```tsx
<UserSettingsForm initialSettings={settings} />
```

Update `components/layout/app-shell.tsx` fallback:

```ts
const settings = session?.user?.id
  ? await getUserSettings(session.user.id)
  : { currencyDecimals: 2, defaultCurrency: "PEN" };
```

Remove or replace the static recommendation card entry:

```ts
{
  title: "Moneda por defecto",
  detail: "Configurada desde el bloque de formato y visualizacion para nuevos presupuestos.",
}
```

or delete it entirely from the recommendations array.

- [ ] **Step 5: Smoke test the UI path**

Run: `npm run lint`
Expected: PASS without TypeScript or lint errors in `settings` files

- [ ] **Step 6: Commit**

```bash
git add components/settings/user-settings-form.tsx app/settings/page.tsx components/layout/app-shell.tsx app/api/settings/route.ts
git commit -m "feat: add default currency control to settings UI"
```

### Task 5: Use the setting during project creation

**Files:**
- Modify: `lib/data/projects.ts`
- Create: `lib/data/projects.test.ts`

- [ ] **Step 1: Write the failing project creation test**

Create `lib/data/projects.test.ts` with focused mocking around settings and Prisma transaction behavior:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = {
  companyFindFirst: vi.fn(),
  transaction: vi.fn(),
  projectCreate: vi.fn(),
  budgetCreate: vi.fn(),
  budgetCreateMany: vi.fn(),
  getUserSettings: vi.fn(),
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: { findFirst: mocks.companyFindFirst },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

import { createProject } from "@/lib/data/projects";

describe("createProject", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => "mockReset" in mock && mock.mockReset());
  });

  it("uses the user's default currency for generated budgets", async () => {
    mocks.companyFindFirst.mockResolvedValue({ id: "company-1" });
    mocks.getUserSettings.mockResolvedValue({ currencyDecimals: 2, defaultCurrency: "USD" });
    mocks.projectCreate.mockResolvedValue({ id: "project-1" });
    mocks.budgetCreate.mockResolvedValue({ id: "general-1" });
    mocks.budgetCreateMany.mockResolvedValue({ count: 4 });

    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        project: { create: mocks.projectCreate },
        budget: { create: mocks.budgetCreate, createMany: mocks.budgetCreateMany },
      }),
    );

    await createProject("user-1", {
      companyId: "company-1",
      name: "Obra demo",
      clientName: "",
      location: "",
      projectType: "",
      startDate: "",
      endDate: "",
      status: "PLANNING",
    });

    expect(mocks.budgetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: "USD" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- lib/data/projects.test.ts`
Expected: FAIL because project creation still uses hardcoded `PEN`

- [ ] **Step 3: Implement currency injection in `lib/data/projects.ts`**

Import settings and split numeric defaults from currency:

```ts
import { getUserSettings } from "@/lib/data/settings";
```

```ts
const defaultBudgetRates = {
  igvRate: 0.18,
  generalExpensesRate: 0.1,
  utilityRate: 0.08,
  totalDirectCost: 0,
  totalGeneralExpenses: 0,
  totalUtility: 0,
  totalTax: 0,
  totalAmount: 0,
} as const;
```

Inside `createProject`:

```ts
const settings = await getUserSettings(userId);
const defaultCurrency = settings.defaultCurrency;
```

Use it in budget creation:

```ts
data: {
  projectId: project.id,
  kind: "GENERAL",
  name: "Presupuesto General",
  currency: defaultCurrency,
  ...defaultBudgetRates,
},
```

and:

```ts
data: defaultProjectBudgetNames.map((name) => ({
  projectId: project.id,
  parentBudgetId: generalBudget.id,
  kind: "SUB_BUDGET",
  name,
  currency: defaultCurrency,
  ...defaultBudgetRates,
})),
```

- [ ] **Step 4: Keep fallback behavior explicit**

Use the central settings fallback rather than hand-rolling another default:

```ts
const { defaultCurrency } = await getUserSettings(userId);
```

No extra fallback constant should be introduced in `projects.ts`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- lib/data/projects.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/data/projects.ts lib/data/projects.test.ts
git commit -m "feat: apply default currency to new project budgets"
```

### Task 6: Full verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- lib/validations/settings.test.ts lib/data/settings.test.ts lib/data/projects.test.ts`
Expected: PASS

- [ ] **Step 2: Run the broader project checks**

Run: `npm run lint`
Expected: PASS

Run: `npm run test`
Expected: PASS, or if unrelated existing tests fail, record the exact failing files before proceeding

- [ ] **Step 3: Run a manual settings flow**

Run: `npm run dev`
Expected:

```text
1. Open /settings
2. Change Moneda por defecto from PEN to USD
3. Save successfully
4. Create a new project
5. Confirm the generated general budget and child budgets start in USD
```

- [ ] **Step 4: Commit final verification or follow-up fixes**

```bash
git add -A
git commit -m "test: verify default currency settings flow"
```

## Self-Review

- Spec coverage check: covered persistence, validation, UI, creation flow, fallback behavior, and future-ready settings read path.
- Placeholder scan: no `TODO`, `TBD`, or undefined "write tests later" instructions remain.
- Type consistency: `defaultCurrency` is consistently named across Prisma, settings types, validation, UI, and project creation.
