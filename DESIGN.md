# MC Presupuestos — Design System

## 1. Product Identity

**Product name:** MC Presupuestos  
**Tagline:** Plataforma moderna de costos y presupuestos de obra.

MC Presupuestos is a modern SaaS platform for construction budgeting, APU, cost control, formula polinómica, material catalogs, project scheduling, and professional reports.

The product should feel modern, technical, reliable, and efficient.

---

## 2. Brand Personality

The visual and written identity should communicate:

- Precision
- Engineering clarity
- Trust
- Modern productivity
- Professional construction workflows
- Simplicity over complexity

Avoid looking like:

- Legacy ERP software
- Old construction software
- Generic startup templates
- Overly industrial or dark construction branding

Preferred inspiration:

- Linear
- Stripe
- Vercel
- Retool
- Notion
- Modern B2B SaaS dashboards

---

## 3. Audience

Primary users:

- Civil engineers
- Contractors
- Technical offices
- Construction companies
- Project managers
- Estimators
- Construction students

The interface should be professional enough for engineers but simple enough for new users.

---

## 4. Color Palette

### Primary Colors

| Name | Hex | Usage |
|---|---:|---|
| Primary Navy | `#0F172A` | Main text, headings, dark surfaces |
| Primary Blue | `#2563EB` | Primary actions, highlights |
| Electric Blue | `#1D4ED8` | Gradients, active states |
| Light Blue | `#EFF6FF` | Hero backgrounds, badges |
| Background | `#F8FAFC` | Main page background |
| White | `#FFFFFF` | Cards and panels |

### Supporting Colorsestra dos valor

| Name | Hex | Usage |
|---|---:|---|
| Muted Text | `#64748B` | Secondary text |
| Border | `#E2E8F0` | Borders, table lines |
| Success Green | `#10B981` | Checks, completed states |
| Warning Amber | `#F59E0B` | Partial states, warnings |
| Danger Red | `#EF4444` | Errors, negative states |

### Dark Theme Foundation

Use this palette as the base for Khipu floating dark mode and for the future full-app dark theme.

| Name | Hex | Usage |
|---|---:|---|
| Canvas | `#0F0F0F` | Main dark page floor |
| Canvas Deep | `#000000` | Code blocks, dense terminal zones |
| Surface Card | `#181818` | Default dark cards and panels |
| Surface Card Elevated | `#222222` | Inputs, pills, secondary containers |
| Surface Strong | `#2A2A2A` | Dropdowns, stronger states, overlays |
| Hairline | `#222222` | Default dividers |
| Hairline Soft | `#1A1A1A` | Soft separators |
| Hairline Strong | `#333333` | Strong borders and outlines |
| Ink | `#FFFFFF` | Headlines and high-emphasis text |
| Body | `#A8A8A8` | Default running text |
| Body Strong | `#FFFFFF` | Primary content text |
| Muted | `#888888` | Labels and secondary metadata |
| Muted Soft | `#666666` | Disabled states and placeholders |
| On Primary | `#FFFFFF` | Text on primary blue actions |

---

## 5. Gradients

### Primary CTA Gradient

```css
background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
```

### Hero Background

```css
background: linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%);
```

### Footer Background

```css
background: linear-gradient(135deg, #020617 0%, #0F172A 100%);
```

### Dark Theme Rule

For dark UI surfaces, avoid decorative gradients by default.

Use:

- Flat fills with contrast steps between `Canvas`, `Surface Card`, `Surface Card Elevated`, and `Surface Strong`
- Depth through spacing, border contrast, and shadow restraint
- Blue only as an action or focus accent

Avoid:

- White-to-blue panel gradients inside the dark theme
- Cyan/purple decorative fills inside forms, pills, cards, and chat surfaces
- Mixing light landing gradients with dark product UI

Exception:

- A focused marketing hero or spotlight area may use a controlled glow, but product UI surfaces should stay flat.

---

## 6. Typography

Preferred fonts:

- Inter
- Plus Jakarta Sans
- System font fallback

### Font Usage

| Elemento | Font |
|---|---|
| Hero headline | Plus Jakarta Sans |
| Section titles | Plus Jakarta Sans |
| Pricing titles | Plus Jakarta Sans |
| Navbar logo | Plus Jakarta Sans |
| Body text | Inter |
| Buttons | Inter |
| Tables | Inter |
| Dashboard UI | Inter |
| Forms | Inter |
| Sidebar | Inter |
| Financial data | Inter |

### Type Scale

| Element | Desktop | Mobile | Weight |
|---|---:|---:|---:|
| Hero Heading | 56–72px | 40–48px | 700–800 |
| Section Heading | 40–48px | 32–36px | 700 |
| Card Heading | 18–22px | 18–20px | 600–700 |
| Body Text | 16–18px | 16px | 400 |
| Small Text | 13–14px | 13–14px | 400–500 |
| Badge Text | 11–12px | 11–12px | 600–700 uppercase |

Rules:

- Use strong hierarchy.
- Keep line-height comfortable.
- Avoid excessive font sizes in dashboards.
- Use muted color for secondary text.
- In dark mode, keep the same font system but increase perceived hierarchy through contrast, not larger sizes.
- Prefer `Plus Jakarta Sans` for Khipu headings, widget titles, and premium product moments.
- Keep inputs, pills, tables, and dense technical UI in `Inter` for readability.

---

## 7. Logo Direction

The logo should be simple and scalable.

### Logo Concept

Symbol:

- Three ascending vertical bars
- Represents costs, growth, precision, and progress
- Rounded geometric shape
- Blue gradient

Wordmark:

```txt
MC
Presupuestos
```

Logo rules:

- Do not use external images.
- Build with CSS/SVG if needed.
- Keep it minimal.
- Must work in navbar, footer, sidebar, and favicon-style usage.

---

## 8. UI Principles

Every UI decision should follow these principles:

1. **Clarity first**  
   Users should quickly understand project costs, totals, and actions.

2. **Modern but technical**  
   The app should feel polished without hiding engineering detail.

3. **Excel familiarity, SaaS simplicity**  
   Tables can feel spreadsheet-like but should look cleaner and more modern.

4. **Reduce cognitive load**  
   Use spacing, grouping, and hierarchy to make complex data easier to scan.

5. **Reusable patterns**  
   Buttons, cards, tables, badges, and layouts should be consistent.

6. **Dark mode is a system, not an inversion**  
   Dark UI should be designed with dedicated surfaces, borders, and text roles. Do not simply swap white for black.

---

## 8.1 Dark Mode Implementation Rules

These rules are mandatory for all new internal product views, sheets, dialogs, popups, tables, editors, and side panels.

### Theme activation

- Dark mode is driven by `data-theme="dark"`.
- Portaled UI must inherit the theme from both `document.documentElement` and `document.body`.
- Do not rely on raw `@media (prefers-color-scheme: dark)` for product view styling.

### Semantic surface classes

Prefer semantic classes from `app/globals.css` instead of raw Tailwind light tokens:

- `theme-surface-card`: default card, sheet, modal, panel
- `theme-surface-card-gradient`: light header/card gradient with safe dark fallback
- `theme-surface-card-warm`: warm informational card with safe dark fallback
- `theme-muted-panel`: secondary panel, grouped controls, table header wrapper
- `theme-muted-panel-strong`: emphasized neutral panel
- `theme-surface-panel`: standard neutral surface
- `theme-dashed-panel`: empty state or placeholder container

Avoid in product UI:

- `bg-white`
- `bg-slate-50`
- `bg-slate-100`
- `border-slate-200`
- `border-slate-300`
- `text-slate-900`
- `text-slate-800`
- `text-slate-700`
- `text-slate-600`
- `text-slate-500`

### Semantic text classes

Use:

- `theme-strong-text`: primary content and headings
- `theme-muted-text`: secondary copy and support text
- `theme-subtle-text`: tertiary metadata, placeholders, quiet labels

Do not hardcode light-mode text colors for app content inside dialogs, sheets, tables, or badges.

### Status and informational states

Use semantic state classes for banners, notices, badges, and alerts:

- `theme-status-info`
- `theme-status-info-strong`
- `theme-status-success`
- `theme-status-success-strong`
- `theme-status-warning`
- `theme-status-warning-strong`
- `theme-status-error`
- `theme-badge-slate`

Light mode keeps the original light palette.
Dark mode automatically moves those states to higher-contrast translucent surfaces with readable text.

### Buttons, active pills, and badges

Use:

- `theme-filter-button-active`
- `theme-filter-button-inactive`
- `theme-filter-button-active-count`
- `theme-filter-button-inactive-count`
- `theme-quick-action-primary`
- `theme-quick-action-primary-icon`

Rules:

- Active tabs, active pills, and selected badges must never stay white in dark mode.
- Informational badges inside tables and editors must avoid raw `bg-white`.
- Outline buttons inside dialogs and popups should sit on `var(--app-surface)` and use visible borders in dark mode.

### Tables and Excel-inspired grids

Dark-mode table borders must use the global token system:

- `--table-border-soft: #1a1a1a`
- `--table-border-strong: #333333`
- `--excel-border-soft: var(--table-border-soft)`
- `--excel-border-strong: var(--table-border-strong)`

Rules:

- Strong visible cell borders should use `border: 1px solid var(--excel-border-strong)`.
- Soft separators can use `var(--table-border-soft)`.
- Do not reintroduce `#1a1a1a` where the table needs primary visible grid contrast.
- Excel-mode sheets and popups must preserve density, row height, decimal behavior, and border visibility.

### Dialogs, sheets, popovers, and off-canvas editors

All overlays and floating UI must be dark-safe:

- sheets
- Radix dialogs
- menus
- listboxes
- command popups
- off-canvas APU editor
- catalog insertion popups

Rules:

- Base container should use `theme-surface-card` or `theme-muted-panel`.
- Inner grouped areas should use `theme-muted-panel`.
- Empty states should use `theme-dashed-panel`.
- Do not leave white backgrounds in popup headers, bodies, or footers.

### Checkboxes and radios

Dark mode form controls use:

- `accent-color: var(--control-accent, var(--app-primary))`
- `background-color: var(--app-surface)`
- `border-color: var(--app-border-strong)`

Rules:

- If a specific screen needs a different accent, define `--control-accent` on the container.
- Do not depend on one-off utility classes that lose by CSS specificity.
- Unchecked controls must not appear with white fill in dark mode.

### Scrollbars

Internal scroll areas must inherit the global dark scrollbar tokens.

Rules:

- Prefer app-level scrollbar styling over per-component one-off scrollbar colors.
- Ensure internal panels, sheets, tables, and popups preserve visible thumb/track contrast in dark mode.

### Implementation checklist for new views

Before closing any new view or feature, verify:

1. No visible `bg-white` remains in dark mode.
2. No active tab, badge, or selected pill stays white in dark mode.
3. No popup or sheet header/footer remains light.
4. Table borders are readable and use the shared border tokens.
5. Checkbox and radio controls have dark-safe unchecked and checked states.
6. Informational amber/emerald/sky banners keep readable contrast in both themes.
7. Internal scroll containers have visible scrollbar contrast.

---

## 9. Layout System

### Containers

Use a max-width container for marketing pages:

```txt
max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
```

### Section Spacing

Recommended landing page spacing:

```txt
py-20 md:py-28
```

Dashboard spacing:

```txt
p-4 md:p-6 lg:p-8
```

### Grid Rules

Use responsive grids:

```txt
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
```

Avoid cramped layouts.

---

## 10. Buttons

### Primary Button

Use for main CTAs.

Visual style:

- Blue background or gradient
- White text
- Rounded-xl
- Soft shadow
- Strong hover state

Suggested Tailwind:

```txt
inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2
```

### Secondary Button

Use for alternative actions.

```txt
inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50
```

### Ghost Button

Use for low-priority navigation.

```txt
inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900
```

### Dark Button Rules

- Primary actions stay blue, but use a flat blue fill instead of blue gradients.
- Secondary actions use `Surface Card Elevated` with `Hairline Strong`.
- Ghost buttons should never disappear into the canvas; keep a visible hover surface.
- Avoid pure white buttons inside dark UI.

---

## 11. Cards

Cards should be:

- White
- Rounded-2xl
- Border `#E2E8F0`
- Soft shadow
- Spacious
- Clean hover state

Suggested Tailwind:

```txt
rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md
```

Use cards for:

- Features
- Pricing
- Testimonials
- Dashboard metrics
- Report previews
- Project summaries

### Dark Card Rules

- Dark cards should use flat backgrounds only.
- Base card: `Surface Card`
- Interactive card or nested block: `Surface Card Elevated`
- Strong utility/menu surfaces: `Surface Strong`
- Borders should be visible but subtle, using `Hairline` or `Hairline Strong`
- Shadows in dark mode should be softer and less spread than in light mode
- Never place white cards inside the dark Khipu experience

---

## 12. Badges

Badges should communicate category or status.

Marketing badge:

```txt
inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700
```

Status badges:

- Success: green
- Warning: amber
- Error: red
- Neutral: slate

### Dark Badge Rules

- In dark mode, pills and badges should use `Surface Card Elevated`
- Default text should be `Body Strong` or `Muted`, depending on importance
- Keep uppercase helper badges compact and restrained
- Reserve bright fills for status signaling only, not decorative emphasis

---

## 13. Tables

Tables are core to MC Presupuestos.

They should feel like a modern Excel-inspired interface.

### Table Rules

- Compact but readable
- Soft borders
- Sticky headers when useful
- Clear hover state
- Numeric values aligned right
- Text values aligned left
- Headers with light background
- Support dense financial data

Suggested header style:

```txt
bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500
```

Suggested cell style:

```txt
border-b border-slate-200 px-3 py-2 text-sm text-slate-700
```

Suggested numeric style:

```txt
text-right tabular-nums
```

### Table Columns Example

Budget table:

- Código
- Descripción
- Unidad
- Metrado
- Precio Unit.
- Parcial

APU table:

- Recurso
- Unidad
- Cuadrilla
- Cantidad
- Precio
- Parcial

### Dark Table Rules

- Background ladder should remain flat: canvas below, panel above, row states above that
- Header rows should use `Surface Card Elevated`
- Dense technical tables must preserve readable separators using `Hairline`
- Numeric content should keep strong contrast without using bright white everywhere
- Hover, selected, and active row states should move one surface step up, not introduce gradients

---

## 13.1. Khipu Floating Dark Theme

The floating Khipu assistant is the reference implementation for product dark mode quality.

### Visual Goals

- Near-black canvas
- No white surfaces
- No surface gradients
- Strong but controlled contrast
- Premium technical feel
- Clear hierarchy between shell, context, messages, pills, and fields

### Surface Hierarchy

| Layer | Token |
|---|---|
| Widget backdrop | `Canvas` |
| Main panel shell | `Surface Card` |
| Nested context block | `Surface Card Elevated` |
| Pills, chips, secondary actions | `Surface Card Elevated` |
| Menus / stronger overlays | `Surface Strong` |
| Code / deep history area | `Canvas Deep` |

### Text Hierarchy

| Element | Color |
|---|---|
| Main titles | `Ink` |
| Main message text | `Body Strong` or `Body` |
| Labels / helper copy | `Muted` |
| Placeholders / disabled | `Muted Soft` |

### Fields and Pills

- Inputs and textareas should sit on `Surface Card`
- Their borders should use `Hairline Strong`
- Placeholder text should use `Muted Soft`
- Quick-action pills should use flat elevated surfaces
- Active pills may use a tinted blue-dark fill, but still without gradients

### Khipu Floating Interaction Rules

- Primary send buttons use flat `Primary Blue`
- Warning panels use dark amber-tinted surfaces, not pale light-mode warning boxes
- Error states should use dark red-tinted surfaces with readable text
- History, messages, and context cards should all stay within the same dark surface ladder

---

## 14. Dashboard UI

Dashboards should prioritize clarity and action.

Common dashboard components:

- Sidebar navigation
- Topbar
- Financial summary cards
- Budget tables
- Project status badges
- Charts
- Filters
- Search
- Export actions

### Dashboard Metric Card

Should include:

- Label
- Main value
- Small supporting text
- Optional trend badge

Example values:

- Costo Directo: `S/ 2,543,652.18`
- Gastos Generales: `S/ 356,114.54`
- Utilidad: `S/ 203,492.17`
- Presupuesto Total: `S/ 3,103,258.89`

---

## 15. Landing Page System

Landing page preferred structure:

1. Navbar
2. Hero Section
3. Features Section
4. Product Preview Section
5. Workflow Section
6. Comparison Section
7. Benefits Section
8. Testimonials Section
9. Pricing Preview
10. Final CTA
11. Footer

---

## 16. Landing Page Copy

### Navbar

Links:

- Características
- Beneficios
- Precios
- Recursos
- Contacto

Buttons:

- Iniciar sesión
- Solicitar acceso

---

### Hero Section

Badge:

```txt
PLATAFORMA DE COSTOS Y PRESUPUESTOS PARA CONSTRUCCIÓN
```

Headline:

```txt
Presupuestos de obra más rápidos, precisos y profesionales.
```

Subheadline:

```txt
MC Presupuestos te ayuda a crear presupuestos, APU, metrados y reportes profesionales para proyectos de construcción, edificación e infraestructura.
```

Primary CTA:

```txt
Solicitar acceso
```

Secondary CTA:

```txt
Ver plataforma
```

Micro-benefits:

- En la nube: Accede desde cualquier lugar
- Seguro: Tus datos siempre protegidos
- Colaborativo: Trabaja en equipo en tiempo real

---

### Features Section

Eyebrow:

```txt
TODO LO QUE NECESITAS
```

Title:

```txt
Herramientas completas para cada etapa de tu proyecto
```

Subtitle:

```txt
Desde el análisis de precios unitarios hasta los reportes finales, organiza todo el flujo técnico de costos en una sola plataforma.
```

Feature cards:

1. **Presupuestos inteligentes**  
   Crea presupuestos estructurados con niveles, partidas, metrados y costos organizados.

2. **Análisis de Precios Unitarios**  
   Gestiona materiales, mano de obra, equipos y rendimientos de forma simple y eficiente.

3. **Catálogo de insumos**  
   Centraliza recursos, precios y unidades para reutilizarlos en nuevos proyectos.

4. **Fórmula polinómica**  
   Calcula reajustes de obra con una estructura preparada para normativa peruana.

5. **Programación de obra**  
   Integra cronogramas, partidas y avance para tener mejor control del proyecto.

6. **Reportes profesionales**  
   Exporta documentos técnicos en formatos listos para revisar, presentar o compartir.

---

### Product Preview Section

Eyebrow:

```txt
EXPERIENCIA MODERNA
```

Title:

```txt
Una plataforma diseñada para ingenieros modernos
```

Text:

```txt
Trabaja con una interfaz rápida, clara y flexible. Cambia entre una vista moderna y una vista compacta tipo Excel para editar presupuestos con mayor velocidad.
```

Bullets:

- Modo tabla tipo Excel
- Filtros y búsqueda avanzada
- Arrastrar y soltar partidas
- Personalización total
- Acceso desde cualquier dispositivo

---

### Comparison Section

Eyebrow:

```txt
MÁS RÁPIDO, MÁS SIMPLE, MÁS POTENTE
```

Title:

```txt
Más que Excel. Mejor que el software tradicional.
```

Comparison columns:

- Excel
- Software tradicional
- MC Presupuestos

Rows:

- Interfaz moderna e intuitiva
- Multiusuario en tiempo real
- APU y metrados integrados
- Fórmula polinómica automática
- Reportes profesionales
- Almacenamiento en la nube
- Seguridad y respaldo

---

### Benefits Section

Title:

```txt
Controla tus costos con más claridad
```

Benefits:

1. **Ahorra horas de trabajo**  
   Reduce tareas repetitivas y evita rehacer presupuestos desde cero.

2. **Evita errores de cálculo**  
   Centraliza fórmulas, precios e información técnica en una plataforma confiable.

3. **Presenta mejor tus propuestas**  
   Genera reportes claros, profesionales y listos para clientes o revisión técnica.

4. **Escala con tu equipo**  
   Organiza proyectos, usuarios y presupuestos en un entorno colaborativo.

---

### Testimonials Section

Eyebrow:

```txt
CONFIANZA QUE CONSTRUYE
```

Title:

```txt
Profesionales que ya imaginan una mejor forma de presupuestar
```

Use fictional testimonials only as examples unless real testimonials exist.

---

### Pricing Section

Title:

```txt
Planes simples para empezar rápido
```

Plans:

#### Starter

For independent professionals.

Features:

- Presupuestos básicos
- Catálogo de insumos
- Exportación PDF
- Soporte inicial

#### Pro

For technical teams.

Features:

- APU avanzado
- Fórmula polinómica
- Reportes profesionales
- Colaboración en equipo

#### Empresa

For construction companies and consultants.

Features:

- Multiempresa
- Roles y permisos
- Soporte prioritario
- Implementación asistida

---

### Final CTA

Title:

```txt
Empieza a construir mejores presupuestos.
```

Text:

```txt
Solicita acceso y descubre una forma moderna de gestionar costos, APU y reportes de obra.
```

Buttons:

- Solicitar acceso
- Ver plataforma

---

## 17. Motion Guidelines

Use motion carefully.

Recommended:

- Fade in sections
- Slight upward movement
- Soft hover effects
- Smooth card transitions

Avoid:

- Excessive animations
- Bouncing effects
- Slow transitions
- Distracting motion

---

## 18. Responsive Design

Must support:

- Mobile
- Tablet
- Desktop
- Large desktop

Mobile rules:

- Stack columns
- Reduce padding
- Keep CTAs easy to tap
- Tables should scroll horizontally
- Avoid tiny text

---

## 19. Accessibility

Always include:

- Semantic HTML
- Keyboard focus states
- Good color contrast
- Descriptive button text
- ARIA labels when needed

Avoid:

- Click-only interactions
- Low contrast text
- Icons without labels when meaning is important

### Dark Theme Accessibility

- Do not rely on color alone to signal state
- Preserve clear border visibility between stacked dark surfaces
- Placeholder text must remain readable against dark fields
- Blue interactive elements must keep accessible contrast on dark backgrounds
- Dense technical widgets should remain legible in low-light conditions and on lower-quality displays

---

## 20. Implementation Notes for Codex

When implementing UI:

- Read `AGENTS.md` first.
- Use all available `.skills` when relevant.
- Reuse existing components before creating new ones.
- Do not add dependencies unless necessary.
- Prefer Tailwind CSS.
- Keep components modular.
- Do not create huge `page.tsx` files.
- Build mockups with code instead of external images.
- Verify TypeScript and responsive behavior.
- When implementing dark mode, use semantic tokens first and component overrides second.
- Extend the Khipu floating dark palette into reusable app-level tokens before rolling out page-by-page dark mode.
- Do not mix legacy light gradients into dark product components.

---

## 20.1. Future Full-App Dark Theme Strategy

The future dark theme for the whole webapp should reuse the same criteria already validated in Khipu floating mode.

### Rollout Principles

1. Define semantic dark tokens first:
   - app background
   - panel background
   - elevated panel background
   - strong surface
   - border soft/default/strong
   - text primary/secondary/muted/disabled

2. Apply dark mode by component family:
   - shell and navigation
   - cards and filters
   - forms and dialogs
   - tables and spreadsheet-like views
   - charts and status surfaces
   - AI and assistant surfaces

3. Preserve product behavior:
   - financial density
   - table readability
   - form clarity
   - technical professionalism

### Global Dark Theme Rules

- No white cards on dark pages
- No light-mode blue gradients reused in dark UI
- Elevation should come from surface steps, not brighter glows
- Tables, APU popups, and spreadsheet-style modules must inherit the same density, borders, and decimal clarity they already use in light mode
- Dialogs, dropdowns, and side panels should use the same dark ladder as Khipu floating
- Blue remains the main action accent; do not introduce new accent families without a product reason

### Preferred App-Level Mapping

| Semantic role | Dark token |
|---|---|
| App background | `Canvas` |
| Main card | `Surface Card` |
| Nested card / field / chip | `Surface Card Elevated` |
| Menu / active elevated region | `Surface Strong` |
| Default border | `Hairline` |
| Strong border | `Hairline Strong` |
| Heading text | `Ink` |
| Body text | `Body` |
| High-emphasis text | `Body Strong` |
| Secondary metadata | `Muted` |
| Disabled text | `Muted Soft` |

---

## 21. Suggested Components

Landing components:

```txt
components/landing/LandingNavbar.tsx
components/landing/HeroSection.tsx
components/landing/FeaturesSection.tsx
components/landing/ProductPreviewSection.tsx
components/landing/ComparisonSection.tsx
components/landing/BenefitsSection.tsx
components/landing/TestimonialsSection.tsx
components/landing/PricingSection.tsx
components/landing/FinalCTASection.tsx
components/landing/LandingFooter.tsx
```

UI components:

```txt
components/ui/button.tsx
components/ui/card.tsx
components/ui/badge.tsx
components/ui/table.tsx
components/ui/section-heading.tsx
components/ui/logo.tsx
```

Dashboard components:

```txt
components/dashboard/AppSidebar.tsx
components/dashboard/DashboardTopbar.tsx
components/dashboard/MetricCard.tsx
components/dashboard/BudgetTable.tsx
components/dashboard/APUTable.tsx
```

---

## 22. Quality Checklist

Before finalizing any UI work, verify:

- The design looks like a modern SaaS product.
- The page is responsive.
- The code compiles.
- TypeScript has no errors.
- Components are reusable.
- Tailwind classes are clean.
- There is no unnecessary dependency.
- Copy feels specific to construction budgeting.
- Tables are readable.
- Buttons and CTAs are clear.
- The landing page does not feel generic.
