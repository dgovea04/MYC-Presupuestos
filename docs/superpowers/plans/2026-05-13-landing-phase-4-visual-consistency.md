# Landing Phase 4 Visual Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the MYC Presupuestos landing page into one cohesive visual system by normalizing section rhythm, heading structure, shared surfaces, and contrast blocks without changing the landing information architecture.

**Architecture:** Keep the landing implementation inside the existing component structure and add only a thin shared styling layer in `app/globals.css`. Drive consistency through two shared primitives, `SectionHeading` and `LandingLinkButton`, then update each landing section to consume the same spacing, surface, and CTA language.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Tailwind CSS v4, Vitest with `jsdom`

---

## File Map

- `app/globals.css`
  - Add shared landing utility classes for section spacing, shell widths, light surfaces, dark surfaces, and chips.
- `components/landing/section-heading.tsx`
  - Make heading rhythm the canonical layout for badge, title, description, alignment, and readable line lengths.
- `components/landing/landing-link-button.tsx`
  - Normalize landing CTA hierarchy across primary, secondary, and ghost variants.
- `components/landing/landing-navbar.tsx`
  - Reuse the normalized CTA language so the header matches the rest of the page.
- `components/landing/hero-section.tsx`
  - Align hero spacing, chips, and mockup surfaces with the new shared system.
- `components/landing/features-section.tsx`
  - Convert section wrapper and feature cards to the canonical premium light-card treatment.
- `components/landing/product-preview-section.tsx`
  - Make Preview the reference elevated product container.
- `components/landing/comparison-section.tsx`
  - Match Preview container, table cadence, and highlight treatment.
- `components/landing/benefits-section.tsx`
  - Bring dark contrast cards into the same radius and spacing system.
- `components/landing/testimonials-section.tsx`
  - Mirror Features card treatment and badge rhythm.
- `components/landing/pricing-section.tsx`
  - Normalize card family and tie the Pro plan to the dark contrast system.
- `components/landing/final-cta-section.tsx`
  - Connect the close-out CTA visually to Benefits and Pro.
- `components/landing/landing-footer.tsx`
  - Smooth the handoff from CTA to footer and normalize spacing.
- `components/landing/landing-primitives.test.tsx`
  - Add focused jsdom tests for shared landing primitives and surface contracts.

### Task 1: Lock Shared Heading and CTA Primitives With Tests

**Files:**
- Create: `components/landing/landing-primitives.test.tsx`
- Modify: `components/landing/section-heading.tsx`
- Modify: `components/landing/landing-link-button.tsx`
- Test: `components/landing/landing-primitives.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LandingLinkButton } from "@/components/landing/landing-link-button";
import { SectionHeading } from "@/components/landing/section-heading";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

afterEach(async () => {
  if (!activeContainer) {
    return;
  }

  const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;

  if (root) {
    await act(async () => {
      root.unmount();
    });
  }

  activeContainer.remove();
  activeContainer = null;
});

describe("landing primitives", () => {
  it("renders centered section headings with the canonical rhythm classes", async () => {
    const container = await renderNode(
      <SectionHeading
        badge="Preview"
        title="Consistent hierarchy"
        description="Readable width and spacing should come from one shared primitive."
        align="center"
      />,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    const title = container.querySelector("h2");
    const description = container.querySelector("p:last-of-type");

    expect(wrapper.className).toContain("mx-auto");
    expect(wrapper.className).toContain("max-w-[56rem]");
    expect(title?.className).toContain("font-display");
    expect(title?.className).toContain("leading-[1.05]");
    expect(description?.className).toContain("max-w-[44rem]");
  });

  it("keeps dark section headings on the contrast palette", async () => {
    const container = await renderNode(
      <SectionHeading
        badge="Beneficios"
        title="Dark heading"
        description="Contrast sections should keep the shared spacing with dark colors."
        tone="dark"
      />,
    );

    const badge = container.querySelector("[data-slot='badge']");
    const title = container.querySelector("h2");

    expect(badge?.className).toContain("bg-white/10");
    expect(title?.className).toContain("text-white");
  });

  it("renders primary and secondary landing buttons with distinct hierarchy classes", async () => {
    const container = await renderNode(
      <div>
        <LandingLinkButton href="/register">Primary CTA</LandingLinkButton>
        <LandingLinkButton href="/login" variant="secondary">
          Secondary CTA
        </LandingLinkButton>
      </div>,
    );

    const links = container.querySelectorAll("a");

    expect(links[0]?.className).toContain("rounded-xl");
    expect(links[0]?.className).toContain("shadow-[0_12px_30px_-12px_rgba(37,99,235,0.55)]");
    expect(links[1]?.className).toContain("border-slate-200/90");
    expect(links[1]?.className).toContain("bg-white/90");
  });
});

async function renderNode(node: React.ReactNode) {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);

  const root = createRoot(activeContainer);
  (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(node);
  });

  return activeContainer;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: FAIL because `SectionHeading` and `LandingLinkButton` do not yet contain the canonical class names asserted by the new tests.

- [ ] **Step 3: Write minimal implementation**

Update `components/landing/section-heading.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  badge: string;
  title: string;
  description: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
};

export function SectionHeading({ badge, title, description, align = "left", tone = "light" }: SectionHeadingProps) {
  const isCentered = align === "center";
  const isDark = tone === "dark";

  return (
    <div className={cn(isCentered ? "mx-auto flex max-w-[56rem] flex-col items-center text-center" : "max-w-[52rem]")}>
      <Badge
        data-slot="badge"
        className={
          isDark
            ? "border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300"
            : "border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700"
        }
      >
        {badge}
      </Badge>
      <h2
        className={cn(
          "font-display mt-5 text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-[2.4rem] xl:text-[2.72rem]",
          isDark ? "text-white" : "text-slate-950",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "mt-4 max-w-[44rem] text-[0.98rem] leading-7 sm:text-base",
          isCentered && "mx-auto",
          isDark ? "text-slate-300" : "text-slate-600",
        )}
      >
        {description}
      </p>
    </div>
  );
}
```

Update `components/landing/landing-link-button.tsx`:

```tsx
const baseClasses =
  "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

const variantClasses: Record<NonNullable<LandingLinkButtonProps["variant"]>, string> = {
  primary:
    "bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] text-white shadow-[0_12px_30px_-12px_rgba(37,99,235,0.55)] hover:opacity-95 hover:shadow-[0_16px_36px_-14px_rgba(37,99,235,0.58)]",
  secondary:
    "border border-slate-200/90 bg-white/90 text-slate-900 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.24)] hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: PASS with 3 tests passed in `components/landing/landing-primitives.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/landing/landing-primitives.test.tsx components/landing/section-heading.tsx components/landing/landing-link-button.tsx
git commit -m "test: lock landing visual primitives"
```

### Task 2: Add Shared Landing Section and Surface Utilities

**Files:**
- Modify: `app/globals.css`
- Modify: `components/landing/hero-section.tsx`
- Modify: `components/landing/features-section.tsx`
- Test: `components/landing/landing-primitives.test.tsx`

- [ ] **Step 1: Extend the failing test with shared section-shell assertions**

Append to `components/landing/landing-primitives.test.tsx`:

```tsx
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";

it("applies the shared section shell and chip treatment to landing sections", async () => {
  const container = await renderNode(
    <div>
      <HeroSection />
      <FeaturesSection />
    </div>,
  );

  const featureSection = container.querySelector("#features");
  const heroChip = [...container.querySelectorAll("span")].find((node) => node.textContent?.includes("Normativa peruana"));

  expect(featureSection?.className).toContain("landing-section");
  expect(featureSection?.className).toContain("landing-shell");
  expect(heroChip?.className).toContain("landing-chip");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: FAIL because the sections do not yet expose the shared `landing-section`, `landing-shell`, and `landing-chip` class contract.

- [ ] **Step 3: Write minimal implementation**

Update `app/globals.css`:

```css
.landing-shell {
  width: 100%;
  max-width: 1440px;
  margin-inline: auto;
  padding-inline: 1rem;
}

.landing-section {
  padding-block: 5rem;
}

.landing-section-tight {
  padding-block: 4.5rem;
}

.landing-section-contrast {
  padding-block: 5rem;
}

.landing-surface-elevated {
  border: 1px solid rgba(226, 232, 240, 0.8);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.96) 100%);
  box-shadow: 0 24px 70px -44px rgba(15, 23, 42, 0.32);
}

.landing-surface-subtle {
  border: 1px solid rgba(226, 232, 240, 0.85);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 14px 32px -24px rgba(15, 23, 42, 0.18);
}

.landing-surface-contrast {
  background: radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 30%),
    linear-gradient(135deg, #020617 0%, #0f172a 100%);
  box-shadow: 0 26px 70px -52px rgba(2, 6, 23, 0.72);
}

.landing-chip {
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
}

@media (min-width: 640px) {
  .landing-shell {
    padding-inline: 1.5rem;
  }
}

@media (min-width: 768px) {
  .landing-section,
  .landing-section-contrast {
    padding-block: 7rem;
  }

  .landing-section-tight {
    padding-block: 6rem;
  }
}

@media (min-width: 1280px) {
  .landing-shell {
    padding-inline: 3rem;
  }
}
```

Update `components/landing/hero-section.tsx`:

```tsx
<div className="mt-8 flex flex-wrap gap-3 text-sm">
  <span className="landing-chip rounded-full px-3 py-1.5">Presupuestos generales</span>
  <span className="landing-chip rounded-full px-3 py-1.5">APU detallado</span>
  <span className="landing-chip rounded-full px-3 py-1.5">Normativa peruana</span>
</div>
```

Update `components/landing/features-section.tsx`:

```tsx
<section id="features" className="landing-section landing-shell">
  <SectionHeading
    badge="Modulos clave"
    title="Todo el flujo de costos de obra en una sola plataforma."
    description="Cada modulo responde a tareas reales de presupuestacion, control tecnico y preparacion de reportes para construccion."
    align="center"
  />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: PASS with the shared section-shell and chip assertions succeeding.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/landing/hero-section.tsx components/landing/features-section.tsx components/landing/landing-primitives.test.tsx
git commit -m "style: add shared landing surface utilities"
```

### Task 3: Align Hero, Preview, and Comparison Around One Product Surface System

**Files:**
- Modify: `components/landing/hero-section.tsx`
- Modify: `components/landing/product-preview-section.tsx`
- Modify: `components/landing/comparison-section.tsx`
- Test: `components/landing/landing-primitives.test.tsx`

- [ ] **Step 1: Add failing assertions for shared product-surface classes**

Append to `components/landing/landing-primitives.test.tsx`:

```tsx
import { ComparisonSection } from "@/components/landing/comparison-section";
import { ProductPreviewSection } from "@/components/landing/product-preview-section";

it("uses the shared elevated product surface across hero, preview, and comparison", async () => {
  const container = await renderNode(
    <div>
      <HeroSection />
      <ProductPreviewSection />
      <ComparisonSection />
    </div>,
  );

  const elevatedBlocks = container.querySelectorAll(".landing-surface-elevated");

  expect(elevatedBlocks.length).toBeGreaterThanOrEqual(3);
  expect(container.textContent).toContain("Presupuesto general");
  expect(container.textContent).toContain("Presupuesto de estructuras");
  expect(container.textContent).toContain("Comparativo de experiencia operativa");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: FAIL because the three product sections do not yet share the `landing-surface-elevated` class contract.

- [ ] **Step 3: Write minimal implementation**

Update `components/landing/hero-section.tsx`:

```tsx
<Card className="landing-surface-elevated overflow-hidden rounded-[1.9rem] p-3 backdrop-blur lg:ml-4 xl:ml-6">
```

Update `components/landing/product-preview-section.tsx`:

```tsx
<section id="preview" className="landing-section bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
  <div className="landing-shell">
    ...
    <div className="landing-surface-elevated overflow-hidden rounded-[1.9rem]">
```

Update `components/landing/comparison-section.tsx`:

```tsx
<section id="comparison" className="landing-section landing-shell">
  <SectionHeading ... align="center" />
  <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
    <span className="landing-chip rounded-full px-3 py-1.5">Comparacion de uso real</span>
    <span className="landing-chip rounded-full px-3 py-1.5">Menos retrabajo manual</span>
    <span className="landing-chip rounded-full px-3 py-1.5">Mas continuidad entre modulos</span>
  </div>
  <div className="landing-surface-elevated mt-14 overflow-hidden rounded-[1.9rem]">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: PASS with at least three elevated product surfaces found in the rendered tree.

- [ ] **Step 5: Commit**

```bash
git add components/landing/hero-section.tsx components/landing/product-preview-section.tsx components/landing/comparison-section.tsx components/landing/landing-primitives.test.tsx
git commit -m "style: align landing product surfaces"
```

### Task 4: Unify Light Card Sections and CTA Hierarchy

**Files:**
- Modify: `components/landing/features-section.tsx`
- Modify: `components/landing/testimonials-section.tsx`
- Modify: `components/landing/pricing-section.tsx`
- Modify: `components/landing/landing-navbar.tsx`
- Test: `components/landing/landing-primitives.test.tsx`

- [ ] **Step 1: Add failing assertions for light-card and CTA consistency**

Append to `components/landing/landing-primitives.test.tsx`:

```tsx
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";

it("reuses the premium light-card treatment across features, testimonials, and non-highlighted pricing", async () => {
  const container = await renderNode(
    <div>
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
    </div>,
  );

  expect(container.querySelectorAll(".landing-surface-elevated").length).toBeGreaterThanOrEqual(6);
  expect(container.textContent).toContain("Modulos clave");
  expect(container.textContent).toContain("Testimonios");
  expect(container.textContent).toContain("Precios");
});

it("keeps the navbar login action on the shared secondary CTA treatment", async () => {
  const container = await renderNode(<LandingNavbar />);
  const loginLink = [...container.querySelectorAll("a")].find((node) => node.textContent?.includes("Iniciar sesion"));

  expect(loginLink?.className).toContain("border-slate-200/90");
  expect(loginLink?.className).toContain("bg-white/90");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: FAIL because these sections still use mixed card treatments and the navbar login action overrides the shared secondary CTA style manually.

- [ ] **Step 3: Write minimal implementation**

Update `components/landing/features-section.tsx` and `components/landing/testimonials-section.tsx` so their outer card wrappers use the shared elevated class:

```tsx
className="landing-surface-elevated group relative overflow-hidden rounded-[1.75rem] p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_30px_80px_-42px_rgba(37,99,235,0.24)]"
```

Update `components/landing/pricing-section.tsx` so non-highlighted cards also use the elevated class and the highlight card uses the contrast family:

```tsx
className={`relative overflow-hidden rounded-[1.9rem] border p-8 transition duration-300 ${
  plan.highlight
    ? "landing-surface-contrast border-blue-200 bg-slate-950 text-white xl:-translate-y-3"
    : "landing-surface-elevated text-slate-950 hover:-translate-y-1 hover:shadow-[0_28px_80px_-46px_rgba(15,23,42,0.3)]"
}`}
```

Update `components/landing/landing-navbar.tsx`:

```tsx
<LandingLinkButton href="/login" variant="secondary" className="hidden sm:inline-flex">
  Iniciar sesion
</LandingLinkButton>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: PASS with the navbar using the shared CTA treatment and the light-card sections reporting the shared elevated surface class.

- [ ] **Step 5: Commit**

```bash
git add components/landing/features-section.tsx components/landing/testimonials-section.tsx components/landing/pricing-section.tsx components/landing/landing-navbar.tsx components/landing/landing-primitives.test.tsx
git commit -m "style: unify landing cards and ctas"
```

### Task 5: Tie Contrast Sections Together and Finish Verification

**Files:**
- Modify: `components/landing/benefits-section.tsx`
- Modify: `components/landing/final-cta-section.tsx`
- Modify: `components/landing/landing-footer.tsx`
- Modify: `components/landing/product-preview-section.tsx`
- Modify: `components/landing/comparison-section.tsx`
- Test: `components/landing/landing-primitives.test.tsx`

- [ ] **Step 1: Add failing assertions for the dark-system handoff**

Append to `components/landing/landing-primitives.test.tsx`:

```tsx
import { BenefitsSection } from "@/components/landing/benefits-section";
import { FinalCTASection } from "@/components/landing/final-cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";

it("reuses the contrast surface system across benefits and the final cta", async () => {
  const container = await renderNode(
    <div>
      <BenefitsSection />
      <FinalCTASection />
      <LandingFooter />
    </div>,
  );

  expect(container.querySelectorAll(".landing-surface-contrast").length).toBeGreaterThanOrEqual(2);
  expect(container.textContent).toContain("Beneficios");
  expect(container.textContent).toContain("Crear cuenta");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`

Expected: FAIL because Benefits and Final CTA do not yet expose the shared `landing-surface-contrast` contract.

- [ ] **Step 3: Write minimal implementation**

Update `components/landing/benefits-section.tsx`:

```tsx
<section className="landing-section-contrast bg-slate-950 text-white">
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
```

Update `components/landing/final-cta-section.tsx`:

```tsx
<section className="landing-section-tight mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
  <div className="landing-surface-contrast overflow-hidden rounded-[2rem] px-6 py-12 text-white sm:px-10 lg:px-12">
```

Update `components/landing/landing-footer.tsx`:

```tsx
<footer className="border-t border-slate-200/80 bg-white">
  <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_repeat(3,0.7fr)] lg:px-8 xl:px-12">
```

While finishing, normalize Preview and Comparison internal footer and header spacing to the shared rhythm:

```tsx
<div className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-6">
```

and

```tsx
<div className="grid gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-5 md:grid-cols-3">
```

- [ ] **Step 4: Run the verification suite**

Run: `npm run test -- components/landing/landing-primitives.test.tsx`
Expected: PASS with all landing primitive assertions green

Run: `npm run lint`
Expected: PASS with no new ESLint errors in landing files

- [ ] **Step 5: Commit**

```bash
git add components/landing/benefits-section.tsx components/landing/final-cta-section.tsx components/landing/landing-footer.tsx components/landing/product-preview-section.tsx components/landing/comparison-section.tsx components/landing/landing-primitives.test.tsx
git commit -m "style: finish landing phase 4 consistency"
```

## Self-Review

### Spec coverage

- Section rhythm: covered by Tasks 1, 2, and 5
- Surface hierarchy: covered by Tasks 2, 3, 4, and 5
- Shape and shadow language: covered by Tasks 1 through 5
- Heading rhythm: covered by Task 1
- Accent and CTA consistency: covered by Tasks 1 and 4
- Hero, Preview, Comparison alignment: covered by Task 3
- Features, Testimonials, Pricing alignment: covered by Task 4
- Benefits, Final CTA, Footer consistency: covered by Task 5

No spec sections are left without a task.

### Placeholder scan

- No `TODO`, `TBD`, or "implement later" placeholders remain.
- Every test step contains runnable commands.
- Every implementation step includes the concrete code block to add or replace.

### Type consistency

- Shared helper class names are consistent across tasks: `landing-shell`, `landing-section`, `landing-section-tight`, `landing-section-contrast`, `landing-surface-elevated`, `landing-surface-subtle`, `landing-surface-contrast`, `landing-chip`
- Shared component names are consistent across all tasks: `SectionHeading`, `LandingLinkButton`, `LandingNavbar`

