# Default Budget Rates Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persisted default budget-rate settings, edit them in `Configuracion` as human percentages, and use them as the shared suggestion source for project creation and manual budget forms.

**Architecture:** Extend the current `UserSettings` flow end-to-end with three new decimal rate fields, but keep the settings UI in percentage form through a small conversion utility. Centralize budget default resolution so project creation, recovery flows, and manual budget entry all read the same settings-driven defaults instead of duplicating `0.18 / 0.10 / 0.08`.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Prisma, PostgreSQL, Zod, Vitest

---

## File Structure

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_user_default_budget_rates/migration.sql`
- Modify: `types/settings.ts`
- Modify: `lib/validations/settings.ts`
- Modify: `lib/validations/settings.test.ts`
- Modify: `lib/data/settings.ts`
- Modify: `lib/data/settings.test.ts`
- Create: `lib/settings/budget-rate-percentages.ts`
- Create: `lib/settings/budget-rate-percentages.test.ts`
- Modify: `components/settings/user-settings-form.tsx`
- Modify: `components/settings/user-settings-form.test.tsx`
- Modify: `app/api/settings/route.ts`
- Modify: `app/settings/page.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `lib/data/projects.ts`
- Modify: `lib/data/projects.test.ts`
- Modify: `components/budget/budget-form.tsx`
- Create: `components/budget/budget-form.test.tsx`

### Task 1: Add persisted settings fields for default budget rates

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_user_default_budget_rates/migration.sql`

- [ ] **Step 1: Write the schema change**

Extend `model UserSettings`:

```prisma
model UserSettings {
  id                         String   @id @default(cuid())
  userId                     String   @unique
  currencyDecimals           Int      @default(2)
  defaultCurrency            String   @default("PEN")
  defaultIgvRate             Decimal  @default(0.18) @db.Decimal(10, 4)
  defaultGeneralExpensesRate Decimal  @default(0.10) @db.Decimal(10, 4)
  defaultUtilityRate         Decimal  @default(0.08) @db.Decimal(10, 4)
  createdAt                  DateTime @default(now())
  updatedAt                  DateTime @updatedAt
  user                       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

- [ ] **Step 2: Add the migration**

Create `migration.sql` with:

```sql
ALTER TABLE "UserSettings"
ADD COLUMN "defaultIgvRate" DECIMAL(10,4) NOT NULL DEFAULT 0.18,
ADD COLUMN "defaultGeneralExpensesRate" DECIMAL(10,4) NOT NULL DEFAULT 0.10,
ADD COLUMN "defaultUtilityRate" DECIMAL(10,4) NOT NULL DEFAULT 0.08;
```

- [ ] **Step 3: Validate the schema**

Run: `npx.cmd prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add default budget rates to user settings schema"
```

### Task 2: Extend settings types and decimal-domain validation

**Files:**
- Modify: `types/settings.ts`
- Modify: `lib/validations/settings.ts`
- Modify: `lib/validations/settings.test.ts`

- [ ] **Step 1: Write the failing validation tests**

Extend `lib/validations/settings.test.ts`:

```ts
it("accepts valid decimal default budget rates", () => {
  expect(
    userSettingsSchema.parse({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
    }),
  ).toEqual({
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
  });
});

it("rejects decimal budget rates outside the 0..1 range", () => {
  expect(() =>
    userSettingsSchema.parse({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      defaultIgvRate: 1.01,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
    }),
  ).toThrow();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test -- lib/validations/settings.test.ts`
Expected: FAIL because the new fields are not in the schema yet

- [ ] **Step 3: Implement the types and validation**

Update `types/settings.ts`:

```ts
export type UserSettingsRecord = {
  defaultCurrency: "PEN" | "USD";
  currencyDecimals: number;
  defaultIgvRate: number;
  defaultGeneralExpensesRate: number;
  defaultUtilityRate: number;
};
```

Update `lib/validations/settings.ts`:

```ts
export const userSettingsSchema = z.object({
  defaultCurrency: z.enum(["PEN", "USD"]),
  currencyDecimals: z.coerce.number().int().min(0).max(4),
  defaultIgvRate: z.coerce.number().min(0).max(1),
  defaultGeneralExpensesRate: z.coerce.number().min(0).max(1),
  defaultUtilityRate: z.coerce.number().min(0).max(1),
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm.cmd run test -- lib/validations/settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add types/settings.ts lib/validations/settings.ts lib/validations/settings.test.ts
git commit -m "feat: validate default budget rates in settings"
```

### Task 3: Add the percentage/decimal conversion utility

**Files:**
- Create: `lib/settings/budget-rate-percentages.ts`
- Create: `lib/settings/budget-rate-percentages.test.ts`

- [ ] **Step 1: Write the failing conversion tests**

Create `lib/settings/budget-rate-percentages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decimalRateToPercentageInput, percentageInputToDecimalRate } from "@/lib/settings/budget-rate-percentages";

describe("budget rate percentage conversions", () => {
  it("converts stored decimal rates to display percentages", () => {
    expect(decimalRateToPercentageInput(0.18)).toBe("18");
    expect(decimalRateToPercentageInput(0.185)).toBe("18.5");
    expect(decimalRateToPercentageInput(0.1025)).toBe("10.25");
  });

  it("converts percentage inputs to stored decimal rates", () => {
    expect(percentageInputToDecimalRate("18")).toBe(0.18);
    expect(percentageInputToDecimalRate("18.5")).toBe(0.185);
    expect(percentageInputToDecimalRate("10.25")).toBe(0.1025);
  });

  it("rejects percentages outside the 0..100 range", () => {
    expect(() => percentageInputToDecimalRate("101")).toThrow("Percentage must be between 0 and 100");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test -- lib/settings/budget-rate-percentages.test.ts`
Expected: FAIL because the helper does not exist yet

- [ ] **Step 3: Implement the helper**

Create `lib/settings/budget-rate-percentages.ts`:

```ts
function trimTrailingZeros(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function decimalRateToPercentageInput(rate: number) {
  return trimTrailingZeros(rate * 100);
}

export function percentageInputToDecimalRate(input: string) {
  const percentage = Number(input);

  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error("Percentage must be between 0 and 100");
  }

  return Number((percentage / 100).toFixed(4));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm.cmd run test -- lib/settings/budget-rate-percentages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/settings/budget-rate-percentages.ts lib/settings/budget-rate-percentages.test.ts
git commit -m "feat: add budget rate percentage conversion helpers"
```

### Task 4: Persist and normalize the new settings fields

**Files:**
- Modify: `lib/data/settings.ts`
- Modify: `lib/data/settings.test.ts`

- [ ] **Step 1: Write the failing data-layer tests**

Extend `lib/data/settings.test.ts`:

```ts
it("returns all default budget rate settings when no row exists", async () => {
  mocks.queryRaw.mockResolvedValue([]);

  await expect(getUserSettings("user-1")).resolves.toEqual({
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
  });
});

it("persists and returns all default budget rate settings", async () => {
  mocks.queryRaw.mockResolvedValue([
    {
      defaultCurrency: "USD",
      currencyDecimals: 2,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.11,
      defaultUtilityRate: 0.09,
    },
  ]);

  await expect(
    updateUserSettings("user-1", {
      defaultCurrency: "USD",
      currencyDecimals: 2,
      defaultIgvRate: 0.19,
      defaultGeneralExpensesRate: 0.11,
      defaultUtilityRate: 0.09,
    }),
  ).resolves.toEqual({
    defaultCurrency: "USD",
    currencyDecimals: 2,
    defaultIgvRate: 0.19,
    defaultGeneralExpensesRate: 0.11,
    defaultUtilityRate: 0.09,
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test -- lib/data/settings.test.ts`
Expected: FAIL because the new fields are not read/written yet

- [ ] **Step 3: Implement the data-layer changes**

Update `defaultUserSettings`:

```ts
export const defaultUserSettings: UserSettingsRecord = {
  defaultCurrency: "PEN",
  currencyDecimals: 2,
  defaultIgvRate: 0.18,
  defaultGeneralExpensesRate: 0.1,
  defaultUtilityRate: 0.08,
};
```

Update row parsing and queries to include:

```ts
SELECT
  "defaultCurrency",
  "currencyDecimals",
  "defaultIgvRate",
  "defaultGeneralExpensesRate",
  "defaultUtilityRate"
```

and:

```ts
INSERT INTO "UserSettings" (
  "id",
  "userId",
  "defaultCurrency",
  "currencyDecimals",
  "defaultIgvRate",
  "defaultGeneralExpensesRate",
  "defaultUtilityRate",
  "createdAt",
  "updatedAt"
)
```

with matching `DO UPDATE SET` and `RETURNING` fields.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm.cmd run test -- lib/data/settings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/data/settings.ts lib/data/settings.test.ts
git commit -m "feat: persist default budget rates in settings data layer"
```

### Task 5: Update the settings API and settings form UI

**Files:**
- Modify: `components/settings/user-settings-form.tsx`
- Modify: `components/settings/user-settings-form.test.tsx`
- Modify: `app/api/settings/route.ts`
- Modify: `app/settings/page.tsx`
- Modify: `components/layout/app-shell.tsx`

- [ ] **Step 1: Write the failing form tests**

Extend `components/settings/user-settings-form.test.tsx` with one case that changes percentage fields and verifies decimal payload:

```ts
it("submits default budget rates as decimal values when the user edits percentage inputs", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({}),
  });

  vi.stubGlobal("fetch", fetchMock);

  render(
    <UserSettingsForm
      initialSettings={{
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
      }}
    />,
  );

  fireEvent.change(screen.getByLabelText("IGV (%)"), { target: { value: "19" } });
  fireEvent.change(screen.getByLabelText("Gastos generales (%)"), { target: { value: "11.5" } });
  fireEvent.change(screen.getByLabelText("Utilidad (%)"), { target: { value: "9" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar configuracion" }).closest("form")!);

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        body: JSON.stringify({
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          defaultIgvRate: 0.19,
          defaultGeneralExpensesRate: 0.115,
          defaultUtilityRate: 0.09,
        }),
      }),
    ),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test -- components/settings/user-settings-form.test.tsx`
Expected: FAIL because the form does not render or convert these fields yet

- [ ] **Step 3: Implement the form and route changes**

Add percentage-form state in `components/settings/user-settings-form.tsx`:

```ts
const [defaultIgvRate, setDefaultIgvRate] = useState(decimalRateToPercentageInput(initialSettings.defaultIgvRate));
const [defaultGeneralExpensesRate, setDefaultGeneralExpensesRate] = useState(
  decimalRateToPercentageInput(initialSettings.defaultGeneralExpensesRate),
);
const [defaultUtilityRate, setDefaultUtilityRate] = useState(decimalRateToPercentageInput(initialSettings.defaultUtilityRate));
```

Send converted payload:

```ts
body: JSON.stringify({
  defaultCurrency,
  currencyDecimals: Number(currencyDecimals),
  defaultIgvRate: percentageInputToDecimalRate(defaultIgvRate),
  defaultGeneralExpensesRate: percentageInputToDecimalRate(defaultGeneralExpensesRate),
  defaultUtilityRate: percentageInputToDecimalRate(defaultUtilityRate),
}),
```

Add UI inputs:

```tsx
<Label htmlFor="defaultIgvRate">IGV (%)</Label>
<Input id="defaultIgvRate" type="number" step="0.01" value={defaultIgvRate} onChange={(event) => setDefaultIgvRate(event.target.value)} />
```

and equivalent inputs for `defaultGeneralExpensesRate` and `defaultUtilityRate`.

In `app/api/settings/route.ts`, extend the strict payload schema:

```ts
const settingsPayloadSchema = z
  .object({
    defaultCurrency: z.enum(["PEN", "USD"]),
    currencyDecimals: z.number().int().min(0).max(4),
    defaultIgvRate: z.number().min(0).max(1),
    defaultGeneralExpensesRate: z.number().min(0).max(1),
    defaultUtilityRate: z.number().min(0).max(1),
  })
  .strict();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm.cmd run test -- components/settings/user-settings-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint on the settings slice**

Run: `npm.cmd run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/settings/user-settings-form.tsx components/settings/user-settings-form.test.tsx app/api/settings/route.ts app/settings/page.tsx components/layout/app-shell.tsx
git commit -m "feat: add default budget rate controls to settings"
```

### Task 6: Apply settings-driven rates to project creation and recovery

**Files:**
- Modify: `lib/data/projects.ts`
- Modify: `lib/data/projects.test.ts`

- [ ] **Step 1: Write the failing project tests**

Extend `lib/data/projects.test.ts`:

```ts
it("uses the user's default budget rates for generated project budgets", async () => {
  mocks.getUserSettings.mockResolvedValue({
    ...defaultUserSettings,
    defaultIgvRate: 0.19,
    defaultGeneralExpensesRate: 0.115,
    defaultUtilityRate: 0.09,
  });

  // existing company/project/budget mocks here

  await createProject("user-1", validInput);

  expect(mocks.budgetCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        igvRate: 0.19,
        generalExpensesRate: 0.115,
        utilityRate: 0.09,
      }),
    }),
  );
});
```

and recovery path:

```ts
it("uses the user's default budget rates when rebuilding missing project budgets", async () => {
  mocks.getUserSettings.mockResolvedValue({
    ...defaultUserSettings,
    defaultIgvRate: 0.19,
    defaultGeneralExpensesRate: 0.115,
    defaultUtilityRate: 0.09,
  });

  // mock getProjectById path with no existing budgets

  expect(mocks.budgetCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        igvRate: 0.19,
        generalExpensesRate: 0.115,
        utilityRate: 0.09,
      }),
    }),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test -- lib/data/projects.test.ts`
Expected: FAIL because `defaultBudgetRates` still hardcodes rates

- [ ] **Step 3: Implement settings-driven project defaults**

Replace the hardcoded rate constant in `lib/data/projects.ts` with a helper:

```ts
function getDefaultBudgetRates(settings: Pick<UserSettingsRecord, "defaultIgvRate" | "defaultGeneralExpensesRate" | "defaultUtilityRate">) {
  return {
    igvRate: settings.defaultIgvRate,
    generalExpensesRate: settings.defaultGeneralExpensesRate,
    utilityRate: settings.defaultUtilityRate,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
  };
}
```

Use it in both:

- `createProject()`
- `ensureProjectBudgetStructure()`

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm.cmd run test -- lib/data/projects.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/data/projects.ts lib/data/projects.test.ts
git commit -m "feat: apply default budget rate settings to project budgets"
```

### Task 7: Apply settings-driven defaults to the manual budget form

**Files:**
- Modify: `components/budget/budget-form.tsx`
- Create: `components/budget/budget-form.test.tsx`

- [ ] **Step 1: Write the failing form test**

Create `components/budget/budget-form.test.tsx`:

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetForm } from "@/components/budget/budget-form";

describe("BudgetForm", () => {
  it("renders settings-driven suggested rates and currency", () => {
    render(
      <BudgetForm
        projects={[{ id: "project-1", name: "Proyecto demo" }]}
        defaultSettings={{
          defaultCurrency: "USD",
          currencyDecimals: 2,
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
        }}
      />,
    );

    expect(screen.getByLabelText("Moneda")).toHaveValue("USD");
    expect(screen.getByLabelText("IGV")).toHaveValue(0.18);
    expect(screen.getByLabelText("Gastos generales")).toHaveValue(0.1);
    expect(screen.getByLabelText("Utilidad")).toHaveValue(0.08);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test -- components/budget/budget-form.test.tsx`
Expected: FAIL because the form does not accept settings-driven defaults yet

- [ ] **Step 3: Implement settings-driven form defaults**

Update `components/budget/budget-form.tsx` props:

```ts
import type { UserSettingsRecord } from "@/types/settings";

export function BudgetForm({
  projects,
  defaultProjectId,
  defaultSettings,
}: {
  projects: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
  defaultSettings: Pick<
    UserSettingsRecord,
    "defaultCurrency" | "defaultIgvRate" | "defaultGeneralExpensesRate" | "defaultUtilityRate"
  >;
}) {
```

Replace hardcoded defaults:

```tsx
<Select id="currency" name="currency" defaultValue={defaultSettings.defaultCurrency}>
```

```tsx
<Input id="igvRate" name="igvRate" type="number" step="0.01" defaultValue={String(defaultSettings.defaultIgvRate)} />
```

and equivalent replacements for the other two rate fields.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm.cmd run test -- components/budget/budget-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/budget/budget-form.tsx components/budget/budget-form.test.tsx
git commit -m "feat: use settings-driven defaults in budget form"
```

### Task 8: Wire settings into budget form entry points

**Files:**
- Modify: any server component/page that renders `BudgetForm` and currently omits settings

- [ ] **Step 1: Find the rendering sites**

Run:

```bash
rg -n "<BudgetForm|BudgetForm\\(" app components
```

Expected: identify each live entry point for the manual budget form.

- [ ] **Step 2: Add the failing expectation in the nearest existing test**

If the rendering page already has a test, extend it so `BudgetForm` receives settings-derived defaults.

Example expectation:

```ts
expect(mockedBudgetForm).toHaveBeenCalledWith(
  expect.objectContaining({
    defaultSettings: expect.objectContaining({
      defaultCurrency: "PEN",
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
    }),
  }),
  expect.anything(),
);
```

- [ ] **Step 3: Run that test to verify it fails**

Run the narrow test file you extended.
Expected: FAIL because the parent does not pass `defaultSettings` yet

- [ ] **Step 4: Implement the prop wiring**

At each server entry point:

```ts
const settings = await getUserSettings(session.user.id);
```

and:

```tsx
<BudgetForm
  projects={projects}
  defaultProjectId={defaultProjectId}
  defaultSettings={settings}
/>
```

- [ ] **Step 5: Run the test to verify it passes**

Run the same narrow test file.
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app components
git commit -m "feat: pass settings defaults into budget form entry points"
```

### Task 9: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm.cmd run test -- lib/validations/settings.test.ts lib/settings/budget-rate-percentages.test.ts lib/data/settings.test.ts components/settings/user-settings-form.test.tsx lib/data/projects.test.ts components/budget/budget-form.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run full project checks**

Run:

```bash
npm.cmd run lint
```

Expected: PASS

Run:

```bash
npm.cmd run test
```

Expected: PASS, or if unrelated failures appear, record the exact files before proceeding

- [ ] **Step 3: Manual flow verification**

Run:

```bash
npm.cmd run dev
```

Expected:

```text
1. Open /settings
2. Set IGV=19, Gastos generales=11.5, Utilidad=9 in human percentage form
3. Save successfully
4. Open the manual budget creation form and confirm it suggests 0.19 / 0.115 / 0.09
5. Create a new project and confirm generated budgets store those same decimal rates
```

- [ ] **Step 4: Commit final verification or follow-up fixes**

```bash
git add -A
git commit -m "test: verify default budget rates settings flow"
```

## Self-Review

- Spec coverage check: covered persistence, decimal-domain validation, human-percentage UI conversion, settings API, project creation, recovery paths, manual forms, and verification.
- Placeholder scan: no `TODO`, `TBD`, or undefined implementation references remain.
- Type consistency: the plan uses `defaultIgvRate`, `defaultGeneralExpensesRate`, and `defaultUtilityRate` consistently across schema, settings types, conversion helpers, UI, and project/budget flows.
