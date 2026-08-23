# Landing Workspace, Khipu IA, and Pricing Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the public landing page so it reflects the current product: MC Presupuestos with workspace collaboration, Khipu IA as the main AI concept, Khipu modo agente for budget/APU creation workflows, and revised Starter/Pro/Empresa plan contents.

**Architecture:** Keep the existing landing architecture and edit the smallest set of content/components needed. Centralize copy changes in `components/landing/landing-content.ts` when possible, add a focused workspace section if the existing feature sections cannot communicate the new collaborative story clearly, and preserve the current route flow in `app/page.tsx`.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Tailwind CSS, lucide-react, existing landing components.

**Spec:** User request captured in this conversation on 2026-08-22: document a plan to update the landing with workspace, Khipu IA, Khipu modo agente, revised pricing, copy polish, and removal of internal FAQ copy.

## Global Constraints

- Keep Khipu IA as the primary public-facing AI name.
- Describe Khipu modo agente as a specific capability inside Khipu IA for creating and assisting budgets, APUs, partidas, and related technical workflows.
- Update Starter, Pro, and Empresa pricing content to match the current membership boundaries before implementation.
- Remove internal implementation/design commentary from user-visible copy, especially the FAQ text that starts with "Mantuvimos las respuestas en una sola columna".
- Keep copy professional, technical, direct, and Spanish-first.
- Do not change financial formulas or calculation logic.
- Reuse existing landing components and visual language before adding new abstractions.
- Use TypeScript strict mode and never introduce `any`.
- Run `npm run lint` and relevant tests before claiming completion.

---

## File Structure

- Modify `components/landing/landing-content.ts`: main source for feature, benefit, smart-flow, testimonial, pricing, FAQ, and footer copy.
- Modify `components/landing/faq-section.tsx`: remove internal FAQ explainer copy and replace it with user-facing support/demo copy.
- Modify `components/landing/hero-section.tsx`: update hero headline/subheadline/metrics if those strings are local to the component.
- Modify `components/landing/khipu-ia-section.tsx`: keep Khipu IA as the main section, add or clarify Khipu modo agente as a workflow capability.
- Modify `components/landing/features-section.tsx`: ensure workspace and team administration appear in the feature grid.
- Modify `components/landing/benefits-section.tsx`: align benefits with office technical teams, collaboration, review, and traceability.
- Modify `components/landing/pricing-section.tsx`: adjust rendering only if new plan details require badges, plan limits, or grouping not supported by existing data.
- Optional create `components/landing/workspace-section.tsx`: only if workspace needs a full section rather than a feature card.
- Modify `app/page.tsx`: only if adding `WorkspaceSection` to the landing order.
- Test `components/landing/landing-primitives.test.tsx` or add/extend a landing test if current tests cover visible copy.
- Test `app/page.test.tsx` if page composition changes.

---

### Task 1: Audit Current Landing Copy and Membership Boundaries

**Files:**
- Read: `components/landing/landing-content.ts`
- Read: `components/landing/faq-section.tsx`
- Read: `components/landing/hero-section.tsx`
- Read: `components/landing/khipu-ia-section.tsx`
- Read: `components/landing/pricing-section.tsx`
- Read: `lib/workspace/entitlements.ts`
- Read: `lib/billing/pricing.ts`

**Interfaces:**
- Consumes: Existing landing components and current entitlement/pricing definitions.
- Produces: A concrete copy checklist for Tasks 2-6.

- [ ] **Step 1: Locate current public copy**

Run:

```powershell
rg -n "Khipu|Starter|Pro|Empresa|Gratis|workspace|Mantuvimos|Preguntas|precio|plan" components/landing app/page.tsx lib/workspace lib/billing
```

Expected: output points to landing content, FAQ component, pricing helpers, and entitlement definitions.

- [ ] **Step 2: Identify actual feature boundaries**

Open the entitlement and pricing files:

```powershell
Get-Content -Path lib\workspace\entitlements.ts
Get-Content -Path lib\billing\pricing.ts
```

Expected: confirm which capabilities belong to free, Pro, and Empresa before rewriting pricing copy.

- [ ] **Step 3: Create a short implementation note in the PR description or working notes**

Record these exact groups before editing:

```text
Starter / Gratis:
- Current allowed limits and core features from entitlement source.

Pro:
- Current added limits, Khipu IA access, Khipu modo agente access, imports, exports, automations, and advanced workflows from entitlement source.

Empresa:
- Current team/admin/support features from entitlement source.
```

Expected: no pricing copy is changed from memory; it is based on current repo definitions.

---

### Task 2: Refresh Hero and Navigation Message

**Files:**
- Modify: `components/landing/hero-section.tsx`
- Modify: `components/landing/landing-navbar.tsx` if nav labels are local there
- Modify: `components/landing/landing-content.ts` if hero/nav strings are centralized later

**Interfaces:**
- Consumes: Current landing route and visual hierarchy.
- Produces: Updated first-screen positioning for the product.

- [ ] **Step 1: Update hero positioning**

Use this copy direction:

```text
Headline option:
Presupuestos de obra, APU y control técnico en un solo workspace.

Subheadline option:
MC Presupuestos conecta costos, metrados, fórmula polinómica, cronograma, exportables y Khipu IA para que tu equipo trabaje con menos hojas sueltas y más trazabilidad.
```

Expected: the hero makes workspace and Khipu IA visible without making "modo agente" the top-level brand.

- [ ] **Step 2: Keep Khipu IA primary**

If the hero mentions agent behavior, phrase it as:

```text
Khipu IA incluye un modo agente para crear presupuestos, asistir APUs y acelerar revisiones técnicas con contexto del proyecto.
```

Expected: public hierarchy is "Khipu IA" first, "modo agente" second.

- [ ] **Step 3: Review CTA labels**

Prefer concise CTAs such as:

```text
Crear cuenta gratis
Ver planes
Agendar demo
```

Expected: CTAs match the updated pricing and team positioning.

---

### Task 3: Update Feature, Benefit, and Flow Copy

**Files:**
- Modify: `components/landing/landing-content.ts`
- Modify: `components/landing/features-section.tsx` only if the layout needs labels or grouping changes
- Modify: `components/landing/benefits-section.tsx` only if the component has hardcoded copy
- Modify: `components/landing/smart-flows-section.tsx` only if the component has hardcoded copy

**Interfaces:**
- Consumes: Existing `FeatureItem`, `BenefitItem`, and `SmartFlowItem` types.
- Produces: Updated arrays that communicate current product capabilities.

- [ ] **Step 1: Replace or add feature cards**

Ensure the feature grid includes these concepts:

```text
Workspace colaborativo:
Invita a tu equipo, administra roles y trabaja sobre una base compartida de presupuestos, APUs y catálogos.

Khipu IA:
Asistencia técnica con contexto visible para revisar partidas, explicar costos y detectar inconsistencias antes del cierre.

Khipu modo agente:
Crea presupuestos, propone APUs y ejecuta acciones guiadas dentro del flujo, siempre con revisión humana antes de aplicar cambios.

Importación y migración:
Parte desde Excel, S10, Delphin, RW7 o PDF cuando corresponda, sin rehacer todo desde cero.

Fórmula polinómica y cronograma:
Conecta presupuesto, reajustes, valorización, recursos y Curva S en el mismo flujo técnico.

Exportables para oficina técnica:
Genera PDF, Excel, CSV o ZIP desde una base consistente y revisable.
```

Expected: no feature repeats the same value proposition with different wording.

- [ ] **Step 2: Align benefits with buyer roles**

Update benefits around these role-based outcomes:

```text
Jefe de oficina técnica:
Más trazabilidad sobre cambios, revisiones y entregables.

Presupuestador:
Menos retrabajo entre hojas, APUs, metrados y exportaciones.

Gerencia:
Mayor visibilidad del avance, costos y estándares del equipo.

Equipo:
Workspace común con permisos, invitaciones y operación más ordenada.
```

Expected: benefits speak to practical outcomes rather than broad SaaS claims.

- [ ] **Step 3: Update smart flows**

Use a flow similar to:

```text
1. Importa o crea el presupuesto.
2. Estructura partidas, APUs y metrados.
3. Revisa con Khipu IA.
4. Usa Khipu modo agente para crear o completar partidas/APUs cuando corresponda.
5. Coordina en workspace.
6. Exporta entregables técnicos.
```

Expected: the flow explains how workspace and Khipu fit into daily work.

---

### Task 4: Add or Integrate Workspace Section

**Files:**
- Optional create: `components/landing/workspace-section.tsx`
- Modify: `app/page.tsx` if adding the section
- Modify: `components/landing/landing-content.ts` if the section uses centralized content

**Interfaces:**
- Consumes: Existing landing section patterns.
- Produces: A visible workspace story on the landing page.

- [ ] **Step 1: Decide whether a feature card is enough**

Use a dedicated section if workspace has at least four public-facing capabilities to show:

```text
Roles y permisos
Invitaciones y enlaces de invitación
Auditoría del workspace
Facturación y uso por equipo
```

Expected: if fewer than four are ready to market, keep workspace inside the feature and benefit sections.

- [ ] **Step 2: If needed, create `WorkspaceSection`**

Follow existing section patterns from `components/landing/khipu-ia-section.tsx` and `components/landing/product-preview-section.tsx`.

Use this copy direction:

```text
Title:
Un workspace para que la oficina técnica trabaje sobre la misma base.

Description:
Administra miembros, roles, invitaciones, uso y cambios del equipo sin separar la operación técnica de la gestión del proyecto.
```

Expected: the section feels like B2B SaaS product detail, not a marketing detour.

- [ ] **Step 3: Place the section**

If created, insert it in `app/page.tsx` after `ProductPreviewSection` or before `SmartFlowsSection`.

Expected: the story moves from product overview to team operation before pricing.

---

### Task 5: Refresh Khipu IA Section With Modo Agente

**Files:**
- Modify: `components/landing/khipu-ia-section.tsx`
- Modify: `components/landing/landing-content.ts` if Khipu copy is centralized

**Interfaces:**
- Consumes: Existing Khipu IA component.
- Produces: Clear hierarchy between Khipu IA and Khipu modo agente.

- [ ] **Step 1: Keep the section title centered on Khipu IA**

Use a title like:

```text
Khipu IA para revisar, explicar y avanzar con contexto técnico.
```

Expected: "Khipu IA" remains the main feature name.

- [ ] **Step 2: Add modo agente as a capability**

Use a supporting block/card like:

```text
Modo agente:
Cuando necesitas crear o completar trabajo, Khipu puede ayudarte a generar partidas, proponer APUs, preparar estructuras y guiar acciones dentro del presupuesto. Tú revisas antes de aplicar.
```

Expected: users understand agent mode is for productive creation, not only chat.

- [ ] **Step 3: Avoid overclaiming**

Do not say Khipu autonomously closes budgets, guarantees prices, replaces technical review, or modifies data without approval.

Expected: copy preserves human review and technical trust.

---

### Task 6: Update Pricing Table Contents

**Files:**
- Modify: `components/landing/landing-content.ts`
- Modify: `components/landing/pricing-section.tsx` only if current rendering cannot show the needed plan distinctions
- Read: `lib/workspace/entitlements.ts`
- Read: `lib/billing/pricing.ts`

**Interfaces:**
- Consumes: Current plan limits and entitlement names.
- Produces: Pricing cards that match the current free and Pro membership behavior.

- [ ] **Step 1: Rewrite Starter / Gratis features**

Base the list on the actual current free membership. Suggested structure:

```text
Starter / Gratis:
- Crear presupuestos reales con límites operativos.
- Partidas, subpresupuestos y APU manual.
- Catálogo básico de insumos.
- Modo moderno y modo Excel cuando esté disponible para el plan.
- Exportación básica.
- Funciones colaborativas básicas solo si los entitlements lo permiten.
```

Expected: no paid-only capability appears in Gratis.

- [ ] **Step 2: Rewrite Pro features**

Base the list on current Pro increases. Suggested structure:

```text
Pro:
- Límites ampliados para presupuestos, proyectos o uso según entitlements.
- Khipu IA.
- Khipu modo agente para creación/asistencia de presupuestos, APUs y partidas.
- Importaciones avanzadas si están incluidas.
- Exportaciones avanzadas PDF, Excel, CSV y ZIP si están incluidas.
- Cronograma, valorización, recursos y Curva S si están incluidas.
- Fórmula polinómica y reajustes si están incluidas.
- Automatizaciones y sugerencias revisables.
```

Expected: Pro reads as a clear upgrade from the new free plan.

- [ ] **Step 3: Rewrite Empresa features**

Base the list on team/admin capabilities. Suggested structure:

```text
Empresa:
- Todo Pro con límites y acompañamiento ampliados.
- Administración avanzada de workspace.
- Roles, auditoría, invitaciones y control operativo del equipo.
- Estándares, plantillas y datos maestros para la organización.
- Soporte prioritario, onboarding y acompañamiento técnico.
```

Expected: Empresa is positioned for teams and standardization, not just "more of Pro".

- [ ] **Step 4: Check plan labels and badges**

Use badges that reflect reality:

```text
Starter: Gratis
Pro: Para oficina técnica
Empresa: Para equipos y constructoras
```

Expected: badges clarify audience and upgrade path.

---

### Task 7: Fix FAQ Copy and Add New FAQs

**Files:**
- Modify: `components/landing/faq-section.tsx`
- Modify: `components/landing/landing-content.ts`

**Interfaces:**
- Consumes: Existing `faqItems` and `faqCategories`.
- Produces: FAQ section with no internal notes and better coverage of new capabilities.

- [ ] **Step 1: Remove internal FAQ copy**

Replace:

```text
Mantuvimos las respuestas en una sola columna porque se leen mejor cuando tienen distinto largo. La mejora está en ampliar el bloque, ordenar mejor la navegación y dejar el contacto a un clic.
```

With:

```text
Encuentra respuestas sobre planes, migración, seguridad, IA y soporte. Si tu caso requiere una revisión más específica, puedes contactarnos y coordinamos una demo guiada.
```

Expected: no implementation commentary is visible to users.

- [ ] **Step 2: Add workspace FAQ**

Add:

```text
Question:
¿Qué es un workspace en MC Presupuestos?

Answer:
Un workspace es el espacio compartido donde tu equipo administra presupuestos, proyectos, catálogos, miembros y permisos. Permite ordenar la operación de la oficina técnica sin separar la gestión del equipo del trabajo presupuestal.
```

- [ ] **Step 3: Add Khipu modo agente FAQ**

Add:

```text
Question:
¿Cuál es la diferencia entre Khipu IA y Khipu modo agente?

Answer:
Khipu IA es el asistente técnico de MC Presupuestos. Dentro de Khipu IA, el modo agente está orientado a crear o completar trabajo: puede ayudar a generar partidas, proponer APUs, preparar estructuras y guiar acciones dentro del presupuesto. Los cambios deben revisarse antes de aplicarse.
```

- [ ] **Step 4: Add pricing FAQ if needed**

Add a FAQ that matches actual plan boundaries:

```text
Question:
¿Qué cambia entre el plan gratis y Pro?

Answer:
El plan gratis permite trabajar con funciones base y límites operativos. Pro amplía esos límites y habilita capacidades avanzadas como Khipu IA, Khipu modo agente, automatizaciones, importaciones o exportaciones avanzadas según la configuración vigente del plan.
```

Expected: if exact limits are public, replace "límites operativos" with the exact current limits from the entitlement audit.

---

### Task 8: Clean Encoding and Copy Quality

**Files:**
- Modify: `components/landing/landing-content.ts`
- Modify: any touched landing component containing mojibake text

**Interfaces:**
- Consumes: Updated Spanish landing copy.
- Produces: Correct accents, clear copy, and no leaked internal notes.

- [ ] **Step 1: Search for mojibake and internal notes**

Run:

```powershell
rg -n "Ã|Â|Mantuvimos|mejora está|una sola columna|TODO|TBD" components/landing app/page.tsx
```

Expected: no user-visible mojibake or internal planning phrases remain in touched landing files.

- [ ] **Step 2: Fix Spanish accents in touched copy**

Examples to correct:

```text
tÃ©cnica -> técnica
fÃ³rmula -> fórmula
Ãºtil -> útil
decisiÃ³n -> decisión
```

Expected: touched copy is readable Spanish.

- [ ] **Step 3: Keep tone restrained**

Reject wording that sounds exaggerated:

```text
Incorrect:
La IA revolucionaria que hace tus presupuestos sola.

Correct:
Khipu IA acelera revisión y creación asistida con contexto técnico y revisión humana.
```

Expected: copy remains credible for engineers, contractors, and technical offices.

---

### Task 9: Verify Landing Composition and Tests

**Files:**
- Test: `components/landing/landing-primitives.test.tsx`
- Test: `app/page.test.tsx`
- Optional test: add a focused copy regression test if no existing test covers FAQ/pricing text

**Interfaces:**
- Consumes: All edited landing content/components.
- Produces: Verified landing copy and composition.

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npm run test -- app/page.test.tsx components/landing/landing-primitives.test.tsx
```

Expected: tests pass, or failures identify only snapshots/assertions that need updating because copy changed intentionally.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: lint passes without TypeScript or accessibility regressions.

- [ ] **Step 3: Manually inspect the landing**

Run:

```powershell
npm run dev
```

Open the local URL and inspect:

```text
Desktop: hero, Khipu IA, workspace, pricing, FAQ.
Mobile: hero, pricing cards, FAQ accordion, CTA buttons.
```

Expected: no overlapping text, no cramped pricing cards, no internal copy, and CTAs remain visible.

---

### Task 10: Commit in Reviewable Chunks

**Files:**
- Commit all edited landing files and this plan.

**Interfaces:**
- Consumes: Passing tests and reviewed UI.
- Produces: Clean git history.

- [ ] **Step 1: Review diff**

Run:

```powershell
git diff -- components/landing app/page.tsx docs/superpowers/plans/2026-08-22-landing-workspace-khipu-pricing-refresh.md
```

Expected: diff contains only landing copy/component changes and this plan.

- [ ] **Step 2: Commit**

Run:

```powershell
git add components/landing app/page.tsx docs/superpowers/plans/2026-08-22-landing-workspace-khipu-pricing-refresh.md
git commit -m "docs: plan landing workspace khipu pricing refresh"
```

Expected: commit succeeds after verification.

---

## Self-Review

- Spec coverage: The plan covers workspace, Khipu IA, Khipu modo agente, pricing updates, FAQ correction, copy polish, testing, and commit flow.
- Placeholder scan: No TBD/TODO placeholders are used.
- Type consistency: Existing landing content types remain the expected interfaces unless implementation discovers a real need to extend them.
