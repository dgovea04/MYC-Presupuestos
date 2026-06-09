# Khipu Workspace UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the `/ai` workspace so Khipu feels like a focused MYC Presupuestos assistant while preserving existing routes, APIs, entitlements, model routing, token usage, ChatGPT Bridge behavior, and APU generation behavior.

**Architecture:** Keep the implementation inside existing client/server boundaries. `app/ai/page.tsx` remains the server gate and URL-param hydrator; `components/ai/AIWorkspace.tsx` remains the client workspace; `components/ai/ContextSidebar.tsx` remains the context editor. This phase changes composition, copy, and visual hierarchy only.

**Tech Stack:** Next.js App Router, React Client Components, TypeScript strict mode, Tailwind CSS, lucide-react, Vitest/jsdom.

---

## File Structure

- Modify: `components/ai/AIWorkspace.tsx`
  - Owns Khipu workspace layout, action command selector, provider selector, runtime status, request form, result rendering, and browser-local recent activity.
- Modify: `components/ai/ContextSidebar.tsx`
  - Owns editable Khipu context fields shown beside the workspace.
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`
  - Extends existing jsdom coverage for Khipu header, command labels, runtime status, provider selection, bridge behavior, and recent activity naming.
- Modify: `app/ai/page.test.tsx`
  - Adds entitlement-gate coverage for Khipu Pro copy while preserving URL parameter hydration tests.
- Modify only if required by failing tests: `components/layout/app-sidebar-client.test.tsx`
  - Ensures `/ai` remains in navigation and visible label is `Khipu`.
- No route handler, schema, Prisma, model, token ledger, or API payload files should be changed.

---

### Task 1: Add Workspace UX Tests

**Files:**
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Add test helpers for text lookup that can tolerate nested elements**

Add this helper inside `renderWorkspace()` return object, beside `getByText`:

```ts
    getTextContaining: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) =>
        candidate.textContent?.includes(text),
      );
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text containing: ${text}`);
      }

      return element;
    },
```

- [ ] **Step 2: Add a failing test for Khipu workspace shell**

Add this test near the top of `describe("AIWorkspace ChatGPT bridge provider", () => {`:

```ts
  it("renders Khipu as an operational workspace with command actions and runtime status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText, getByText, getTextContaining } = await renderWorkspace();

    expect(getByText("Khipu")).toBeTruthy();
    expect(getByText("Asistente tecnico")).toBeTruthy();
    expect(getTextContaining("Asistente tecnico para presupuestos, APU, revision y autocompletado")).toBeTruthy();
    expect(getTextContaining("Proveedor activo")).toBeTruthy();
    expect(getTextContaining("Ollama listo")).toBeTruthy();
    expect(getButtonByText("Actualizar estado")).toBeTruthy();
    expect(getButtonByText("Ollama local")).toBeTruthy();
    expect(getButtonByText("ChatGPT Bridge")).toBeTruthy();
    expect(getButtonByText("Chat tecnico")).toBeTruthy();
    expect(getButtonByText("Generar APU")).toBeTruthy();
    expect(getButtonByText("Revisar presupuesto")).toBeTruthy();
    expect(getButtonByText("Autocompletar")).toBeTruthy();
    expect(getTextContaining("Modelo resuelto")).toBeTruthy();
    expect(getTextContaining("Ultima latencia")).toBeTruthy();
  });
```

- [ ] **Step 3: Update the existing bridge test for the new chat field label**

Change this assertion:

```ts
    expect(getTextareaByLabel("Consulta").value).toBe("Consulta inicial");
```

to:

```ts
    expect(getTextareaByLabel("Consulta tecnica").value).toBe("Consulta inicial");
```

- [ ] **Step 4: Update the history test to expect Khipu recent activity naming**

In `it("restores a saved history result so the full structured response can be viewed later", ...)`, after `const { getButtonByText, getByText } = await renderWorkspace();`, add:

```ts
    expect(getByText("Actividad reciente de Khipu")).toBeTruthy();
```

- [ ] **Step 5: Run the workspace tests to verify they fail**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: FAIL because `Asistente tecnico`, the new supporting copy, `Consulta tecnica`, and `Actividad reciente de Khipu` are not fully implemented yet.

- [ ] **Step 6: Commit the failing tests**

```bash
git add components/ai/AIWorkspace.bridge.test.tsx
git commit -m "test: describe khipu workspace ux"
```

---

### Task 2: Rework The Khipu Workspace Header And Runtime Status

**Files:**
- Modify: `components/ai/AIWorkspace.tsx`
- Test: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Replace the current gradient hero card with an operational header**

In `components/ai/AIWorkspace.tsx`, replace the first header `<Card ...>` block inside `<div className="space-y-5">` with:

```tsx
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                  Asistente tecnico
                </span>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Khipu</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                    Asistente tecnico para presupuestos, APU, revision y autocompletado en MYC Presupuestos.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-900">Proveedor activo</span>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", readHealthBadgeClass(health?.status))}>
                    {readHealthLabel(health?.status)}
                  </span>
                </div>
                <p>{provider === "ollama" ? "Ollama local" : "ChatGPT Bridge"}</p>
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={() => void loadHealth()}>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar estado
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
```

- [ ] **Step 2: Replace the diagnostic-heavy status card with a quieter runtime card**

Replace the following `<Card className="border-slate-200">` status block, from `<CardContent className="grid gap-4 p-6 xl:grid-cols-[minmax(0,1fr)_320px]">` through its closing `</Card>`, with:

```tsx
        <Card className="border-slate-200 bg-slate-50/60">
          <CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px_260px]">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Estado de runtime</p>
                <p className="mt-1 text-sm text-slate-500">
                  Diagnostico compacto del proveedor y modelos disponibles para la accion activa.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {(health?.requiredModels ?? []).map((model) => (
                  <div key={model.model} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-semibold text-slate-900">{model.model}</p>
                    <p className={cn("mt-1 text-[11px] font-medium", model.installed ? "text-emerald-700" : "text-amber-700")}>
                      {model.installed ? "Instalado" : "Pendiente"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Proveedor</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    provider === "ollama" ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600",
                  )}
                  type="button"
                  onClick={() => {
                    setProvider("ollama");
                    pendingBridgeRequestId.current = null;
                    latestBridgeRequest.current = null;
                    clearPendingBridgeTimeout();
                    setLoading(false);
                    setError("");
                    setResult(null);
                  }}
                >
                  Ollama local
                </button>
                <button
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    provider === "chatgpt-bridge"
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                  type="button"
                  onClick={() => {
                    setProvider("chatgpt-bridge");
                    setError("");
                    setResult(null);
                  }}
                >
                  ChatGPT Bridge
                </button>
              </div>
              {provider === "chatgpt-bridge" ? (
                <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                  Estado: {readBridgeStateLabel(bridgeState)}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Accion activa</p>
              <p className="mt-1 text-sm text-slate-500">
                Modelo solicitado:{" "}
                <span className="font-medium text-slate-700">
                  {provider === "ollama" ? activeHealth?.requestedModel ?? "Sin datos" : "ChatGPT web"}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Modelo resuelto:{" "}
                <span className="font-medium text-slate-700">
                  {provider === "ollama" ? activeHealth?.model ?? "Sin datos" : "Pestana ChatGPT"}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ultima latencia:{" "}
                <span className="font-medium text-slate-700">
                  {provider === "ollama" ? formatLatency(health?.metrics[activeAction]?.latencyMs) : "Depende de ChatGPT"}
                </span>
              </p>
              {provider === "ollama" && activeHealth?.fallbackUsed ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Fallback activo para esta accion.
                </p>
              ) : null}
              {provider === "ollama" && health?.metrics[activeAction]?.lastError ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {health.metrics[activeAction].lastError}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
```

- [ ] **Step 3: Run the workspace tests**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: still FAIL if action buttons or form labels have not yet been adjusted. The header/status assertions should now pass.

- [ ] **Step 4: Commit the header and runtime status changes**

```bash
git add components/ai/AIWorkspace.tsx
git commit -m "feat: refine khipu workspace header"
```

---

### Task 3: Convert Action Cards Into Work Commands And Update Form Copy

**Files:**
- Modify: `components/ai/AIWorkspace.tsx`
- Test: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Update action descriptions to concise command purposes**

Replace the `ACTIONS` array descriptions with:

```ts
const ACTIONS = [
  {
    id: "chat",
    label: "Chat tecnico",
    description: "Resolver dudas tecnicas con contexto de obra.",
    icon: BotMessageSquare,
  },
  {
    id: "apu",
    label: "Generar APU",
    description: "Crear una propuesta revisable de recursos y rendimiento.",
    icon: Sparkles,
  },
  {
    id: "review",
    label: "Revisar presupuesto",
    description: "Detectar unidades, duplicados y costos sospechosos.",
    icon: FileSearch,
  },
  {
    id: "autocomplete",
    label: "Autocompletar",
    description: "Completar descripciones y especificaciones tecnicas.",
    icon: WandSparkles,
  },
] as const;
```

- [ ] **Step 2: Replace the action selector markup**

Replace the current `<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">` action selector with:

```tsx
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const active = action.id === activeAction;

            return (
              <button
                key={action.id}
                className={cn(
                  "flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  active ? "border-blue-300 bg-blue-50 text-slate-950 shadow-sm" : "border-slate-200 bg-white text-slate-800",
                )}
                type="button"
                onClick={() => {
                  setActiveAction(action.id);
                  setResult(null);
                  setError("");
                }}
              >
                <span
                  className={cn(
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{action.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{action.description}</span>
                </span>
              </button>
            );
          })}
        </div>
```

- [ ] **Step 3: Update form labels**

In the chat form, change:

```tsx
                  Consulta
```

to:

```tsx
                  Consulta tecnica
```

In the review form, change:

```tsx
                  Resumen del presupuesto o partidas
```

to:

```tsx
                  Resumen del presupuesto
```

Leave APU labels `Partida` and `Unidad`, and autocomplete label `Texto base` unchanged.

- [ ] **Step 4: Run the workspace tests**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: FAIL only if history/context copy has not yet been changed. Bridge request behavior should still pass.

- [ ] **Step 5: Commit the command and form copy changes**

```bash
git add components/ai/AIWorkspace.tsx components/ai/AIWorkspace.bridge.test.tsx
git commit -m "feat: present khipu actions as commands"
```

---

### Task 4: Rename Context And Recent Activity Surfaces

**Files:**
- Modify: `components/ai/ContextSidebar.tsx`
- Modify: `components/ai/AIWorkspace.tsx`
- Test: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Update `ContextSidebar` copy**

In `components/ai/ContextSidebar.tsx`, replace the title and description block with:

```tsx
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">Contexto de trabajo</p>
        <p className="text-sm leading-6 text-slate-500">Estos datos guian la respuesta de Khipu para el modulo actual.</p>
      </div>
```

- [ ] **Step 2: Normalize the module label mojibake while touching this file**

Change:

```tsx
        <ContextInput label="MÃ³dulo" value={context.module ?? ""} onChange={(module) => onChange({ ...context, module })} />
```

to:

```tsx
        <ContextInput label="Modulo" value={context.module ?? ""} onChange={(module) => onChange({ ...context, module })} />
```

- [ ] **Step 3: Rename the history section in `AIWorkspace`**

In the history section, change:

```tsx
                <h3 className="text-lg font-semibold text-slate-950">Historial local de sesion</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Se guarda solo en este navegador para retomar contexto y revisar resultados recientes.
                </p>
```

to:

```tsx
                <h3 className="text-lg font-semibold text-slate-950">Actividad reciente de Khipu</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Se guarda solo en este navegador para retomar resultados recientes; no es memoria del proyecto.
                </p>
```

- [ ] **Step 4: Extend the history test with context copy assertions**

In `components/ai/AIWorkspace.bridge.test.tsx`, inside `it("renders Khipu as an operational workspace...")`, add:

```ts
    expect(getByText("Contexto de trabajo")).toBeTruthy();
    expect(getTextContaining("Estos datos guian la respuesta de Khipu")).toBeTruthy();
```

- [ ] **Step 5: Run the workspace tests**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the context and recent activity changes**

```bash
git add components/ai/ContextSidebar.tsx components/ai/AIWorkspace.tsx components/ai/AIWorkspace.bridge.test.tsx
git commit -m "feat: clarify khipu context and activity"
```

---

### Task 5: Add Pro Gate Coverage For Khipu Copy

**Files:**
- Modify: `app/ai/page.test.tsx`
- Test: `app/ai/page.tsx`

- [ ] **Step 1: Make the entitlement mock configurable**

Near `const aiWorkspaceSpy = vi.fn();`, add:

```ts
let mockAvailableFeatures = ["exports.basic", "polynomial_formula", "ai.local"];
```

In the `getEffectiveUserLicense` mock, change:

```ts
    availableFeatures: ["exports.basic", "polynomial_formula", "ai.local"],
```

to:

```ts
    availableFeatures: mockAvailableFeatures,
```

- [ ] **Step 2: Reset mock features before each test**

Add `beforeEach` to the Vitest import:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
```

Inside `describe("AIPage", () => {`, add:

```ts
  beforeEach(() => {
    mockAvailableFeatures = ["exports.basic", "polynomial_formula", "ai.local"];
  });
```

- [ ] **Step 3: Add Pro gate coverage**

Add this test before the URL hydration tests:

```ts
  it("renders Khipu upgrade copy when the user lacks local AI access", async () => {
    mockAvailableFeatures = ["exports.basic", "polynomial_formula"];

    const markup = renderToStaticMarkup(await AIPage({
      searchParams: Promise.resolve({}),
    }));

    expect(markup).toContain("Khipu disponible en Pro");
    expect(markup).toContain("Activa Khipu para chat tecnico");
    expect(aiWorkspaceSpy).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run the page test**

Run:

```bash
npm run test -- app/ai/page.test.tsx
```

Expected: PASS because `app/ai/page.tsx` already has the Khipu Pro copy from the prior rename.

- [ ] **Step 5: Commit the page coverage**

```bash
git add app/ai/page.test.tsx
git commit -m "test: cover khipu pro gate"
```

---

### Task 6: Verify Sidebar And Existing Khipu Entry Points

**Files:**
- Modify if needed: `components/layout/app-sidebar-client.test.tsx`
- Test: `components/apu/apu-editor-sheet.test.tsx`
- Test: `components/partidas/partida-apu-sheet.test.tsx`
- Test: `components/layout/app-sidebar-client.test.tsx`

- [ ] **Step 1: Add a sidebar label assertion if missing**

In `components/layout/app-sidebar-client.test.tsx`, inside `it("renders expanded by default on regular desktop...")`, after `expect(navigationHrefs).toEqual([...]);`, add:

```ts
    expect(container.textContent).toContain("Khipu");
```

- [ ] **Step 2: Run entry point tests**

Run:

```bash
npm run test -- components/apu/apu-editor-sheet.test.tsx components/partidas/partida-apu-sheet.test.tsx components/layout/app-sidebar-client.test.tsx
```

Expected: PASS. Existing APU tests should continue to confirm `Abrir en Khipu` links point to `/ai?action=apu`.

- [ ] **Step 3: Commit only if Step 1 changed the sidebar test**

If `components/layout/app-sidebar-client.test.tsx` was modified, run:

```bash
git add components/layout/app-sidebar-client.test.tsx
git commit -m "test: cover khipu sidebar label"
```

If the test already covered this label and no file changed, do not create an empty commit.

---

### Task 7: Final Verification

**Files:**
- No new source files.

- [ ] **Step 1: Run the targeted Khipu test suite**

Run:

```bash
npm run test -- app/ai/page.test.tsx components/ai/AIWorkspace.bridge.test.tsx components/apu/apu-editor-sheet.test.tsx components/partidas/partida-apu-sheet.test.tsx components/layout/app-sidebar-client.test.tsx
```

Expected: all listed test files PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 3: Search for old product naming in touched user-facing areas**

Run:

```bash
rg -n "(?i)copilo(to|t)" app components lib docs prd README.md
```

Expected: no output.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff -- app/ai/page.test.tsx components/ai/AIWorkspace.tsx components/ai/AIWorkspace.bridge.test.tsx components/ai/ContextSidebar.tsx components/layout/app-sidebar-client.test.tsx
```

Expected: diff only contains Khipu UX, copy, layout hierarchy, and tests. No API route, Prisma schema, model routing, token ledger, or APU calculation changes.

- [ ] **Step 5: Commit final cleanup if any verification edits were made**

If any files changed during final verification, run:

```bash
git add app/ai/page.test.tsx components/ai/AIWorkspace.tsx components/ai/AIWorkspace.bridge.test.tsx components/ai/ContextSidebar.tsx components/layout/app-sidebar-client.test.tsx
git commit -m "chore: verify khipu workspace ux"
```

If no files changed, do not create an empty commit.
