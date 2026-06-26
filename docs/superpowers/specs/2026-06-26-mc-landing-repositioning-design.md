# MC Landing Repositioning Design

## Context

The public landing currently presents the product as a modern SaaS suite for construction budgeting, but the message still leans too much toward a generic "set of modules" story.

The next landing iteration should reposition the homepage around two approved ideas:

- `MC Presupuestos` is the main product brand for the public experience.
- `Khipu IA` is a major differentiator, but it remains an integrated intelligence layer inside the platform rather than a separate primary product.

The approved commercial direction is:

- Focus on technical and operational superiority.
- Use a premium, modern, slightly challenging tone.
- Contrast against fragmented and legacy workflows without naming specific competitors.

This work is limited to the public landing experience and closely related brand-facing copy on that surface.

## Goal

Redesign the main landing narrative so the homepage communicates that `MC Presupuestos` is a modern technical platform for construction budgets, not just another budgeting tool.

The page should make three things clear within the first scroll:

- Old fragmented budgeting workflows create avoidable friction and rework.
- MC Presupuestos replaces that fragmentation with one connected operational flow.
- Khipu IA is a real technical accelerator for review and decision-making, not a decorative chatbot.

## Non-Goals

- No dashboard redesign.
- No change to budget, APU, formula, scheduling, or export business logic.
- No change to Khipu backend behavior, providers, prompts, or API contracts.
- No competitor-by-name comparisons.
- No new dependencies.
- No architecture rewrite outside landing composition and supporting marketing copy.

## Approved Positioning

### Product Position

`MC Presupuestos` should be presented as the modern operating layer for technical budgeting work in construction.

It should feel:

- Technical
- Precise
- Operational
- Modern
- Confident

It should not feel like:

- A generic ERP
- A legacy desktop replacement with a nicer skin
- A marketing-heavy AI landing
- A broad "all-in-one" claim without proof

### Messaging Hierarchy

The homepage should communicate value in this order:

1. The old way of budgeting is too fragmented.
2. MC Presupuestos connects the real technical workflow.
3. Khipu IA helps review, detect, and accelerate decisions within that workflow.
4. The interface is modern, readable, and built for daily operation.

### Tone

Approved tone:

- Premium
- Technical
- Slightly challenging
- Clear and direct

Copy should use short, assertive language.

Prefer:

- `conecta`
- `detecta`
- `revisa`
- `controla`
- `prepara`
- `acelera`

Avoid overused SaaS phrasing such as:

- `optimiza tus procesos`
- `gestiona todo en un solo lugar`
- `solucion integral`
- `potencia tu negocio`

## Information Architecture

The homepage should be reorganized in the following order:

1. `LandingNavbar`
2. `HeroSection`
3. `LegacyPainSection`
4. `DifferentiatorsSection`
5. `KhipuIASection`
6. `ProductPreviewSection`
7. `WorkflowSection`
8. `ComparisonSection`
9. `FinalCTASection`
10. `LandingFooter`

This order supports the approved narrative:

- strong point of view
- market pain
- differentiated platform value
- Khipu proof
- product proof
- end-to-end workflow proof
- implicit comparison
- closing conversion

## Section Intent

### HeroSection

The hero must be rewritten.

Purpose:

- Open with a strong statement that the old way of budgeting construction work no longer holds up.
- Position MC Presupuestos as the modern alternative.
- Introduce Khipu IA as part of the core platform story from the beginning.

Requirements:

- Replace softer "suite" language with a stronger category statement.
- Update visible branding from `MYC Presupuestos` to `MC Presupuestos`.
- Keep the current premium visual quality or improve it.
- Preserve dual-CTA behavior.

The hero should not become AI-first. The platform remains the headline; Khipu is introduced as a built-in advantage.

### LegacyPainSection

This is a new section.

Purpose:

- Make the cost of fragmented workflows visible.

Approved themes:

- files and versions scattered across tools
- manual rework between budget and APU
- slow technical review
- disconnected exports and reporting
- operational friction caused by legacy habits

Requirements:

- Do not mention competitor brands.
- Frame the problem in operational terms, not emotional exaggeration.
- Use a compact section that creates urgency without feeling like a fear-based marketing block.

### DifferentiatorsSection

This section should evolve from the current features grid, but the framing changes.

Purpose:

- Show why MC Presupuestos is operationally superior.

The section should group capabilities by workflow advantage rather than by isolated module.

Approved pillars:

- `Presupuesto conectado`
- `APU con trazabilidad`
- `Formula y cronograma dentro del flujo`
- `Exportables listos para oficina tecnica`

Optional supporting pillar if needed:

- `Base operativa preparada para revision asistida`

Requirements:

- Keep the premium card system already established in the landing.
- Rewrite copy so every card describes a differentiated workflow outcome.
- Avoid generic feature-list language.

### KhipuIASection

This is a new homepage section and the main narrative addition.

Purpose:

- Establish Khipu IA as a meaningful differentiator inside MC Presupuestos.

Required message:

- Khipu understands the visible budget context.
- It helps review APU, detect inconsistencies, and accelerate technical analysis.
- It supports the engineer or technical office; it does not replace final technical judgment.

Requirements:

- Reuse the visual language from existing Khipu surfaces when helpful.
- Present Khipu as technical, sober, and contextual.
- Avoid futuristic or gimmicky AI language.
- Show product-like proof, not only conceptual copy.

The section should feel more important than a normal feature row and should visually stand out.

### ProductPreviewSection

This section can be reused with targeted content and copy changes.

Purpose:

- Prove that the product experience is modern, readable, and operationally credible.

Requirements:

- Keep the technical table-like experience.
- Align copy to the new positioning.
- Emphasize control, reviewability, and continuity across tasks.

This section should validate that MC is not only promising a better workflow; it already looks built for one.

### WorkflowSection

This section should evolve from `SmartFlowsSection`.

Purpose:

- Show the end-to-end operational sequence in a clean, readable way.

Approved workflow framing:

1. import or build
2. structure and connect
3. review with Khipu
4. prepare deliverables

Requirements:

- Keep the flow compact and scannable.
- Use it to communicate continuity across modules.
- Avoid repeating the same copy as the differentiators section.

### ComparisonSection

This section should be conceptually rewritten.

Purpose:

- Reinforce the superiority narrative without naming competitors.

Recommended framing:

- `Flujo fragmentado` versus `flujo conectado`

The table or comparison surface can still compare old and new ways of operating, but it should no longer explicitly label columns as `Excel` or `software tradicional`.

Requirements:

- Maintain the premium product-table feel.
- Use the comparison to reinforce the new category statement.
- Keep the page legally and commercially safer by avoiding explicit competitor naming.

### FinalCTASection

The final CTA should be updated to close on the combined platform-plus-intelligence message.

Required closing idea:

- MC Presupuestos is the platform.
- Khipu IA is the intelligence layer.
- Together they modernize how a technical office prepares and reviews budgets.

The CTA should feel high-confidence, not promotional or noisy.

## Branding Update

The public landing should use `MC Presupuestos` instead of `MYC Presupuestos`.

This branding update applies to:

- metadata on the landing page
- navbar and footer branding on the landing
- hero and section copy directly tied to homepage messaging
- comparison and CTA copy

This design does not require a full repository-wide rename. It is specifically a public landing repositioning pass unless adjacent landing-visible branding must be updated for consistency.

## Reuse Strategy

Do not rebuild the landing from scratch.

Reuse:

- `LandingNavbar`
- `LandingFooter`
- `LandingLinkButton`
- `SectionHeading`
- shared landing spacing and surface primitives
- parts of `ProductPreviewSection`
- relevant visual patterns from Khipu landing components where appropriate

Rewrite or heavily evolve:

- `HeroSection`
- `FeaturesSection` into a differentiators section
- `ComparisonSection`
- `SmartFlowsSection`
- `FinalCTASection`
- homepage metadata and section order in `app/page.tsx`

Create:

- `LegacyPainSection`
- `KhipuIASection`

## Implementation Boundaries

Expected implementation scope:

- `app/page.tsx`
- `components/landing/hero-section.tsx`
- `components/landing/features-section.tsx` or a renamed equivalent if that improves clarity
- `components/landing/comparison-section.tsx`
- `components/landing/smart-flows-section.tsx`
- `components/landing/final-cta-section.tsx`
- `components/landing/landing-navbar.tsx`
- `components/landing/landing-footer.tsx`
- `components/landing/landing-content.ts` if content remains centralized there
- new files for:
  - `components/landing/legacy-pain-section.tsx`
  - `components/landing/khipu-ia-section.tsx`

Potential support changes:

- `app/page.test.tsx`
- landing component tests affected by changed order and copy

Avoid touching:

- dashboard pages
- budget editor logic
- AI backend routes
- financial calculation code
- non-landing application architecture

## Copy Rules

Homepage copy must:

- sound like a product for technical offices and engineers
- make operational claims that can be defended by the current product
- avoid inflated growth-marketing language
- avoid suggesting that Khipu autonomously approves or edits budgets without user review

The page may challenge the legacy workflow, but it must not become insulting, sarcastic, or vague.

## Testing

Update or add focused tests to verify:

- homepage renders updated branding as `MC Presupuestos`
- new sections render in the intended order
- Khipu IA messaging is present on the homepage
- existing shared landing layout primitives are preserved where relevant
- changed comparison language no longer references named competitor categories if removed

Run at minimum:

```bash
npm run test -- app/page.test.tsx
npm run lint
```

Additional landing component tests should be updated if current assertions depend on old copy or old section order.

## Success Criteria

This redesign is successful when:

- the homepage clearly feels like a repositioned product, not just copy-refresh of the previous landing
- MC Presupuestos is perceived as a connected technical platform
- Khipu IA feels like a real built-in differentiator
- the message contrasts with fragmented legacy workflows without naming competitors
- the landing keeps its premium B2B SaaS quality while gaining more conviction
- the implementation remains contained to the landing surface and supporting tests
