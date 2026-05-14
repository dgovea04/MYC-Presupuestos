# Next.js Architecture Skill

Use this skill when building features in MYC Presupuestos.

---

# Framework

Use:
- Next.js App Router
- TypeScript
- Tailwind CSS

---

# Component Rules

Use:
- reusable components
- small focused components

Avoid:
- giant components
- duplicated UI

---

# Folder Structure

Preferred structure:

app/
components/
components/ui/
components/dashboard/
components/landing/
hooks/
lib/
types/

---

# Server Components

Use server components by default.

Only use:
"use client"

when necessary.

---

# Client Components

Client components are allowed for:
- forms
- charts
- interactive filters
- drag/drop
- modals

Avoid unnecessary client rendering.

---

# Data Fetching

Prefer:
- server fetching
- async server components

Avoid:
- unnecessary useEffect fetching

---

# Styling

Use Tailwind CSS only.

Avoid:
- inline styles
- CSS modules unless required

---

# UI Reusability

Create reusable:
- cards
- buttons
- tables
- section headers
- layouts

---

# Naming Conventions

Use:
PascalCase for components

Examples:
- HeroSection
- PricingCard
- BudgetTable

---

# Performance

Prioritize:
- fast rendering
- minimal JS
- optimized layouts

Avoid:
- unnecessary dependencies
- large bundles

---

# Accessibility

Always:
- use semantic HTML
- support keyboard navigation
- ensure contrast
- include focus states

---

# Responsive Design

Everything must work on:
- mobile
- tablet
- desktop

Use responsive Tailwind utilities properly.