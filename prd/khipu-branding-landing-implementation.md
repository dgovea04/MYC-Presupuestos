# Khipu IA — Branding, landing page e implementación UI

Guía de identidad visual y funcional para **Khipu**, el asistente IA de **MC Presupuestos**.

---

## 1. Concepto de marca

**Khipu** es el asistente IA de MC Presupuestos. El nombre viene del quechua y hace referencia al sistema ancestral de nudos usado para registrar, organizar y transmitir información.

En el contexto de MC Presupuestos, Khipu representa:

- **Información conectada**: presupuestos, APU, metrados, catálogos e históricos.
- **Organización inteligente**: análisis técnico sin perder estructura.
- **Decisiones más claras**: recomendaciones para revisión humana.
- **Identidad peruana moderna**: inspiración andina con lenguaje SaaS actual.

### Posicionamiento

> Khipu conecta tus datos, entiende tus presupuestos y te ayuda a construir mejores decisiones.

### Personalidad

Khipu debe sentirse:

- Técnico, pero fácil de entender.
- Moderno, pero con raíz cultural.
- Confiable, no mágico.
- Asistente, no reemplazo del especialista.
- Claro, breve y accionable.

---

## 2. Dirección visual

La propuesta visual debe mantenerse **minimalista, plana y limpia**, evitando estilo 3D, sombras pesadas o mascota demasiado infantil.

### Estilo recomendado

- Símbolo principal basado en un **nudo / lazo / conexión**.
- Líneas redondeadas y geométricas.
- Colores vivos controlados sobre base azul oscuro.
- Inspiración andina sutil, no decorativa en exceso.
- UI SaaS moderna compatible con MC Presupuestos.

### Referencias visuales

- Linear / Stripe / Retool para jerarquía visual.
- Notion / Vercel para limpieza y estructura.
- Iconografía simple tipo Lucide / Phosphor.
- Detalles andinos reducidos a nodos, líneas y conexiones.

---

## 3. Logo y símbolo

### Logo principal

**Composición recomendada:**

```txt
[ símbolo Khipu ]  Khipu
                  Asistente IA de MC Presupuestos
```

### Símbolo principal

El símbolo debe representar un khipu moderno: un lazo principal que conecta nodos inferiores.

#### SVG base — símbolo Khipu minimalista

Este SVG puede usarse como base para el favicon, botón flotante, avatar del chat y navegación lateral.

```svg
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M36 42C36 29.85 45.85 20 58 20C70.15 20 80 29.85 80 42C80 54.15 70.15 64 58 64H44C30.75 64 20 74.75 20 88C20 101.25 30.75 112 44 112C57.25 112 68 101.25 68 88V64" stroke="url(#khipuGradient)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M68 64H84C97.25 64 108 74.75 108 88C108 101.25 97.25 112 84 112C70.75 112 60 101.25 60 88V78" stroke="url(#khipuGradient)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M40 112V120" stroke="#2563EB" stroke-width="6" stroke-linecap="round"/>
  <path d="M56 112V120" stroke="#06CFE3" stroke-width="6" stroke-linecap="round"/>
  <path d="M72 112V120" stroke="#7C3AED" stroke-width="6" stroke-linecap="round"/>
  <path d="M88 112V120" stroke="#FF8A00" stroke-width="6" stroke-linecap="round"/>
  <circle cx="40" cy="122" r="4" fill="#2563EB"/>
  <circle cx="56" cy="122" r="4" fill="#06CFE3"/>
  <circle cx="72" cy="122" r="4" fill="#7C3AED"/>
  <circle cx="88" cy="122" r="4" fill="#FF8A00"/>
  <defs>
    <linearGradient id="khipuGradient" x1="20" y1="20" x2="108" y2="112" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2563EB"/>
      <stop offset="0.5" stop-color="#06CFE3"/>
      <stop offset="1" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
</svg>
```

---

## 4. Variaciones de icono

### 4.1 Icono principal

Uso:

- Header del módulo IA.
- Sidebar de MC Presupuestos.
- Landing page de Khipu.
- Empty states.

Visual:

- Símbolo Khipu en gradiente azul/cyan/morado.
- Nodos inferiores en azul, cyan, morado y naranja.
- Fondo blanco o transparente.

### 4.2 Icono sobre fondo oscuro

Uso:

- Botón flotante.
- App icon interno.
- Sidebar activa.
- Chat minimizado.

```svg
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="32" fill="#0D134D"/>
  <path d="M36 38C36 28.06 44.06 20 54 20C63.94 20 72 28.06 72 38C72 47.94 63.94 56 54 56H44C30.75 56 20 66.75 20 80C20 93.25 30.75 104 44 104C57.25 104 68 93.25 68 80V56" stroke="url(#g)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M68 56H84C97.25 56 108 66.75 108 80C108 93.25 97.25 104 84 104C70.75 104 60 93.25 60 80V72" stroke="url(#g)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M42 104V114" stroke="#2563EB" stroke-width="5" stroke-linecap="round"/>
  <path d="M58 104V114" stroke="#06CFE3" stroke-width="5" stroke-linecap="round"/>
  <path d="M74 104V114" stroke="#7C3AED" stroke-width="5" stroke-linecap="round"/>
  <path d="M90 104V114" stroke="#FF8A00" stroke-width="5" stroke-linecap="round"/>
  <circle cx="42" cy="117" r="4" fill="#2563EB"/>
  <circle cx="58" cy="117" r="4" fill="#06CFE3"/>
  <circle cx="74" cy="117" r="4" fill="#7C3AED"/>
  <circle cx="90" cy="117" r="4" fill="#FF8A00"/>
  <defs>
    <linearGradient id="g" x1="20" y1="20" x2="108" y2="104" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2563EB"/>
      <stop offset="0.52" stop-color="#06CFE3"/>
      <stop offset="1" stop-color="#7C3AED"/>
    </linearGradient>
  </defs>
</svg>
```

### 4.3 Icono monocromático

Uso:

- Estados desactivados.
- Documentación.
- Menús secundarios.
- Impresión o reportes.

Color recomendado: `#0D134D` sobre fondo blanco.

---

## 5. Paleta de colores

### Colores principales

| Token | Color | Uso |
|---|---:|---|
| `khipu.navy` | `#0D134D` | Texto principal, fondos oscuros, sidebar |
| `khipu.blue` | `#2563EB` | Acción principal, links, CTA |
| `khipu.cyan` | `#06CFE3` | IA, acentos, estados activos |
| `khipu.purple` | `#7C3AED` | Gradientes, highlights secundarios |
| `khipu.orange` | `#FF8A00` | Alertas suaves, sugerencias, optimización |

### Colores secundarios

| Token | Color | Uso |
|---|---:|---|
| `khipu.bg` | `#F8FAFC` | Fondo general |
| `khipu.surface` | `#FFFFFF` | Cards, panels, chat |
| `khipu.border` | `#E5E7EB` | Bordes suaves |
| `khipu.text` | `#111827` | Texto principal |
| `khipu.muted` | `#64748B` | Texto secundario |
| `khipu.softBlue` | `#EFF6FF` | Fondos de badges y chips |
| `khipu.softCyan` | `#ECFEFF` | Fondos IA |
| `khipu.softPurple` | `#F5F3FF` | Bloques destacados |
| `khipu.softOrange` | `#FFF7ED` | Sugerencias o advertencias suaves |

### Gradiente principal

```css
background: linear-gradient(135deg, #2563EB 0%, #06CFE3 48%, #7C3AED 100%);
```

### Gradiente oscuro

```css
background: radial-gradient(circle at top left, rgba(6, 207, 227, 0.18), transparent 32%), #0D134D;
```

---

## 6. Tipografía

### Opción recomendada

Usar la misma línea moderna SaaS de MC Presupuestos:

- **Headings:** Plus Jakarta Sans
- **Body/UI:** Inter

### Jerarquía

| Elemento | Fuente | Peso | Tamaño recomendado |
|---|---|---:|---:|
| H1 landing | Plus Jakarta Sans | 700 / 800 | 56–72px |
| H2 secciones | Plus Jakarta Sans | 700 | 36–48px |
| H3 cards | Plus Jakarta Sans | 600 / 700 | 20–24px |
| Body | Inter | 400 / 500 | 16–18px |
| UI labels | Inter | 500 / 600 | 12–14px |
| Chat messages | Inter | 400 / 500 | 14–16px |

### CSS recomendado

```css
:root {
  --font-heading: "Plus Jakarta Sans", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
}

h1, h2, h3, .font-heading {
  font-family: var(--font-heading);
}

body, button, input, textarea {
  font-family: var(--font-body);
}
```

---

## 7. Copy principal de Khipu

### Tagline corto

> Tu asistente IA para presupuestos de construcción.

### Tagline conceptual

> Inteligencia que organiza, conecta y optimiza tus presupuestos.

### Frase de marca

> Khipu conecta datos, entiende tus proyectos y te ayuda a construir mejores decisiones.

### Elevator pitch

Khipu es el asistente IA de MC Presupuestos. Analiza presupuestos, APU, metrados y catálogos para ayudarte a encontrar inconsistencias, comparar alternativas y generar recomendaciones técnicas listas para revisión humana.

---

## 8. Landing page de Khipu

Ruta recomendada:

```txt
/app/khipu/page.tsx
```

Componentes recomendados:

```txt
/components/khipu-landing/
  KhipuHero.tsx
  KhipuSymbol.tsx
  KhipuFeatureGrid.tsx
  KhipuWorkflow.tsx
  KhipuUseCases.tsx
  KhipuChatPreview.tsx
  KhipuTrustSection.tsx
  KhipuCTA.tsx
```

---

## 9. Estructura de landing page

### 9.1 Hero section

#### Headline

> Khipu, la IA que entiende tus presupuestos de construcción

#### Subheadline

> Analiza APU, metrados, costos y catálogos dentro de MC Presupuestos para ayudarte a detectar inconsistencias, comparar alternativas y tomar mejores decisiones técnicas.

#### CTAs

- **Probar Khipu IA**
- **Ver cómo funciona**

#### Microcopy

> Siempre con revisión humana. Khipu recomienda, tú decides.

---

### 9.2 Feature grid

#### Card 1 — Analiza presupuestos

> Revisa partidas, costos parciales, unidades y estructuras para identificar puntos que requieren atención.

#### Card 2 — Revisa APU

> Evalúa insumos, rendimientos, cuadrillas y coherencia técnica de cada análisis de precio unitario.

#### Card 3 — Compara alternativas

> Ayuda a comparar soluciones, partidas similares o escenarios de costo sin modificar el presupuesto automáticamente.

#### Card 4 — Sugiere mejoras

> Propone recomendaciones claras para optimizar costos, revisar cantidades o mejorar la trazabilidad.

#### Card 5 — Usa contexto del proyecto

> Responde con base en el presupuesto activo, la partida seleccionada y los catálogos disponibles.

#### Card 6 — Genera reportes técnicos

> Resume observaciones, riesgos y acciones sugeridas para revisión del equipo técnico.

---

### 9.3 Sección “Cómo trabaja Khipu”

#### Paso 1 — Conecta el contexto

Khipu entiende el módulo activo: presupuesto, APU, metrados, catálogos o reportes.

#### Paso 2 — Analiza la información

Revisa estructuras, cantidades, unidades, costos, insumos y posibles inconsistencias.

#### Paso 3 — Entrega recomendaciones

Devuelve respuestas claras, accionables y preparadas para revisión humana.

---

### 9.4 Casos de uso

| Caso | Prompt ejemplo |
|---|---|
| Revisión de presupuesto | “Revisa este presupuesto y dime qué partidas requieren atención.” |
| Análisis de APU | “Genera recomendaciones para revisar este APU.” |
| Control de metrados | “Identifica posibles inconsistencias en cantidades y unidades.” |
| Optimización de costos | “Sugiere alternativas para reducir costos sin afectar el alcance.” |
| Reporte técnico | “Resume las observaciones principales para el equipo de obra.” |

---

### 9.5 Trust section

#### Título

> IA diseñada para presupuestos, no para respuestas genéricas

#### Copy

Khipu está pensado para trabajar dentro del flujo real de MC Presupuestos: proyectos, partidas, APU, insumos, metrados y reportes. Sus respuestas deben ser técnicas, trazables y siempre sujetas a revisión humana.

#### Principios

- No modifica presupuestos automáticamente.
- No inventa precios exactos.
- Declara supuestos cuando falta información.
- Recomienda acciones para revisión humana.
- Mantiene lenguaje técnico claro.

---

## 10. Implementación dentro de MC Presupuestos

### 10.1 Sidebar

Agregar acceso a Khipu en la navegación principal.

```txt
Icono: KhipuSymbol
Label: Khipu
Badge: IA
Estado activo: fondo azul oscuro + borde cyan suave
```

### 10.2 Botón flotante

Ubicación recomendada:

```txt
bottom: 24px;
right: 24px;
```

Comportamiento:

- Estado cerrado: icono circular de Khipu.
- Estado abierto: panel de chat.
- Mostrar badge “IA” o punto cyan si hay sugerencias disponibles.

### 10.3 Header del chat

```txt
[Icono Khipu] Khipu IA
             Tu asistente en MC Presupuestos
```

Acciones:

- Minimizar
- Expandir
- Cerrar
- Ver historial

### 10.4 Mensaje inicial

> ¡Hola! Soy Khipu. Puedo ayudarte a analizar presupuestos, revisar APU, comparar alternativas y generar recomendaciones técnicas. ¿Qué quieres revisar hoy?

### 10.5 Acciones rápidas

- Analizar presupuesto
- Revisar APU
- Comparar alternativas
- Optimizar costos
- Generar reporte
- Detectar inconsistencias

---

## 11. Componentes UI recomendados

### 11.1 Khipu badge

```tsx
<span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-slate-900">
  <KhipuSymbol className="h-4 w-4" />
  Khipu IA
</span>
```

### 11.2 Quick action card

```tsx
<button className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-cyan-300 hover:shadow-md">
  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
    <Icon className="h-5 w-5" />
  </div>
  <p className="font-semibold text-slate-950">Analizar presupuesto</p>
  <p className="mt-1 text-sm text-slate-500">Detecta partidas que requieren revisión.</p>
</button>
```

### 11.3 Chat panel

```tsx
<div className="rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
  <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
    <div className="flex items-center gap-3">
      <KhipuSymbol className="h-9 w-9" />
      <div>
        <p className="font-semibold text-slate-950">Khipu IA</p>
        <p className="text-xs text-slate-500">Tu asistente en MC Presupuestos</p>
      </div>
    </div>
  </header>
</div>
```

---

## 12. Tokens Tailwind recomendados

Agregar al tema si el proyecto usa Tailwind:

```ts
colors: {
  khipu: {
    navy: "#0D134D",
    blue: "#2563EB",
    cyan: "#06CFE3",
    purple: "#7C3AED",
    orange: "#FF8A00",
    bg: "#F8FAFC",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    text: "#111827",
    muted: "#64748B",
  },
}
```

---

## 13. Prompts internos sugeridos para UX

### Empty state

> Selecciona un presupuesto, partida o APU para que Khipu pueda analizarlo con contexto.

### Sin suficiente información

> Necesito más información para darte una recomendación confiable. Puedes seleccionar una partida, abrir un APU o incluir metrados y costos relacionados.

### Revisión humana

> Esta recomendación requiere revisión técnica antes de aplicarse al presupuesto.

### Advertencia de precios

> No se generaron precios exactos porque deben validarse con tu catálogo, mercado local o base histórica.

---

## 14. Prompt para Codex — implementar landing + UI Khipu

```txt
Implement the Khipu IA brand system and landing page inside MC Presupuestos.

CONTEXT:
Khipu is the AI assistant inside MC Presupuestos. The name comes from Quechua and represents knots that connect and organize information. Khipu should feel modern, minimal, flat, technical, trustworthy, and subtly inspired by Andean culture.

GOALS:
1. Create a Khipu landing page.
2. Implement the Khipu visual identity inside the existing AI assistant functionality.
3. Add reusable Khipu UI components.
4. Keep the design aligned with MC Presupuestos.

ROUTE:
app/khipu/page.tsx

CREATE:
components/khipu/
- KhipuSymbol.tsx
- KhipuLogo.tsx
- KhipuBadge.tsx
- KhipuChatPanel.tsx
- KhipuQuickActions.tsx
- KhipuFloatingButton.tsx

CREATE LANDING COMPONENTS:
components/khipu-landing/
- KhipuHero.tsx
- KhipuFeatureGrid.tsx
- KhipuWorkflow.tsx
- KhipuUseCases.tsx
- KhipuChatPreview.tsx
- KhipuTrustSection.tsx
- KhipuCTA.tsx

DESIGN:
- Minimal and flat, no 3D.
- Use the Khipu symbol as the core brand element.
- Use rounded lines, knots, connected nodes and subtle gradients.
- Colors:
  navy #0D134D
  blue #2563EB
  cyan #06CFE3
  purple #7C3AED
  orange #FF8A00
  bg #F8FAFC
  border #E5E7EB
  muted #64748B
- Fonts:
  headings: Plus Jakarta Sans
  body/ui: Inter

COPY:
Hero headline:
Khipu, la IA que entiende tus presupuestos de construcción

Hero subheadline:
Analiza APU, metrados, costos y catálogos dentro de MC Presupuestos para ayudarte a detectar inconsistencias, comparar alternativas y tomar mejores decisiones técnicas.

Primary CTA:
Probar Khipu IA

Secondary CTA:
Ver cómo funciona

Microcopy:
Siempre con revisión humana. Khipu recomienda, tú decides.

FEATURES:
- Analiza presupuestos
- Revisa APU
- Compara alternativas
- Sugiere mejoras
- Usa contexto del proyecto
- Genera reportes técnicos

FUNCTIONAL UI:
- Replace or enhance the current AI assistant icon with KhipuSymbol.
- Add Khipu IA header to the chat panel.
- Add quick action buttons:
  Analizar presupuesto
  Revisar APU
  Comparar alternativas
  Optimizar costos
  Generar reporte
  Detectar inconsistencias
- Add sidebar entry: Khipu with IA badge.
- Add floating assistant button if the app already supports floating chat.

GUARDRAILS IN UI COPY:
- Khipu does not modify budgets automatically.
- Khipu does not invent exact prices.
- Khipu recommendations require human review.

TECHNICAL RULES:
- Inspect existing project first.
- Reuse existing UI primitives where possible.
- Do not add unnecessary dependencies.
- Use TypeScript.
- Keep components small and reusable.
- Keep styling clean with Tailwind.
- Verify build and fix TypeScript issues.
- Explain created and modified files.
```

---

## 15. Recomendación final

Para MC Presupuestos, la mejor dirección es usar **Khipu como símbolo funcional**, no como mascota. El asistente debe sentirse como una capa inteligente del producto: discreta, técnica y siempre disponible.

El símbolo de nudo conectado permite crear una identidad propia sin romper la estética SaaS de MC Presupuestos.
