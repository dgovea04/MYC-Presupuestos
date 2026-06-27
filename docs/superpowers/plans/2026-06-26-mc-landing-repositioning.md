# MC Landing Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the public homepage around `MC Presupuestos` as a modern connected budgeting platform, with `Khipu IA` as an integrated technical differentiator.

**Architecture:** Keep the current landing architecture and styling primitives, but reorder the homepage, replace generic module-marketing copy with stronger workflow positioning, and add two focused sections: one for legacy workflow pain and one for Khipu IA. Reuse existing components where possible, evolve section components in place, and protect the change with focused landing tests.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript strict mode, Tailwind CSS, Vitest, existing landing component primitives

---

## File Structure

### Existing files to modify

- `app/page.tsx`
  Homepage composition and metadata. Update section order, remove old sections from the marketing flow, and switch branding-visible metadata to `MC Presupuestos`.
- `app/page.test.tsx`
  Landing integration-style rendering tests. Update expectations for new copy, branding, and section order.
- `components/landing/hero-section.tsx`
  Rewrite hero positioning, trust signals, and proof points to reflect the new narrative.
- `components/landing/features-section.tsx`
  Keep the component path, but repurpose it into the differentiators section with workflow-advantage framing.
- `components/landing/smart-flows-section.tsx`
  Keep the component path, but rewrite it as the connected workflow sequence with Khipu in the flow.
- `components/landing/comparison-section.tsx`
  Replace named competitor framing with `flujo fragmentado` vs `flujo conectado`.
- `components/landing/final-cta-section.tsx`
  Update closing copy to reinforce platform plus intelligence positioning.
- `components/landing/landing-navbar.tsx`
  Update nav labels and accessible branding text if needed to match new sections and `MC Presupuestos`.
- `components/landing/landing-footer.tsx`
  Update copy, footer link labels if needed, and visible `MYC` references.
- `components/landing/landing-logo.tsx`
  Update image alt text from `MYC Presupuestos` to `MC Presupuestos`.
- `components/landing/landing-content.ts`
  Replace old feature/flow/footer content constants with copy aligned to the new homepage direction.

### New files to create

- `components/landing/legacy-pain-section.tsx`
  New compact section that highlights fragmented/legacy workflow pain without naming competitors.
- `components/landing/khipu-ia-section.tsx`
  New premium section that presents Khipu IA as a contextual technical assistant inside MC Presupuestos.

### Files intentionally not touched

- `components/landing/benefits-section.tsx`
- `components/landing/testimonials-section.tsx`
- `components/landing/pricing-section.tsx`
- `components/landing/faq-section.tsx`
- any dashboard, budget, API, or AI backend files

Those surfaces are not required for the repositioning pass described in the approved spec.

## Task 1: Lock the homepage contract with failing tests

**Files:**
- Modify: `app/page.test.tsx`

- [ ] **Step 1: Write the failing test for the new homepage section order and new section content**

Replace the full-page render test body with assertions for the new homepage sequence and new anchor texts:

```tsx
  it("renders the repositioned MC landing flow in the approved order", async () => {
    const container = await renderNode(
      <main className="min-h-screen bg-slate-50 text-slate-950">
        <LandingNavbar />
        <HeroSection />
        <LegacyPainSection />
        <FeaturesSection />
        <KhipuIASection />
        <ProductPreviewSection />
        <SmartFlowsSection />
        <ComparisonSection />
        <BenefitsSection />
        <TestimonialsSection />
        <FaqSection />
        <PricingSection />
        <FinalCTASection />
        <LandingFooter />
      </main>,
    );

    const text = container.textContent ?? "";

    expect(text).toContain("MC Presupuestos");
    expect(text).toContain("La forma antigua de presupuestar obra ya no alcanza.");
    expect(text).toContain("El problema no es calcular menos. Es coordinar mejor.");
    expect(text).toContain("Khipu IA revisa el presupuesto con contexto visible.");
    expect(text).toContain("Flujo fragmentado");
    expect(text).toContain("Flujo conectado");

    expect(text.indexOf("La forma antigua de presupuestar obra ya no alcanza.")).toBeLessThan(
      text.indexOf("El problema no es calcular menos. Es coordinar mejor."),
    );
    expect(text.indexOf("El problema no es calcular menos. Es coordinar mejor.")).toBeLessThan(
      text.indexOf("Khipu IA revisa el presupuesto con contexto visible."),
    );
  });
```

- [ ] **Step 2: Write focused failing assertions for rebranded hero, workflow, and comparison copy**

Update the existing section tests with new expectations:

```tsx
  it("renders HeroSection with MC branding, stronger positioning, and platform proof", async () => {
    const container = await renderNode(<HeroSection />);

    expect(container.textContent).toContain("La forma antigua de presupuestar obra ya no alcanza.");
    expect(container.textContent).toContain("MC Presupuestos conecta presupuesto, APU, metrados, formula polinomica, cronograma y exportables");
    expect(container.textContent).toContain("Khipu IA integrada");
  });

  it("renders SmartFlowsSection as a connected four-step workflow", async () => {
    const container = await renderNode(<SmartFlowsSection />);

    expect(container.textContent).toContain("Importa o construye");
    expect(container.textContent).toContain("Estructura y conecta");
    expect(container.textContent).toContain("Revisa con Khipu");
    expect(container.textContent).toContain("Prepara entregables");
  });

  it("renders ComparisonSection with fragmentado vs conectado framing", async () => {
    const container = await renderNode(<ComparisonSection />);

    expect(container.textContent).toContain("Flujo fragmentado");
    expect(container.textContent).toContain("Flujo conectado");
    expect(container.textContent).not.toContain("Software tradicional");
    expect(container.textContent).not.toContain("Excel");
  });
```

- [ ] **Step 3: Add imports for the two new sections**

Insert these imports near the existing landing imports:

```tsx
import { KhipuIASection } from "@/components/landing/khipu-ia-section";
import { LegacyPainSection } from "@/components/landing/legacy-pain-section";
```

- [ ] **Step 4: Run the targeted landing test to verify it fails**

Run:

```bash
npm run test -- app/page.test.tsx
```

Expected:

```text
FAIL  app/page.test.tsx
× renders HeroSection with MC branding, stronger positioning, and platform proof
× renders the repositioned MC landing flow in the approved order
Error: Failed to resolve import "@/components/landing/legacy-pain-section"
```

- [ ] **Step 5: Commit the failing-test checkpoint**

```bash
git add app/page.test.tsx
git commit -m "test: define MC landing repositioning expectations"
```

## Task 2: Create the two new narrative sections

**Files:**
- Create: `components/landing/legacy-pain-section.tsx`
- Create: `components/landing/khipu-ia-section.tsx`
- Test: `app/page.test.tsx`

- [ ] **Step 1: Write the minimal `LegacyPainSection` component**

Create `components/landing/legacy-pain-section.tsx` with this structure:

```tsx
import { AlertTriangle, FileSpreadsheet, GitBranch, ScanSearch } from "lucide-react";
import { SectionHeading } from "@/components/landing/section-heading";

const painPoints = [
  {
    title: "Versiones dispersas",
    description: "Presupuesto, APU, observaciones y exportes viven en archivos distintos y pierden continuidad.",
    icon: FileSpreadsheet,
  },
  {
    title: "Retrabajo manual",
    description: "El equipo repite ajustes entre partidas, analisis unitarios y entregables finales.",
    icon: GitBranch,
  },
  {
    title: "Revision lenta",
    description: "Las inconsistencias tecnicas aparecen tarde, cuando el presupuesto ya esta circulando.",
    icon: ScanSearch,
  },
];

export function LegacyPainSection() {
  return (
    <section id="pain" className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Flujo heredado"
        title="El problema no es calcular menos. Es coordinar mejor."
        description="Cuando el presupuesto vive fragmentado, la revision se vuelve mas lenta, el retrabajo sube y la trazabilidad tecnica se debilita."
        align="center"
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {painPoints.map((point) => (
          <article key={point.title} className="landing-surface-elevated rounded-[2rem] p-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <point.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-6 font-display text-xl font-semibold tracking-tight text-slate-950">{point.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{point.description}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        La friccion no viene de una sola tarea. Viene del flujo completo.
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write the minimal `KhipuIASection` component**

Create `components/landing/khipu-ia-section.tsx` with this structure:

```tsx
import { CheckCircle2, Sparkles, TriangleAlert } from "lucide-react";
import { KhipuLogo } from "@/components/khipu/KhipuLogo";
import { SectionHeading } from "@/components/landing/section-heading";

const reviewItems = [
  "Detecta inconsistencias visibles entre partida, unidad y costo.",
  "Sugiere focos de revision antes de exportar o cerrar.",
  "Acompana el analisis tecnico sin aplicar cambios por su cuenta.",
];

export function KhipuIASection() {
  return (
    <section id="khipu" className="landing-section landing-shell scroll-mt-28">
      <div className="landing-surface-contrast overflow-hidden rounded-[2rem] p-8 md:p-10">
        <SectionHeading
          badge="Khipu IA"
          title="Khipu IA revisa el presupuesto con contexto visible."
          description="No es un chat generico. Es una capa tecnica que entiende el presupuesto activo, ayuda a revisar APU y acelera decisiones sin romper el criterio del equipo."
          tone="dark"
        />
        <div className="mt-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-3">
              <KhipuLogo showSubtitle={false} />
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
                Revision contextual
              </span>
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-300">
              Khipu cruza lo que el usuario esta viendo para ayudarte a revisar mejor antes de mover costos, emitir entregables o cerrar observaciones.
            </p>
          </div>
          <div className="space-y-3">
            {reviewItems.map((item, index) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-100">
                <div className="flex items-start gap-3">
                  {index === 1 ? <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-300" /> : index === 2 ? <Sparkles className="mt-0.5 h-4 w-4 text-blue-300" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />}
                  <span>{item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run the targeted landing test to verify the import errors are gone and copy assertions still fail**

Run:

```bash
npm run test -- app/page.test.tsx
```

Expected:

```text
FAIL  app/page.test.tsx
× renders HeroSection with MC branding, stronger positioning, and platform proof
× renders SmartFlowsSection as a connected four-step workflow
AssertionError: expected "...Presupuesta obras..." to contain "La forma antigua de presupuestar obra ya no alcanza."
```

- [ ] **Step 4: Verify the new section copy is visible in isolation**

Temporarily add these quick section tests if the integration test output is unclear:

```tsx
  it("renders LegacyPainSection with fragmented workflow pain points", async () => {
    const container = await renderNode(<LegacyPainSection />);
    expect(container.textContent).toContain("El problema no es calcular menos. Es coordinar mejor.");
    expect(container.textContent).toContain("Versiones dispersas");
  });

  it("renders KhipuIASection with contextual review messaging", async () => {
    const container = await renderNode(<KhipuIASection />);
    expect(container.textContent).toContain("Khipu IA revisa el presupuesto con contexto visible.");
    expect(container.textContent).toContain("No es un chat generico.");
  });
```

- [ ] **Step 5: Commit the new section scaffolding**

```bash
git add components/landing/legacy-pain-section.tsx components/landing/khipu-ia-section.tsx app/page.test.tsx
git commit -m "feat: add MC landing narrative sections"
```

## Task 3: Rebrand and rewrite the homepage composition

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/landing/hero-section.tsx`
- Modify: `components/landing/landing-navbar.tsx`
- Modify: `components/landing/landing-footer.tsx`
- Modify: `components/landing/landing-logo.tsx`
- Test: `app/page.test.tsx`

- [ ] **Step 1: Update `app/page.tsx` metadata and section order**

Replace the homepage metadata and section composition with:

```tsx
export const metadata: Metadata = {
  title: "MC Presupuestos | Plataforma moderna de costos y presupuestos de obra",
  description:
    "MC Presupuestos conecta presupuesto, APU, metrados, formula polinomica, cronograma y exportables en un flujo tecnico moderno. Khipu IA revisa y acelera decisiones con contexto real.",
  openGraph: {
    title: "MC Presupuestos | Plataforma moderna de costos y presupuestos de obra",
    description:
      "Presupuestos, APU, cronograma, exportables y Khipu IA integrados en una sola plataforma para oficinas tecnicas y constructoras.",
    siteName: "MC Presupuestos",
    locale: "es_PE",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};
```

And render the landing in this order:

```tsx
      <LandingNavbar />
      <HeroSection />
      <LegacyPainSection />
      <FeaturesSection />
      <KhipuIASection />
      <ProductPreviewSection />
      <SmartFlowsSection />
      <ComparisonSection />
      <BenefitsSection />
      <TestimonialsSection />
      <FaqSection />
      <PricingSection />
      <FinalCTASection />
      <LandingFooter />
```

- [ ] **Step 2: Rewrite the hero headline, body, and supporting proof**

Update `components/landing/hero-section.tsx` constants and copy:

```tsx
const trustSignals = ["Khipu IA integrada", "Trazabilidad entre presupuesto y APU", "Exportables listos para oficina tecnica"];

const socialProof = [
  "Presupuesto, formula y cronograma en un solo flujo",
  "Revision asistida sin perder criterio tecnico",
  "Disenado para oficinas tecnicas que necesitan mas control",
];
```

Use this content inside the hero:

```tsx
          <Badge className="w-fit border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-blue-700 uppercase">
            Plataforma conectada para presupuestos de obra
          </Badge>
          <h1 className="font-display mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.6rem]">
            La forma antigua de presupuestar obra ya no alcanza.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            MC Presupuestos conecta presupuesto, APU, metrados, formula polinomica, cronograma y exportables en un solo flujo tecnico. Khipu IA revisa, detecta y acelera decisiones con contexto real.
          </p>
```

Keep the mockup, CTA structure, and motion behavior unchanged unless a small spacing adjustment is necessary.

- [ ] **Step 3: Rebrand navbar, footer, and logo accessibility text**

Make these edits:

```tsx
// components/landing/landing-navbar.tsx
const navItems = [
  { label: "Diferenciales", href: "#features" },
  { label: "Khipu IA", href: "#khipu" },
  { label: "Vista", href: "#preview" },
  { label: "Comparacion", href: "#comparison" },
  { label: "Precios", href: "#pricing" },
];

<Link href="/" aria-label="MC Presupuestos">
```

```tsx
// components/landing/landing-footer.tsx
<p className="mt-5 max-w-sm text-sm leading-7 text-slate-500">
  Plataforma moderna de costos y presupuestos de obra para oficinas tecnicas, constructoras e ingenieros que necesitan un flujo mas conectado.
</p>
<p className="mt-6 text-sm text-slate-400">&copy; 2026 MC Presupuestos. Todos los derechos reservados.</p>
```

```tsx
// components/landing/landing-logo.tsx
alt="MC Presupuestos"
```

- [ ] **Step 4: Run the landing test to verify homepage composition passes and section-level failures narrow**

Run:

```bash
npm run test -- app/page.test.tsx
```

Expected:

```text
FAIL  app/page.test.tsx
× renders SmartFlowsSection as a connected four-step workflow
× renders ComparisonSection with fragmentado vs conectado framing
AssertionError: expected old section copy to be replaced
```

- [ ] **Step 5: Commit the homepage composition and branding pass**

```bash
git add app/page.tsx components/landing/hero-section.tsx components/landing/landing-navbar.tsx components/landing/landing-footer.tsx components/landing/landing-logo.tsx app/page.test.tsx
git commit -m "feat: reposition MC landing hero and branding"
```

## Task 4: Rewrite differentiators, workflow, comparison, and CTA content

**Files:**
- Modify: `components/landing/landing-content.ts`
- Modify: `components/landing/features-section.tsx`
- Modify: `components/landing/smart-flows-section.tsx`
- Modify: `components/landing/comparison-section.tsx`
- Modify: `components/landing/final-cta-section.tsx`
- Test: `app/page.test.tsx`

- [ ] **Step 1: Replace the landing content constants with differentiator and workflow language**

Update `components/landing/landing-content.ts` to use:

```tsx
export const featureItems: FeatureItem[] = [
  {
    title: "Presupuesto conectado",
    description: "La estructura tecnica no se rompe al pasar de partidas a revision, exportacion o seguimiento.",
    icon: FileSpreadsheet,
  },
  {
    title: "APU con trazabilidad",
    description: "Relaciona analisis unitarios, insumos y decisiones sin perder contexto entre vistas.",
    icon: Search,
  },
  {
    title: "Formula y cronograma dentro del flujo",
    description: "No cierres el presupuesto en una herramienta para terminar la operacion en otra.",
    icon: FolderKanban,
  },
  {
    title: "Exportables listos para oficina tecnica",
    description: "Prepara PDF, Excel, CSV o ZIP desde una base consistente y revisable.",
    icon: FileArchive,
  },
  {
    title: "Khipu IA con contexto visible",
    description: "Acelera revision tecnica, observaciones y analisis sin convertir la IA en una caja negra.",
    icon: BotMessageSquare,
  },
  {
    title: "Operacion preparada para crecer",
    description: "Trabaja con una base moderna para equipos que necesitan menos friccion y mas continuidad.",
    icon: HardHat,
  },
];

export const smartFlowItems: SmartFlowItem[] = [
  {
    title: "Importa o construye",
    description: "Empieza desde carga existente o arma el presupuesto en una base moderna desde el primer dia.",
    steps: ["Importar datos", "Normalizar estructura", "Abrir presupuesto activo"],
    icon: GitCompareArrows,
  },
  {
    title: "Estructura y conecta",
    description: "Relaciona partidas, APU, metrados y entregables sin cortar el flujo entre modulos.",
    steps: ["Conectar partidas", "Revisar APU", "Preparar resumen tecnico"],
    icon: BarChart3,
  },
  {
    title: "Revisa con Khipu",
    description: "Usa IA contextual para detectar alertas visibles y acelerar el analisis antes del cierre.",
    steps: ["Detectar inconsistencias", "Registrar observacion", "Tomar decision tecnica"],
    icon: StickyNote,
  },
  {
    title: "Prepara entregables",
    description: "Cierra el flujo con exportables, cronograma y paquetes tecnicos listos para compartir.",
    steps: ["Elegir preset", "Validar salida", "Exportar paquete"],
    icon: FileArchive,
  },
];
```

- [ ] **Step 2: Update the section headings to match the new narrative**

In `components/landing/features-section.tsx` use:

```tsx
      <SectionHeading
        badge="Diferenciales"
        title="Una plataforma conectada rinde mejor que un flujo fragmentado."
        description="MC Presupuestos no suma modulos por separado. Conecta el trabajo tecnico para que el presupuesto avance con menos friccion y mas control."
        align="center"
      />
```

In `components/landing/smart-flows-section.tsx` use:

```tsx
      <SectionHeading
        badge="Flujo conectado"
        title="Del presupuesto al entregable sin cambiar de forma de trabajo."
        description="La operacion se mantiene conectada desde la carga inicial hasta la revision con Khipu y la salida final."
        align="center"
      />
```

And change the grid from `lg:grid-cols-3` to `xl:grid-cols-4`:

```tsx
      <div className="mt-12 grid gap-6 xl:grid-cols-4">
```

- [ ] **Step 3: Rewrite the comparison surface to remove named competitors**

Replace the comparison rows and headers in `components/landing/comparison-section.tsx` with:

```tsx
const comparisonRows: Array<{ category: string; fragmentado: ComparisonValue; conectado: ComparisonValue }> = [
  { category: "Continuidad entre presupuesto y APU", fragmentado: "no", conectado: "yes" },
  { category: "Revision tecnica antes de exportar", fragmentado: "partial", conectado: "yes" },
  { category: "Cronograma y formula dentro del mismo flujo", fragmentado: "no", conectado: "yes" },
  { category: "Menos retrabajo por cambios manuales", fragmentado: "partial", conectado: "yes" },
  { category: "Contexto visible para asistencia con IA", fragmentado: "no", conectado: "yes" },
];
```

Use this section heading:

```tsx
      <SectionHeading
        badge="Comparacion operativa"
        title="No hace falta seguir cerrando el presupuesto en un flujo y terminandolo en otro."
        description="La diferencia no es cosmetica. Cambia la velocidad de revision, la trazabilidad y la calidad del cierre tecnico."
        align="center"
      />
```

And use these column headers:

```tsx
                Flujo fragmentado
                Flujo conectado
```

- [ ] **Step 4: Rewrite the final CTA close**

Update `components/landing/final-cta-section.tsx` copy to:

```tsx
        title="MC Presupuestos conecta la operacion. Khipu IA acelera la revision."
        description="Moderniza la forma en que tu oficina tecnica prepara, revisa y entrega presupuestos de obra sin volver al flujo fragmentado."
```

If the component is not using `SectionHeading`, update the visible text nodes to this exact message instead.

- [ ] **Step 5: Run tests and commit the narrative rewrite**

Run:

```bash
npm run test -- app/page.test.tsx
```

Expected:

```text
PASS  app/page.test.tsx
```

Then commit:

```bash
git add components/landing/landing-content.ts components/landing/features-section.tsx components/landing/smart-flows-section.tsx components/landing/comparison-section.tsx components/landing/final-cta-section.tsx app/page.test.tsx
git commit -m "feat: rewrite MC landing differentiators and workflow narrative"
```

## Task 5: Finish with validation and cleanup

**Files:**
- Modify: any landing files touched above only if validation reveals copy or layout regressions

- [ ] **Step 1: Run the targeted landing test suite again**

Run:

```bash
npm run test -- app/page.test.tsx
```

Expected:

```text
PASS  app/page.test.tsx
```

- [ ] **Step 2: Run lint for the changed files**

Run:

```bash
npm run lint
```

Expected:

```text
✔ No ESLint warnings or errors
```

- [ ] **Step 3: Run the app locally for visual verification**

Run:

```bash
npm run dev
```

Verify manually on `/`:

- branding reads `MC Presupuestos`
- hero headline uses the stronger positioning
- legacy pain section appears between hero and differentiators
- Khipu section stands out visually and reads as contextual IA
- workflow uses four cards, not three
- comparison uses `flujo fragmentado` vs `flujo conectado`
- CTA and footer no longer mention `MYC`

- [ ] **Step 4: Apply only landing-scoped fixes if visual issues appear**

If spacing or wording issues show up, limit fixes to the landing files already listed in this plan. Do not expand the scope into dashboard or app-shell surfaces.

Example safe follow-up edits:

```tsx
// good: adjust heading width, text wrap, or card spacing in landing section components
className="mt-12 grid gap-6 xl:grid-cols-4"

// good: tighten copy to avoid line breaks in hero paragraph
"MC Presupuestos conecta presupuesto, APU, metrados, formula polinomica, cronograma y exportables..."
```

- [ ] **Step 5: Commit the validated final pass**

```bash
git add app/page.tsx app/page.test.tsx components/landing/hero-section.tsx components/landing/features-section.tsx components/landing/smart-flows-section.tsx components/landing/comparison-section.tsx components/landing/final-cta-section.tsx components/landing/landing-navbar.tsx components/landing/landing-footer.tsx components/landing/landing-logo.tsx components/landing/landing-content.ts components/landing/legacy-pain-section.tsx components/landing/khipu-ia-section.tsx
git commit -m "feat: launch repositioned MC landing page"
```

## Self-Review

### Spec coverage

- `MC Presupuestos` branding on public landing: covered in Task 3.
- hero repositioning toward operational superiority: covered in Task 3.
- new `LegacyPainSection`: covered in Task 2.
- new `KhipuIASection`: covered in Task 2.
- differentiators instead of module list: covered in Task 4.
- workflow reframing with Khipu in the flow: covered in Task 4.
- implicit comparison without naming competitors: covered in Task 4.
- updated CTA close: covered in Task 4.
- tests and validation: covered in Tasks 1 and 5.

No spec gaps remain.

### Placeholder scan

- No `TODO`, `TBD`, or "implement later" markers remain.
- Each code-changing task includes concrete snippets.
- Each validation step includes exact commands and expected outcomes.

### Type consistency

- New section names are used consistently as `LegacyPainSection` and `KhipuIASection`.
- Existing component paths remain stable for `FeaturesSection`, `SmartFlowsSection`, and `ComparisonSection`.
- The plan keeps landing content in `components/landing/landing-content.ts` instead of inventing a second content source.
- `SectionHeading` is referenced with the existing `tone="dark"` prop name.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-mc-landing-repositioning.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
