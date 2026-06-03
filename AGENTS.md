<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Project Rules

- Use TypeScript strict mode
- Never use any
- Financial calculations must use decimal-safe math
- Polynomial coefficient calculations use 3 decimals
- Keep calculation logic isolated from UI
- All formulas must be testable
- Prefer reusable services
- Use clean architecture

## Commands

- npm run dev
- npm run test
- npm run lint


# MYC Presupuestos — Project Agent Rules

## Project Overview

MYC Presupuestos is a modern SaaS web application for construction cost estimation and budgeting.

The platform helps engineers, contractors, technical offices, and construction companies manage:

- Budgets
- APU (Unit Price Analysis)
- Material catalogs
- Formula polinómica
- Quantity takeoffs
- Project scheduling
- Reports
- Cost control

The product should feel like:
- Linear
- Stripe
- Notion
- Retool
- Modern B2B SaaS

NOT like:
- Legacy ERP software
- Old engineering systems
- Cluttered enterprise software

---

# Core Stack

Use:
- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui when available
- lucide-react when available

Avoid:
- Unnecessary dependencies
- Large UI libraries
- jQuery
- Inline styles
- CSS modules unless necessary

---

# Design Philosophy

The UI must feel:
- Fast
- Clean
- Technical
- Professional
- Minimal
- Spacious
- Modern

The app is for engineers and construction professionals, but should feel modern and intuitive.

Prioritize:
- clarity
- spacing
- readability
- usability
- hierarchy

---

# Branding

## Product Name

MYC Presupuestos

## Tagline

“Plataforma moderna de costos y presupuestos de obra.”

---

# Color System

## Primary

Primary Navy:
#0F172A

Primary Blue:
#2563EB

Electric Blue:
#1D4ED8

Light Blue:
#EFF6FF

Background:
#F8FAFC

Muted Text:
#64748B

Border:
#E2E8F0

White:
#FFFFFF

Success:
#10B981

Warning:
#F59E0B

Danger:
#EF4444

---

# UI Style

## Cards

- Rounded 2xl
- Soft shadows
- Thin borders
- Spacious padding
- White backgrounds

## Buttons

Primary:
- Blue background
- White text
- Rounded xl

Secondary:
- White background
- Light border
- Blue text

Ghost:
- Transparent background

## Tables

- Clean modern SaaS tables
- Excel-inspired compact mode
- Soft borders
- Sticky headers when needed
- High readability
- Los popups que muestran el detalle APU de una subpartida deben heredar el lenguaje visual y estilos de la partida/APU padre: mismas columnas, densidad, altura de fila, bordes configurados, decimales configurados y encabezado con rendimiento, costo unitario y unidad.

---

# Typography

Preferred:
- Inter
- Plus Jakarta Sans
- System font fallback

Rules:
- Large headlines
- Tight hierarchy
- Clean spacing
- Avoid excessive font sizes

---

# Layout Rules

Always:
- Use responsive layouts
- Mobile-first
- Use grid systems
- Use max-width containers
- Add generous whitespace

Avoid:
- cramped layouts
- visual clutter
- oversized shadows
- unnecessary gradients

---

# Component Rules

Create reusable components.

Use:
- components/ui
- components/dashboard
- components/landing

Avoid giant page.tsx files.

---

# App Structure

Use this structure:

app/
components/
components/ui/
components/dashboard/
components/landing/
lib/
hooks/
types/
styles/

---

# Code Quality Rules

Always:
- Use TypeScript properly
- Use reusable patterns
- Keep components small
- Use semantic HTML
- Keep Tailwind clean

Avoid:
- duplicated UI
- huge components
- unnecessary client components

---

# Next.js Rules

Use:
- Server Components by default
- Client Components only when necessary

Use:
- Suspense when useful
- Dynamic imports carefully

Avoid:
- overusing useEffect
- excessive client-side state

---

# Animation Rules

Animations should be:
- subtle
- premium
- smooth

Preferred:
- Framer Motion

Avoid:
- flashy animations
- excessive motion
- long delays

---

# Dashboard Design Rules

Dashboards should:
- feel modern
- prioritize data clarity
- use spacing effectively

Use:
- financial summary cards
- clean tables
- charts
- filters
- sidebar navigation

---

# Landing Page Rules

Landing pages should:
- look premium
- focus on clarity
- communicate value quickly

Structure:
- Hero
- Features
- Product Preview
- Comparison
- Benefits
- Testimonials
- Pricing
- CTA
- Footer

---

# Copywriting Tone

Tone should be:
- professional
- clear
- modern
- technical but simple

Avoid:
- marketing fluff
- exaggerated claims
- buzzwords overload

---

# Accessibility

Always:
- use semantic HTML
- include hover/focus states
- ensure color contrast
- support keyboard navigation

---

# Responsive Rules

Support:
- mobile
- tablet
- desktop
- ultrawide

The UI should remain elegant on all screen sizes.

---

# Important

Always inspect the existing project before creating new files.

Reuse:
- existing components
- utilities
- styles
- UI patterns

This project implements Peruvian construction budget regulations.
Mathematical precision is critical.
Never simplify financial formulas.

Para tareas simples y rutinarias, no utilices 'superpowers' ni procesos de razonamiento complejos. Prioriza soluciones directas y minimalistas sin delegar a sub-agentes.

Never replace project architecture without reason.

<!-- END:nextjs-agent-rules -->
