# Advanced Loading Skeleton System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized, layout-aware loading skeleton system that removes duplicated loaders and makes loading states match the actual MC Presupuestos layouts.

**Architecture:** Add shared loading primitives in `components/ui/loading`, compose domain-level page skeletons in `components/loading`, and migrate route-level and section-level fallbacks incrementally. Keep `AppShell` behavior intact while introducing a visual-only `AppShellSkeleton` for loading states.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript strict mode, Tailwind CSS, Vitest, React Testing Library, existing `Card`, `Table`, `Button`, `AppShell`, and theme CSS variables.

## Global Constraints

- Use TypeScript strict mode.
- Never use `any`.
- Financial calculations must use decimal-safe math.
- Keep calculation logic isolated from UI.
- All formulas must be testable.
- Prefer reusable services.
- Use clean architecture.
- Reuse existing components, utilities, styles, and UI patterns.
- Do not change financial formulas, API contracts, Prisma schema, authentication behavior, or persistence.
- Do not add dependencies for skeletons.
- Skeletons for table-heavy budget/APU/subpartida surfaces must reflect columns, density, row height, borders, decimals, and parent context.
- Decorative skeleton blocks must use `aria-hidden="true"`.
- User-facing loading regions must expose `aria-busy="true"` with a useful accessible label.

---

## Product Specification

### Current State

The project currently has a basic skeleton primitive in `components/ui/app-skeleton.tsx` and many route-level `loading.tsx` files. Several route loading components render `<AppShell>`, while the real pages also render `<AppShell>`. Some pages also use nested `Suspense` fallbacks, local `animate-pulse` markup, central spinners, and text-only loading cards.

Representative files:

- `components/ui/app-skeleton.tsx`
- `components/layout/app-shell.tsx`
- `components/layout/app-shell-loading-frame.tsx`
- `app/dashboard/loading.tsx`
- `app/budgets/[id]/loading.tsx`
- `components/budget/budget-editor-skeleton.tsx`
- `components/dashboard/dashboard-analytics-section-skeleton.tsx`
- `components/dashboard/khipu-quality-metrics-skeleton.tsx`
- `components/budget/work-schedule/derived-views.tsx`

### Target User Experience

Loading should feel stable, technical, and specific:

- The shell should not visually disappear during navigation.
- A budget page should load as a budget editor: toolbar, table rows, numeric columns, and summary panel.
- A catalog should load as filters plus table rows.
- A settings page should load as form sections.
- A chart area should load as a chart frame, not a spinner.
- A local action can still show a button spinner.
- Refetching existing data should preserve visible content and use inline pending affordances.

### Non-Goals

- Do not redesign the product shell.
- Do not move routes into a new route group in this phase.
- Do not replace Suspense usage globally.
- Do not change server data loading semantics.
- Do not change budget, APU, metrado, risk, or polynomial calculations.

---

## File Structure

Create:

- `components/ui/loading/skeleton-block.tsx`: Base skeleton block with shared styling.
- `components/ui/loading/skeleton-text.tsx`: Text-line skeleton helper.
- `components/ui/loading/skeleton-button.tsx`: Button-sized skeleton helper.
- `components/ui/loading/skeleton-icon.tsx`: Icon/avatar skeleton helper.
- `components/ui/loading/skeleton-card.tsx`: Card-compatible skeleton container.
- `components/ui/loading/skeleton-toolbar.tsx`: Search/filter/action toolbar skeleton.
- `components/ui/loading/skeleton-table.tsx`: Configurable table skeleton.
- `components/ui/loading/skeleton-form.tsx`: Configurable form skeleton.
- `components/ui/loading/skeleton-chart.tsx`: Chart skeleton.
- `components/ui/loading/index.ts`: Loading primitive barrel.
- `components/ui/loading/loading-primitives.test.tsx`: Primitive render and accessibility tests.
- `components/ui/loading/skeleton-table.test.tsx`: Table skeleton tests.
- `components/loading/app-shell-skeleton.tsx`: Visual-only app shell skeleton.
- `components/loading/page-skeleton-frame.tsx`: Common page skeleton wrapper.
- `components/loading/dashboard-page-skeleton.tsx`: Dashboard page skeleton.
- `components/loading/catalog-page-skeleton.tsx`: Catalog list/table skeleton.
- `components/loading/budget-editor-page-skeleton.tsx`: Budget editor skeleton composition.
- `components/loading/settings-page-skeleton.tsx`: Settings/account form skeleton.
- `components/loading/work-schedule-section-skeletons.tsx`: Work schedule derived view skeletons.
- `components/loading/loading-page-skeletons.test.tsx`: Page skeleton tests.
- `docs/loading-skeleton-system.md`: Product and engineering contract.

Modify:

- `components/ui/app-skeleton.tsx`: Delegate to new `SkeletonBlock` while keeping existing import compatibility.
- `components/layout/app-shell-loading-frame.tsx`: Use the new page frame semantics or deprecate in documentation if unused.
- `app/dashboard/loading.tsx`
- `app/projects/loading.tsx`
- `app/projects/[id]/loading.tsx`
- `app/budgets/loading.tsx`
- `app/budgets/[id]/loading.tsx`
- `app/resources/loading.tsx`
- `app/partidas/loading.tsx`
- `app/templates/loading.tsx`
- `app/settings/loading.tsx`
- `app/account/loading.tsx`
- `app/metrados-avanzados/loading.tsx`
- `components/dashboard/dashboard-analytics-section-skeleton.tsx`
- `components/dashboard/khipu-quality-metrics-skeleton.tsx`
- `components/budget/work-schedule/derived-views.tsx`
- `components/budget/work-schedule-page-content.tsx`
- `app/globals.test.ts` if it already checks global visual contracts.

Do not modify:

- `prisma/schema.prisma`
- `lib/calculations/**`
- `lib/work-schedule/**` calculation files
- API route contracts
- Export logic

---

## Acceptance Criteria

- Shared loading primitives exist under `components/ui/loading`.
- `AppSkeletonBlock` remains backwards-compatible.
- Main route skeletons use shared page skeleton components.
- Budget, catalog, settings, dashboard, metrados, and work schedule skeletons resemble their final layouts.
- Dashboard and Khipu metric section fallbacks no longer hand-roll separate pulse styles.
- Work schedule derived loading uses table/chart skeletons instead of text-only cards.
- Decorative skeleton blocks are hidden from assistive tech.
- User-facing loading regions expose `aria-busy`.
- No new dependencies are added.
- Targeted tests pass.
- `npm run lint` passes.

---

### Task 1: Shared Loading Primitives

**Files:**
- Create: `components/ui/loading/skeleton-block.tsx`
- Create: `components/ui/loading/skeleton-text.tsx`
- Create: `components/ui/loading/skeleton-button.tsx`
- Create: `components/ui/loading/skeleton-icon.tsx`
- Create: `components/ui/loading/skeleton-card.tsx`
- Create: `components/ui/loading/index.ts`
- Create: `components/ui/loading/loading-primitives.test.tsx`
- Modify: `components/ui/app-skeleton.tsx`

**Interfaces:**
- Produces:
  - `type SkeletonTone = "surface" | "muted" | "strong"`
  - `type SkeletonRadius = "sm" | "md" | "lg" | "xl" | "2xl" | "full"`
  - `SkeletonBlock(props: { className?: string; tone?: SkeletonTone; radius?: SkeletonRadius }): JSX.Element`
  - `SkeletonText(props: { lines?: number; className?: string; widths?: string[] }): JSX.Element`
  - `SkeletonButton(props: { className?: string; size?: "sm" | "md" | "lg" }): JSX.Element`
  - `SkeletonIcon(props: { className?: string; size?: "sm" | "md" | "lg"; rounded?: boolean }): JSX.Element`
  - `SkeletonCard(props: { children: React.ReactNode; className?: string; busyLabel?: string }): JSX.Element`
- Keeps:
  - `AppSkeletonBlock({ className }: { className?: string }): JSX.Element`

- [ ] **Step 1: Write primitive tests**

Create `components/ui/loading/loading-primitives.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { AppSkeletonBlock } from "@/components/ui/app-skeleton";
import { SkeletonBlock, SkeletonButton, SkeletonCard, SkeletonIcon, SkeletonText } from "@/components/ui/loading";

describe("loading primitives", () => {
  it("renders decorative skeleton blocks as aria-hidden", () => {
    const { container } = render(<SkeletonBlock className="h-4 w-24" />);

    const block = container.firstElementChild;
    expect(block).toHaveAttribute("aria-hidden", "true");
    expect(block).toHaveClass("animate-pulse");
    expect(block).toHaveClass("h-4");
    expect(block).toHaveClass("w-24");
  });

  it("keeps AppSkeletonBlock backwards compatible", () => {
    const { container } = render(<AppSkeletonBlock className="h-6 w-40" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveClass("h-6");
    expect(container.firstElementChild).toHaveClass("w-40");
  });

  it("renders skeleton text lines with configured widths", () => {
    const { container } = render(<SkeletonText lines={2} widths={["w-32", "w-20"]} />);

    const lines = container.querySelectorAll("[aria-hidden='true']");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveClass("w-32");
    expect(lines[1]).toHaveClass("w-20");
  });

  it("renders a busy skeleton card with an accessible label", () => {
    render(
      <SkeletonCard busyLabel="Cargando configuracion">
        <SkeletonIcon />
        <SkeletonButton />
      </SkeletonCard>,
    );

    const region = screen.getByRole("status", { name: "Cargando configuracion" });
    expect(region).toHaveAttribute("aria-busy", "true");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- components/ui/loading/loading-primitives.test.tsx`

Expected: FAIL because `components/ui/loading` does not exist.

- [ ] **Step 3: Implement `SkeletonBlock`**

Create `components/ui/loading/skeleton-block.tsx`:

```tsx
import { cn } from "@/lib/utils";

export type SkeletonTone = "surface" | "muted" | "strong";
export type SkeletonRadius = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

const toneClassName: Record<SkeletonTone, string> = {
  surface: "border border-[var(--app-border-soft)] bg-[var(--app-surface-hover)]/90",
  muted: "border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)]",
  strong: "border border-[var(--app-border)] bg-slate-200/80",
};

const radiusClassName: Record<SkeletonRadius, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

export function SkeletonBlock({
  className,
  radius = "lg",
  tone = "surface",
}: {
  className?: string;
  radius?: SkeletonRadius;
  tone?: SkeletonTone;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse", toneClassName[tone], radiusClassName[radius], className)}
    />
  );
}
```

- [ ] **Step 4: Implement text, button, icon, and card primitives**

Create `components/ui/loading/skeleton-text.tsx`:

```tsx
import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { cn } from "@/lib/utils";

export function SkeletonText({
  className,
  lines = 1,
  widths = ["w-full"],
}: {
  className?: string;
  lines?: number;
  widths?: string[];
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock
          key={index}
          className={cn("h-4", widths[index] ?? widths[widths.length - 1] ?? "w-full")}
          radius="md"
        />
      ))}
    </div>
  );
}
```

Create `components/ui/loading/skeleton-button.tsx`:

```tsx
import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { cn } from "@/lib/utils";

const sizeClassName = {
  sm: "h-8 w-24",
  md: "h-10 w-32",
  lg: "h-11 w-40",
};

export function SkeletonButton({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return <SkeletonBlock className={cn(sizeClassName[size], className)} radius="xl" />;
}
```

Create `components/ui/loading/skeleton-icon.tsx`:

```tsx
import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { cn } from "@/lib/utils";

const sizeClassName = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export function SkeletonIcon({
  className,
  rounded = true,
  size = "md",
}: {
  className?: string;
  rounded?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  return <SkeletonBlock className={cn(sizeClassName[size], className)} radius={rounded ? "full" : "xl"} />;
}
```

Create `components/ui/loading/skeleton-card.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SkeletonCard({
  busyLabel,
  children,
  className,
}: {
  busyLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      role={busyLabel ? "status" : undefined}
      aria-busy={busyLabel ? "true" : undefined}
      aria-label={busyLabel}
      className={cn("border-[var(--app-border-soft)] bg-[var(--app-surface)]", className)}
    >
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Add barrel exports and compatibility wrapper**

Create `components/ui/loading/index.ts`:

```ts
export { SkeletonBlock, type SkeletonRadius, type SkeletonTone } from "./skeleton-block";
export { SkeletonButton } from "./skeleton-button";
export { SkeletonCard } from "./skeleton-card";
export { SkeletonIcon } from "./skeleton-icon";
export { SkeletonText } from "./skeleton-text";
```

Modify `components/ui/app-skeleton.tsx`:

```tsx
import { SkeletonBlock } from "@/components/ui/loading";

export function AppSkeletonBlock({ className }: { className?: string }) {
  return <SkeletonBlock className={className} />;
}
```

- [ ] **Step 6: Run tests**

Run: `npm run test -- components/ui/loading/loading-primitives.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/ui/loading components/ui/app-skeleton.tsx
git commit -m "feat: add shared loading skeleton primitives"
```

---

### Task 2: Table, Toolbar, Form, and Chart Skeletons

**Files:**
- Create: `components/ui/loading/skeleton-table.tsx`
- Create: `components/ui/loading/skeleton-toolbar.tsx`
- Create: `components/ui/loading/skeleton-form.tsx`
- Create: `components/ui/loading/skeleton-chart.tsx`
- Create: `components/ui/loading/skeleton-table.test.tsx`
- Modify: `components/ui/loading/index.ts`

**Interfaces:**
- Consumes:
  - `SkeletonBlock`
  - `SkeletonButton`
  - `SkeletonText`
- Produces:
  - `type SkeletonTableColumn = { id: string; width: string; align?: "left" | "right"; sticky?: boolean }`
  - `SkeletonTable(props: { columns: SkeletonTableColumn[]; rowCount?: number; compact?: boolean; className?: string; "aria-label"?: string }): JSX.Element`
  - `SkeletonToolbar(props: { filters?: number; actions?: number; search?: boolean; className?: string }): JSX.Element`
  - `SkeletonForm(props: { sections?: number; fieldsPerSection?: number; className?: string; "aria-label"?: string }): JSX.Element`
  - `SkeletonChart(props: { className?: string; bars?: number; "aria-label"?: string }): JSX.Element`

- [ ] **Step 1: Write table and composed primitive tests**

Create `components/ui/loading/skeleton-table.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { SkeletonChart, SkeletonForm, SkeletonTable, SkeletonToolbar } from "@/components/ui/loading";

describe("semantic loading skeletons", () => {
  it("renders a busy table skeleton with headers and rows", () => {
    render(
      <SkeletonTable
        aria-label="Cargando presupuesto"
        columns={[
          { id: "code", width: "w-20" },
          { id: "description", width: "w-full" },
          { id: "partial", width: "w-24", align: "right" },
        ]}
        rowCount={4}
      />,
    );

    const table = screen.getByRole("table", { name: "Cargando presupuesto" });
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("row")).toHaveLength(5);
  });

  it("renders toolbar filters and actions", () => {
    const { container } = render(<SkeletonToolbar search filters={2} actions={2} />);

    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThanOrEqual(5);
  });

  it("renders a busy form skeleton", () => {
    render(<SkeletonForm aria-label="Cargando ajustes" sections={2} fieldsPerSection={2} />);

    expect(screen.getByRole("status", { name: "Cargando ajustes" })).toHaveAttribute("aria-busy", "true");
  });

  it("renders a chart skeleton without a spinner", () => {
    render(<SkeletonChart aria-label="Cargando curva S" bars={6} />);

    expect(screen.getByRole("img", { name: "Cargando curva S" })).toHaveAttribute("aria-busy", "true");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- components/ui/loading/skeleton-table.test.tsx`

Expected: FAIL because the composed skeletons do not exist.

- [ ] **Step 3: Implement table skeleton**

Create `components/ui/loading/skeleton-table.tsx`:

```tsx
import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { cn } from "@/lib/utils";

export type SkeletonTableColumn = {
  id: string;
  width: string;
  align?: "left" | "right";
  sticky?: boolean;
};

export function SkeletonTable({
  "aria-label": ariaLabel = "Cargando tabla",
  className,
  columns,
  compact = false,
  rowCount = 6,
}: {
  "aria-label"?: string;
  className?: string;
  columns: SkeletonTableColumn[];
  compact?: boolean;
  rowCount?: number;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface)]", className)}>
      <table aria-busy="true" aria-label={ariaLabel} className="w-full table-fixed" role="table">
        <thead>
          <tr className="border-b border-[var(--app-border-soft)] bg-[var(--app-surface-muted)]" role="row">
            {columns.map((column) => (
              <th key={column.id} className={cn("px-3", compact ? "py-2" : "py-3", column.align === "right" && "text-right")} role="columnheader">
                <SkeletonBlock className={cn("h-3", column.width, column.align === "right" && "ml-auto")} radius="md" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-[var(--app-border-soft)] last:border-0" role="row">
              {columns.map((column, columnIndex) => (
                <td key={column.id} className={cn("px-3", compact ? "py-2" : "py-3", column.sticky && "bg-[var(--app-surface)]")} role="cell">
                  <SkeletonBlock
                    className={cn(
                      "h-4",
                      column.width,
                      column.align === "right" && "ml-auto",
                      columnIndex === 1 && rowIndex % 3 === 0 && "max-w-[70%]",
                    )}
                    radius="md"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implement toolbar, form, and chart skeletons**

Create `components/ui/loading/skeleton-toolbar.tsx`:

```tsx
import { SkeletonButton, SkeletonBlock } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

export function SkeletonToolbar({
  actions = 1,
  className,
  filters = 2,
  search = true,
}: {
  actions?: number;
  className?: string;
  filters?: number;
  search?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)} aria-hidden="true">
      <div className="flex flex-1 flex-wrap gap-2">
        {search ? <SkeletonBlock className="h-10 min-w-56 flex-1" radius="xl" /> : null}
        {Array.from({ length: filters }).map((_, index) => (
          <SkeletonButton key={index} className="w-28" />
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, index) => (
          <SkeletonButton key={index} size={index === 0 ? "md" : "sm"} />
        ))}
      </div>
    </div>
  );
}
```

Create `components/ui/loading/skeleton-form.tsx`:

```tsx
import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

export function SkeletonForm({
  "aria-label": ariaLabel = "Cargando formulario",
  className,
  fieldsPerSection = 3,
  sections = 2,
}: {
  "aria-label"?: string;
  className?: string;
  fieldsPerSection?: number;
  sections?: number;
}) {
  return (
    <div aria-busy="true" aria-label={ariaLabel} className={cn("space-y-4", className)} role="status">
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <SkeletonCard key={sectionIndex}>
          <div className="space-y-5">
            <SkeletonText lines={2} widths={["w-44", "w-72"]} />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: fieldsPerSection }).map((_, fieldIndex) => (
                <div key={fieldIndex} className="space-y-2">
                  <SkeletonBlock className="h-3 w-24" radius="md" />
                  <SkeletonBlock className="h-10 w-full" radius="xl" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
```

Create `components/ui/loading/skeleton-chart.tsx`:

```tsx
import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

export function SkeletonChart({
  "aria-label": ariaLabel = "Cargando grafico",
  bars = 8,
  className,
}: {
  "aria-label"?: string;
  bars?: number;
  className?: string;
}) {
  return (
    <SkeletonCard className={className}>
      <div aria-busy="true" aria-label={ariaLabel} className="space-y-5" role="img">
        <SkeletonText lines={2} widths={["w-48", "w-64"]} />
        <div className="flex h-48 items-end gap-2 rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] p-4">
          {Array.from({ length: bars }).map((_, index) => (
            <SkeletonBlock
              key={index}
              className={cn("flex-1", index % 4 === 0 ? "h-16" : index % 3 === 0 ? "h-28" : index % 2 === 0 ? "h-36" : "h-24")}
              radius="sm"
            />
          ))}
        </div>
        <div className="flex justify-between">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-3 w-16" radius="md" />
          ))}
        </div>
      </div>
    </SkeletonCard>
  );
}
```

- [ ] **Step 5: Update barrel exports**

Modify `components/ui/loading/index.ts`:

```ts
export { SkeletonBlock, type SkeletonRadius, type SkeletonTone } from "./skeleton-block";
export { SkeletonButton } from "./skeleton-button";
export { SkeletonCard } from "./skeleton-card";
export { SkeletonChart } from "./skeleton-chart";
export { SkeletonForm } from "./skeleton-form";
export { SkeletonIcon } from "./skeleton-icon";
export { SkeletonTable, type SkeletonTableColumn } from "./skeleton-table";
export { SkeletonText } from "./skeleton-text";
export { SkeletonToolbar } from "./skeleton-toolbar";
```

- [ ] **Step 6: Run tests**

Run: `npm run test -- components/ui/loading/loading-primitives.test.tsx components/ui/loading/skeleton-table.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/ui/loading
git commit -m "feat: add semantic loading skeleton primitives"
```

---

### Task 3: App Shell and Page Skeleton Frames

**Files:**
- Create: `components/loading/app-shell-skeleton.tsx`
- Create: `components/loading/page-skeleton-frame.tsx`
- Create: `components/loading/loading-page-skeletons.test.tsx`
- Modify: `components/layout/app-shell-loading-frame.tsx`

**Interfaces:**
- Consumes:
  - `SkeletonBlock`
  - `SkeletonButton`
  - `SkeletonIcon`
  - `SkeletonText`
- Produces:
  - `AppShellSkeleton(props: { children?: React.ReactNode }): JSX.Element`
  - `PageSkeletonFrame(props: { titleWidth?: string; descriptionWidth?: string; actions?: number; children: React.ReactNode; "aria-label"?: string }): JSX.Element`

- [ ] **Step 1: Write frame tests**

Create `components/loading/loading-page-skeletons.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { AppShellSkeleton } from "@/components/loading/app-shell-skeleton";
import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";

describe("loading page skeletons", () => {
  it("renders a stable app shell skeleton with busy content", () => {
    render(
      <AppShellSkeleton>
        <div>Contenido</div>
      </AppShellSkeleton>,
    );

    expect(screen.getByRole("status", { name: "Cargando aplicacion" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });

  it("renders a page skeleton frame with configured action placeholders", () => {
    const { container } = render(
      <PageSkeletonFrame aria-label="Cargando catalogo" actions={2}>
        <div>Tabla</div>
      </PageSkeletonFrame>,
    );

    expect(screen.getByRole("status", { name: "Cargando catalogo" })).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- components/loading/loading-page-skeletons.test.tsx`

Expected: FAIL because frame components do not exist.

- [ ] **Step 3: Implement `AppShellSkeleton`**

Create `components/loading/app-shell-skeleton.tsx`:

```tsx
import type { ReactNode } from "react";
import { SkeletonBlock, SkeletonButton, SkeletonIcon, SkeletonText } from "@/components/ui/loading";

export function AppShellSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div aria-busy="true" aria-label="Cargando aplicacion" className="grid min-h-screen grid-cols-1 gap-5 px-3 py-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:px-4 xl:px-5" role="status">
      <aside className="hidden rounded-3xl border border-white/70 bg-slate-900 p-4 shadow-xl shadow-slate-900/10 lg:flex lg:h-[calc(100vh-2rem)] lg:flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <SkeletonIcon className="bg-white/20" size="sm" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-32 bg-white/20" radius="md" />
            <SkeletonBlock className="h-3 w-20 bg-white/10" radius="md" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-10 w-full bg-white/10" radius="xl" />
          ))}
        </div>
        <div className="mt-auto">
          <SkeletonBlock className="h-16 w-full bg-white/10" radius="2xl" />
        </div>
      </aside>
      <main className="flex min-h-full min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-3xl border border-[var(--app-border-soft)] bg-[var(--app-surface)]/90 px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <SkeletonText lines={3} widths={["w-24", "w-72", "w-56"]} />
          <div className="flex flex-wrap gap-3 md:justify-end">
            <SkeletonButton className="w-28" />
            <SkeletonButton className="w-32" />
            <SkeletonButton className="w-36" />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Implement `PageSkeletonFrame`**

Create `components/loading/page-skeleton-frame.tsx`:

```tsx
import type { ReactNode } from "react";
import { SkeletonButton, SkeletonText } from "@/components/ui/loading";

export function PageSkeletonFrame({
  "aria-label": ariaLabel = "Cargando pagina",
  actions = 1,
  children,
  descriptionWidth = "w-96",
  titleWidth = "w-56",
}: {
  "aria-label"?: string;
  actions?: number;
  children: ReactNode;
  descriptionWidth?: string;
  titleWidth?: string;
}) {
  return (
    <section aria-busy="true" aria-label={ariaLabel} className="space-y-5" role="status">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SkeletonText lines={2} widths={[titleWidth, descriptionWidth]} />
        {actions > 0 ? (
          <div className="flex flex-wrap gap-2 md:justify-end">
            {Array.from({ length: actions }).map((_, index) => (
              <SkeletonButton key={index} size={index === 0 ? "md" : "sm"} />
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 5: Keep `AppShellLoadingFrame` compatible**

Modify `components/layout/app-shell-loading-frame.tsx`:

```tsx
import type { ReactNode } from "react";

export function AppShellLoadingFrame({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
```

If this file is unchanged, leave it as-is and document that `AppShellSkeleton` is the preferred new component.

- [ ] **Step 6: Run tests**

Run: `npm run test -- components/loading/loading-page-skeletons.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/loading components/layout/app-shell-loading-frame.tsx
git commit -m "feat: add app shell loading skeleton"
```

---

### Task 4: Domain Page Skeleton Compositions

**Files:**
- Create: `components/loading/dashboard-page-skeleton.tsx`
- Create: `components/loading/catalog-page-skeleton.tsx`
- Create: `components/loading/budget-editor-page-skeleton.tsx`
- Create: `components/loading/settings-page-skeleton.tsx`
- Modify: `components/loading/loading-page-skeletons.test.tsx`

**Interfaces:**
- Consumes:
  - `PageSkeletonFrame`
  - `SkeletonCard`
  - `SkeletonChart`
  - `SkeletonForm`
  - `SkeletonTable`
  - `SkeletonToolbar`
- Produces:
  - `DashboardPageSkeleton(): JSX.Element`
  - `CatalogPageSkeleton(props: { kind: "projects" | "budgets" | "resources" | "partidas" | "templates" | "metrados" }): JSX.Element`
  - `BudgetEditorPageSkeleton(): JSX.Element`
  - `SettingsPageSkeleton(props: { kind?: "settings" | "account" }): JSX.Element`

- [ ] **Step 1: Add page composition tests**

Append to `components/loading/loading-page-skeletons.test.tsx`:

```tsx
import { BudgetEditorPageSkeleton } from "@/components/loading/budget-editor-page-skeleton";
import { CatalogPageSkeleton } from "@/components/loading/catalog-page-skeleton";
import { DashboardPageSkeleton } from "@/components/loading/dashboard-page-skeleton";
import { SettingsPageSkeleton } from "@/components/loading/settings-page-skeleton";

it("renders budget editor skeleton as a table plus summary panel", () => {
  render(<BudgetEditorPageSkeleton />);

  expect(screen.getByRole("table", { name: "Cargando editor de presupuesto" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Cargando resumen del presupuesto" })).toBeInTheDocument();
});

it("renders catalog skeleton as toolbar plus table", () => {
  render(<CatalogPageSkeleton kind="resources" />);

  expect(screen.getByRole("table", { name: "Cargando catalogo de insumos" })).toBeInTheDocument();
});

it("renders dashboard skeleton with chart regions", () => {
  render(<DashboardPageSkeleton />);

  expect(screen.getByRole("img", { name: "Cargando analitica principal" })).toBeInTheDocument();
});

it("renders settings skeleton as forms", () => {
  render(<SettingsPageSkeleton />);

  expect(screen.getByRole("status", { name: "Cargando configuracion" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test -- components/loading/loading-page-skeletons.test.tsx`

Expected: FAIL because page skeleton components do not exist.

- [ ] **Step 3: Implement dashboard skeleton**

Create `components/loading/dashboard-page-skeleton.tsx`:

```tsx
import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SkeletonCard, SkeletonChart, SkeletonIcon, SkeletonTable, SkeletonText } from "@/components/ui/loading";

export function DashboardPageSkeleton() {
  return (
    <PageSkeletonFrame aria-label="Cargando dashboard" actions={0} titleWidth="w-48" descriptionWidth="w-80">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={index}>
            <div className="flex items-start justify-between gap-4">
              <SkeletonText lines={3} widths={["w-24", "w-16", "w-32"]} />
              <SkeletonIcon rounded={false} />
            </div>
          </SkeletonCard>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SkeletonChart aria-label="Cargando analitica principal" />
        <SkeletonTable
          aria-label="Cargando actividad reciente"
          columns={[
            { id: "item", width: "w-full" },
            { id: "status", width: "w-20", align: "right" },
          ]}
          rowCount={4}
        />
      </section>
    </PageSkeletonFrame>
  );
}
```

- [ ] **Step 4: Implement catalog skeleton**

Create `components/loading/catalog-page-skeleton.tsx`:

```tsx
import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SkeletonTable, SkeletonToolbar, type SkeletonTableColumn } from "@/components/ui/loading";

const labels = {
  projects: "Cargando proyectos",
  budgets: "Cargando presupuestos",
  resources: "Cargando catalogo de insumos",
  partidas: "Cargando catalogo de partidas",
  templates: "Cargando plantillas",
  metrados: "Cargando metrados",
};

const columnsByKind: Record<keyof typeof labels, SkeletonTableColumn[]> = {
  projects: [
    { id: "name", width: "w-full" },
    { id: "status", width: "w-24" },
    { id: "date", width: "w-24", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
  budgets: [
    { id: "name", width: "w-full" },
    { id: "currency", width: "w-20" },
    { id: "amount", width: "w-28", align: "right" },
    { id: "actions", width: "w-20", align: "right" },
  ],
  resources: [
    { id: "code", width: "w-24", sticky: true },
    { id: "description", width: "w-full" },
    { id: "unit", width: "w-16" },
    { id: "price", width: "w-24", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
  partidas: [
    { id: "code", width: "w-24", sticky: true },
    { id: "description", width: "w-full" },
    { id: "unit", width: "w-16" },
    { id: "apu", width: "w-24", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
  templates: [
    { id: "name", width: "w-full" },
    { id: "type", width: "w-24" },
    { id: "items", width: "w-20", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
  metrados: [
    { id: "name", width: "w-full" },
    { id: "template", width: "w-28" },
    { id: "rows", width: "w-20", align: "right" },
    { id: "actions", width: "w-16", align: "right" },
  ],
};

export function CatalogPageSkeleton({ kind }: { kind: keyof typeof labels }) {
  return (
    <PageSkeletonFrame aria-label={labels[kind]} actions={1}>
      <SkeletonToolbar search filters={2} actions={1} />
      <SkeletonTable aria-label={labels[kind]} columns={columnsByKind[kind]} rowCount={8} />
    </PageSkeletonFrame>
  );
}
```

- [ ] **Step 5: Implement budget editor skeleton composition**

Create `components/loading/budget-editor-page-skeleton.tsx`:

```tsx
import { SkeletonBlock, SkeletonCard, SkeletonTable, SkeletonText, SkeletonToolbar } from "@/components/ui/loading";

export function BudgetEditorPageSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando presupuesto" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" role="status">
      <div className="space-y-4">
        <SkeletonCard>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <SkeletonText lines={3} widths={["w-24", "w-64", "w-72"]} />
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <SkeletonBlock className="h-8 w-24" radius="full" />
                <SkeletonBlock className="h-8 w-32" radius="full" />
                <SkeletonBlock className="h-8 w-20" radius="full" />
              </div>
            </div>
            <SkeletonToolbar search={false} filters={4} actions={2} />
          </div>
        </SkeletonCard>
        <SkeletonTable
          aria-label="Cargando editor de presupuesto"
          columns={[
            { id: "code", width: "w-20", sticky: true },
            { id: "description", width: "w-full" },
            { id: "unit", width: "w-16" },
            { id: "quantity", width: "w-20", align: "right" },
            { id: "unitPrice", width: "w-24", align: "right" },
            { id: "partial", width: "w-24", align: "right" },
            { id: "actions", width: "w-12", align: "right" },
          ]}
          rowCount={12}
        />
      </div>
      <SkeletonCard busyLabel="Cargando resumen del presupuesto">
        <div className="space-y-5">
          <SkeletonText lines={1} widths={["w-28"]} />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <SkeletonBlock className="h-3 w-24" radius="md" />
              <SkeletonBlock className="h-6 w-32" radius="md" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </section>
  );
}
```

- [ ] **Step 6: Implement settings skeleton**

Create `components/loading/settings-page-skeleton.tsx`:

```tsx
import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SkeletonForm } from "@/components/ui/loading";

export function SettingsPageSkeleton({ kind = "settings" }: { kind?: "settings" | "account" }) {
  return (
    <PageSkeletonFrame
      aria-label={kind === "account" ? "Cargando cuenta" : "Cargando configuracion"}
      actions={0}
      titleWidth={kind === "account" ? "w-40" : "w-48"}
      descriptionWidth="w-72"
    >
      <SkeletonForm aria-label={kind === "account" ? "Cargando cuenta" : "Cargando configuracion"} sections={kind === "account" ? 2 : 3} fieldsPerSection={3} />
    </PageSkeletonFrame>
  );
}
```

- [ ] **Step 7: Run tests**

Run: `npm run test -- components/loading/loading-page-skeletons.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/loading
git commit -m "feat: add domain loading page skeletons"
```

---

### Task 5: Migrate Main Route Loading Files

**Files:**
- Modify: `app/dashboard/loading.tsx`
- Modify: `app/projects/loading.tsx`
- Modify: `app/projects/[id]/loading.tsx`
- Modify: `app/budgets/loading.tsx`
- Modify: `app/budgets/[id]/loading.tsx`
- Modify: `app/resources/loading.tsx`
- Modify: `app/partidas/loading.tsx`
- Modify: `app/templates/loading.tsx`
- Modify: `app/settings/loading.tsx`
- Modify: `app/account/loading.tsx`
- Modify: `app/metrados-avanzados/loading.tsx`

**Interfaces:**
- Consumes:
  - `AppShell`
  - `DashboardPageSkeleton`
  - `CatalogPageSkeleton`
  - `BudgetEditorPageSkeleton`
  - `SettingsPageSkeleton`

- [ ] **Step 1: Replace dashboard loading with composition**

Modify `app/dashboard/loading.tsx`:

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageSkeleton } from "@/components/loading/dashboard-page-skeleton";

export default async function DashboardLoading() {
  return (
    <AppShell>
      <DashboardPageSkeleton />
    </AppShell>
  );
}
```

- [ ] **Step 2: Replace catalog route loading files**

Use this pattern:

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { CatalogPageSkeleton } from "@/components/loading/catalog-page-skeleton";

export default async function ResourcesLoading() {
  return (
    <AppShell>
      <CatalogPageSkeleton kind="resources" />
    </AppShell>
  );
}
```

Apply exact `kind` values:

- `app/projects/loading.tsx`: `kind="projects"`
- `app/budgets/loading.tsx`: `kind="budgets"`
- `app/resources/loading.tsx`: `kind="resources"`
- `app/partidas/loading.tsx`: `kind="partidas"`
- `app/templates/loading.tsx`: `kind="templates"`
- `app/metrados-avanzados/loading.tsx`: `kind="metrados"`

- [ ] **Step 3: Replace budget detail loading**

Modify `app/budgets/[id]/loading.tsx`:

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { BudgetEditorPageSkeleton } from "@/components/loading/budget-editor-page-skeleton";

export default async function BudgetDetailLoading() {
  return (
    <AppShell>
      <BudgetEditorPageSkeleton />
    </AppShell>
  );
}
```

- [ ] **Step 4: Replace settings and account loading**

Modify `app/settings/loading.tsx`:

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { SettingsPageSkeleton } from "@/components/loading/settings-page-skeleton";

export default async function SettingsLoading() {
  return (
    <AppShell>
      <SettingsPageSkeleton />
    </AppShell>
  );
}
```

Modify `app/account/loading.tsx`:

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { SettingsPageSkeleton } from "@/components/loading/settings-page-skeleton";

export default async function AccountLoading() {
  return (
    <AppShell>
      <SettingsPageSkeleton kind="account" />
    </AppShell>
  );
}
```

- [ ] **Step 5: Create project detail skeleton option before replacing**

If `app/projects/[id]/loading.tsx` currently has project-specific panels, keep a project-specific composition inside the file using shared primitives:

```tsx
import { AppShell } from "@/components/layout/app-shell";
import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SkeletonCard, SkeletonTable } from "@/components/ui/loading";

export default async function ProjectDetailLoading() {
  return (
    <AppShell>
      <PageSkeletonFrame aria-label="Cargando proyecto" actions={2} titleWidth="w-64" descriptionWidth="w-96">
        <section className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index}><div className="h-10" /></SkeletonCard>)}
        </section>
        <SkeletonTable
          aria-label="Cargando presupuestos del proyecto"
          columns={[
            { id: "name", width: "w-full" },
            { id: "amount", width: "w-28", align: "right" },
            { id: "status", width: "w-24" },
            { id: "actions", width: "w-16", align: "right" },
          ]}
          rowCount={5}
        />
      </PageSkeletonFrame>
    </AppShell>
  );
}
```

- [ ] **Step 6: Run targeted tests**

Run: `npm run test -- components/loading/loading-page-skeletons.test.tsx`

Expected: PASS.

- [ ] **Step 7: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/loading.tsx app/projects/loading.tsx app/projects/[id]/loading.tsx app/budgets/loading.tsx app/budgets/[id]/loading.tsx app/resources/loading.tsx app/partidas/loading.tsx app/templates/loading.tsx app/settings/loading.tsx app/account/loading.tsx app/metrados-avanzados/loading.tsx
git commit -m "feat: migrate route loading skeletons"
```

---

### Task 6: Dashboard and Khipu Section Fallbacks

**Files:**
- Modify: `components/dashboard/dashboard-analytics-section-skeleton.tsx`
- Modify: `components/dashboard/khipu-quality-metrics-skeleton.tsx`
- Modify: existing dashboard tests if they assert old class names.

**Interfaces:**
- Consumes:
  - `SkeletonChart`
  - `SkeletonCard`
  - `SkeletonBlock`
  - `SkeletonText`

- [ ] **Step 1: Replace analytics skeleton**

Modify `components/dashboard/dashboard-analytics-section-skeleton.tsx`:

```tsx
import { SkeletonChart } from "@/components/ui/loading";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";

export function DashboardAnalyticsSectionSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando analitica y KPIs" className="space-y-4" role="status">
      <OperationalSectionHeader
        title="Analitica y KPIs"
        description="Cargando metricas avanzadas de presupuestos, tendencias y alertas..."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonChart aria-label="Cargando distribucion de presupuestos" />
        <SkeletonChart aria-label="Cargando tendencia de proyectos" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonChart aria-label="Cargando alertas de costos" />
        <SkeletonChart aria-label="Cargando rendimiento de catalogos" />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Replace Khipu metrics skeleton**

Modify `components/dashboard/khipu-quality-metrics-skeleton.tsx`:

```tsx
import { SkeletonBlock, SkeletonCard, SkeletonChart, SkeletonText } from "@/components/ui/loading";

export function KhipuQualityMetricsSkeleton() {
  return (
    <SkeletonCard busyLabel="Cargando metricas de calidad Khipu">
      <div className="space-y-4">
        <SkeletonText lines={1} widths={["w-40"]} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-20" radius="2xl" />
          ))}
        </div>
        <SkeletonBlock className="h-4 w-full" radius="full" />
        <SkeletonChart aria-label="Cargando tendencia de calidad Khipu" />
      </div>
    </SkeletonCard>
  );
}
```

- [ ] **Step 3: Run dashboard-related tests**

Run: `npm run test -- app/dashboard`

Expected: PASS. If no dashboard tests are discovered by this pattern, run `npm run test -- components/dashboard`.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/dashboard-analytics-section-skeleton.tsx components/dashboard/khipu-quality-metrics-skeleton.tsx
git commit -m "feat: align dashboard section skeletons"
```

---

### Task 7: Work Schedule Derived View Skeletons

**Files:**
- Create: `components/loading/work-schedule-section-skeletons.tsx`
- Modify: `components/budget/work-schedule/derived-views.tsx`
- Modify: `components/budget/work-schedule-page-content.tsx`
- Test: existing `components/budget/work-schedule-page-content` tests if present.

**Interfaces:**
- Produces:
  - `WorkScheduleValuationSkeleton(): JSX.Element`
  - `WorkScheduleResourceCalendarSkeleton(): JSX.Element`
  - `WorkScheduleCurveSkeleton(): JSX.Element`
- Consumes:
  - `SkeletonTable`
  - `SkeletonChart`

- [ ] **Step 1: Implement work schedule section skeletons**

Create `components/loading/work-schedule-section-skeletons.tsx`:

```tsx
import { SkeletonChart, SkeletonTable } from "@/components/ui/loading";

export function WorkScheduleValuationSkeleton() {
  return (
    <SkeletonTable
      aria-label="Cargando calendario valorizado"
      columns={[
        { id: "code", width: "w-24", sticky: true },
        { id: "description", width: "w-full" },
        { id: "partial", width: "w-24", align: "right" },
        { id: "period1", width: "w-24", align: "right" },
        { id: "period2", width: "w-24", align: "right" },
        { id: "total", width: "w-24", align: "right" },
      ]}
      rowCount={7}
    />
  );
}

export function WorkScheduleResourceCalendarSkeleton() {
  return (
    <SkeletonTable
      aria-label="Cargando calendario de insumos"
      columns={[
        { id: "code", width: "w-24", sticky: true },
        { id: "description", width: "w-full" },
        { id: "unit", width: "w-16" },
        { id: "quantity", width: "w-24", align: "right" },
        { id: "price", width: "w-24", align: "right" },
        { id: "period", width: "w-24", align: "right" },
      ]}
      rowCount={7}
    />
  );
}

export function WorkScheduleCurveSkeleton() {
  return <SkeletonChart aria-label="Cargando curva S" bars={10} />;
}
```

- [ ] **Step 2: Keep `DerivedViewLoadingCard` as compatibility wrapper**

Modify `components/budget/work-schedule/derived-views.tsx`:

```tsx
import {
  WorkScheduleCurveSkeleton,
  WorkScheduleResourceCalendarSkeleton,
  WorkScheduleValuationSkeleton,
} from "@/components/loading/work-schedule-section-skeletons";
```

Replace `DerivedViewLoadingCard` implementation:

```tsx
export function DerivedViewLoadingCard({ label }: { label: string }) {
  if (label.toLowerCase().includes("valorizado")) {
    return <WorkScheduleValuationSkeleton />;
  }

  if (label.toLowerCase().includes("insumos")) {
    return <WorkScheduleResourceCalendarSkeleton />;
  }

  if (label.toLowerCase().includes("curva")) {
    return <WorkScheduleCurveSkeleton />;
  }

  return <WorkScheduleValuationSkeleton />;
}
```

- [ ] **Step 3: Remove duplicate local `DerivedViewLoadingCard` if present**

In `components/budget/work-schedule-page-content.tsx`, search for a second local `DerivedViewLoadingCard` implementation near the bottom. If present, replace it with an import from `components/budget/work-schedule/derived-views` or directly from `components/loading/work-schedule-section-skeletons`.

Use:

```tsx
import { DerivedViewLoadingCard } from "@/components/budget/work-schedule/derived-views";
```

Remove the local duplicate function.

- [ ] **Step 4: Run work schedule tests**

Run: `npm run test -- components/budget/work-schedule-page-content.tsx`

Expected: If the test runner does not accept a component path without tests, run `npm run test -- lib/work-schedule`.

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/loading/work-schedule-section-skeletons.tsx components/budget/work-schedule/derived-views.tsx components/budget/work-schedule-page-content.tsx
git commit -m "feat: add semantic work schedule loading skeletons"
```

---

### Task 8: Anti-Duplicate Loading Audit

**Files:**
- Create: `docs/loading-skeleton-system.md`
- Modify: `app/globals.test.ts` only if CSS/static project tests already use file-content assertions.

**Interfaces:**
- Produces:
  - Written loading policy for future work.

- [ ] **Step 1: Create loading policy documentation**

Create `docs/loading-skeleton-system.md`:

```md
# Loading Skeleton System

## Levels

- Shell loading uses `AppShellSkeleton`.
- Page loading uses a page skeleton from `components/loading`.
- Section loading uses semantic section skeletons.
- Table loading uses `SkeletonTable`.
- Form loading uses `SkeletonForm`.
- Chart loading uses `SkeletonChart`.
- Local actions use button-level loading states.

## Rules

- Do not use a centered spinner for full-page table, form, chart, or dashboard loading.
- Do not hand-roll `animate-pulse`; use `components/ui/loading`.
- Do not replace already-visible page content during refetch unless the page route itself changes.
- Do not hide the app shell for section-level loads.
- Do not modify financial calculations or API contracts for skeleton work.
- Keep decorative blocks `aria-hidden`.
- Use `aria-busy` and an accessible label for user-facing loading regions.

## Route Loading Guidance

Route-level `loading.tsx` files should render the closest matching page skeleton. When using `AppShell`, pass a content skeleton only once. If a future authenticated route group provides shell at layout level, route loading files should stop rendering `AppShell` and render only page content skeletons.

## Section Loading Guidance

Suspense fallbacks inside loaded pages should represent only their own section. They must not duplicate the entire page skeleton.

## Action Loading Guidance

Use `Loader2` inside buttons only for local actions such as saving, deleting, exporting, testing, downloading, or generating.
```

- [ ] **Step 2: Search for direct pulse usage**

Run: `rg -n "animate-pulse|Loader2|Cargando\\.\\.\\.|Cargando" app components`

Expected: Remaining `animate-pulse` usages are inside `components/ui/loading` or intentionally documented exceptions. Remaining `Loader2` usages are action-level or queued for later migration.

- [ ] **Step 3: Search for route loading files**

Run: `rg -n "export default async function .*Loading|<AppShell>|Skeleton" app --glob "loading.tsx"`

Expected: Route `loading.tsx` files use shared skeleton components. `AppShell` may remain during this phase, but content skeleton duplication should be reduced.

- [ ] **Step 4: Document allowed exceptions**

Append to `docs/loading-skeleton-system.md`:

```md
## Current Allowed Exceptions

- Button-level `Loader2` is allowed for local action states.
- Existing client modules may temporarily keep text loading while they are migrated, but new table/form/chart loading states must use semantic skeletons.
- Route-level `loading.tsx` may render `AppShell` until an authenticated layout boundary is introduced.
```

- [ ] **Step 5: Commit**

```bash
git add docs/loading-skeleton-system.md app/globals.test.ts
git commit -m "docs: define loading skeleton policy"
```

---

### Task 9: Final Verification

**Files:**
- No code files unless verification exposes a defect.

- [ ] **Step 1: Run primitive and page skeleton tests**

Run: `npm run test -- components/ui/loading components/loading`

Expected: PASS.

- [ ] **Step 2: Run affected route/component tests**

Run: `npm run test -- app/dashboard app/budgets components/dashboard components/loading`

Expected: PASS. If the runner reports no test files for one path, rerun with the concrete test files created in Tasks 1-4.

- [ ] **Step 3: Run full test suite**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Run production build**

Run: `node ./node_modules/next/dist/bin/next build`

Expected: PASS.

- [ ] **Step 6: Manual QA**

Run: `npm run dev`

Check these routes:

- `/dashboard`
- `/projects`
- `/budgets`
- `/budgets/[id]` with a real id
- `/resources`
- `/partidas`
- `/templates`
- `/settings`
- `/account`
- `/metrados-avanzados`

Expected:

- No page shows two competing skeleton layers.
- Budget detail loading resembles the final budget editor table.
- Catalog loading resembles filter toolbar plus table.
- Dashboard loading resembles KPI cards and charts.
- Settings/account loading resembles form sections.
- Work schedule derived views show table/chart skeletons.
- Buttons still show local action loading states.
- No visible text overlaps on desktop or mobile.

- [ ] **Step 7: Commit verification fixes if needed**

If verification exposes a defect, add the smallest focused test and fix, then commit:

```bash
git add <changed-files>
git commit -m "fix: stabilize loading skeleton system"
```

---

## Delivery Notes

Recommended implementation order:

1. Tasks 1-2 create reusable primitives.
2. Tasks 3-4 create stable shell/page compositions.
3. Task 5 migrates main route loading files.
4. Tasks 6-7 migrate high-visibility section fallbacks.
5. Task 8 prevents recurrence through documentation and audit.
6. Task 9 verifies the system end to end.

Recommended checkpoint after Task 5:

- The user should already see a major improvement in navigation and page-level loading quality.
- If schedule pressure exists, ship Tasks 1-5 as Phase 1 and move Tasks 6-9 to Phase 2.

## Self-Review

Spec coverage:

- Shared primitives are covered by Tasks 1-2.
- Stable shell/page strategy is covered by Task 3.
- Layout-specific route skeletons are covered by Tasks 4-5.
- Dashboard and Khipu section fallbacks are covered by Task 6.
- Work schedule table/chart loading is covered by Task 7.
- Anti-duplicate loading policy is covered by Task 8.
- Verification is covered by Task 9.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified "handle edge cases" placeholders remain.
- Each code task includes explicit target files, interfaces, snippets, commands, and expected results.

Type consistency:

- Shared names use `SkeletonBlock`, `SkeletonTable`, `SkeletonToolbar`, `SkeletonForm`, `SkeletonChart`, `AppShellSkeleton`, and `PageSkeletonFrame` consistently across tasks.
