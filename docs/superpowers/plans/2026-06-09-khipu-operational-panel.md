# Khipu Operational Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/ai` into a lightweight Khipu operational panel that surfaces active work context, recommended command, runtime readiness, execution guidance, and next-action shortcuts without changing backend behavior.

**Architecture:** Keep the implementation inside the existing AI UI boundary. Add small local helpers in `AIWorkspace.tsx` for action helper copy, context summary rows, and shared action switching; extend `ContextSidebar.tsx` with presentational next-action buttons; keep all API/provider/history behavior unchanged.

**Tech Stack:** Next.js App Router, React client components, TypeScript strict, Tailwind CSS, shadcn-style UI primitives, lucide-react, Vitest jsdom.

---

## File Structure

- Modify: `components/ai/AIWorkspace.bridge.test.tsx`
  - Owns jsdom coverage for the operational panel shell, active context strip, recommended action label, execution helper copy, next-action shortcuts, provider controls, and bridge behavior.
- Modify: `components/ai/AIWorkspace.tsx`
  - Owns the `/ai` workspace layout, active work strip, command cards, runtime readiness section, execution block, request behavior, result rendering, and local history.
- Modify: `components/ai/ContextSidebar.tsx`
  - Owns editable context fields and the new presentational `Siguientes acciones` shortcut block.

Do not modify:

- `app/api/ai/*`
- `lib/ai/*`
- `prisma/*`
- S10 import/export modules
- budget/APU calculation modules
- unrelated dirty files already present in the working tree:
  - `app/dashboard/page.tsx`
  - `components/budget/budget-editor.tsx`
  - `lib/dashboard/onboarding.test.ts`
  - `lib/dashboard/onboarding.ts`

---

### Task 1: Add Failing Tests For The Operational Panel Shell

**Files:**
- Modify: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Extend the main workspace shell test**

In `components/ai/AIWorkspace.bridge.test.tsx`, inside `it("renders Khipu as an operational workspace with command actions and runtime status", ...)`, add these assertions after the Khipu header assertions and before provider assertions:

```tsx
    expect(getByText("Trabajo activo")).toBeTruthy();
    expect(getTextContaining("Proyecto")).toBeTruthy();
    expect(getTextContaining("Edificio Multifamiliar")).toBeTruthy();
    expect(getTextContaining("Modulo")).toBeTruthy();
    expect(getTextContaining("APU")).toBeTruthy();
    expect(getTextContaining("Partida seleccionada")).toBeTruthy();
    expect(getTextContaining("Concreto f'c=210")).toBeTruthy();
    expect(getTextContaining("Unidad")).toBeTruthy();
    expect(getTextContaining("m3")).toBeTruthy();
    expect(getTextContaining("Costo actual")).toBeTruthy();
    expect(getTextContaining("420")).toBeTruthy();
    expect(getTextContaining("Tabla activa")).toBeTruthy();
    expect(getTextContaining("Analisis de precios unitarios")).toBeTruthy();
    expect(getTextContaining("Preparacion")).toBeTruthy();
    expect(getTextContaining("Proveedor, modelos y latencia para ejecutar la accion activa.")).toBeTruthy();
    expect(getTextContaining("Recomendado")).toBeTruthy();
    expect(getTextContaining("Ejecucion")).toBeTruthy();
    expect(getTextContaining("Consulta criterios tecnicos con el contexto activo.")).toBeTruthy();
    expect(getTextContaining("Siguientes acciones")).toBeTruthy();
    expect(getButtonByAriaLabel("Explicar contexto")).toBeTruthy();
    expect(getButtonByAriaLabel("Autocompletar texto")).toBeTruthy();
```

- [ ] **Step 2: Add a test for next-action shortcuts**

First, in `renderWorkspace()`, add a helper next to `getButtonByText`:

```tsx
    getButtonByAriaLabel: (label: string) => {
      const element = document.body.querySelector(`button[aria-label="${label}"]`);
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button aria-label: ${label}`);
      }

      return element;
    },
```

Then, in the same `describe`, after the first shell test, add:

```tsx
  it("switches commands from next-action shortcuts without submitting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createHealthPayload(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByAriaLabel, getTextContaining, getTextareaByLabel } = await renderWorkspace();

    expect(getTextContaining("Consulta criterios tecnicos con el contexto activo.")).toBeTruthy();

    await act(async () => {
      getButtonByAriaLabel("Generar APU").click();
    });

    expect(getTextContaining("Genera una propuesta editable de recursos y rendimiento.")).toBeTruthy();
    expect(getTextContaining("Recomendado")).toBeTruthy();

    await act(async () => {
      getButtonByAriaLabel("Revisar presupuesto").click();
    });

    expect(getTextContaining("Revisa unidades, duplicados y costos sospechosos.")).toBeTruthy();

    await act(async () => {
      getButtonByAriaLabel("Autocompletar texto").click();
    });

    expect(getTextContaining("Completa descripciones tecnicas sin perder el contexto.")).toBeTruthy();

    await act(async () => {
      getButtonByAriaLabel("Explicar contexto").click();
    });

    expect(getTextareaByLabel("Consulta tecnica").value).toBe("Consulta inicial");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/health");
  });
```

This verifies that shortcuts only switch local action state and do not submit an AI request.

- [ ] **Step 3: Run the focused test and verify it fails**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: FAIL because `Trabajo activo`, `Preparacion`, `Ejecucion`, and `Siguientes acciones` are not implemented yet.

- [ ] **Step 4: Commit the failing tests**

```bash
git add components/ai/AIWorkspace.bridge.test.tsx
git commit -m "test: describe khipu operational panel"
```

---

### Task 2: Add Active Work Strip, Recommended Labels, And Execution Framing

**Files:**
- Modify: `components/ai/AIWorkspace.tsx`
- Test: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Add action helper metadata**

In `components/ai/AIWorkspace.tsx`, after the `ACTIONS` constant, add:

```tsx
const ACTION_HELPERS: Record<AiAction, string> = {
  chat: "Consulta criterios tecnicos con el contexto activo.",
  apu: "Genera una propuesta editable de recursos y rendimiento.",
  review: "Revisa unidades, duplicados y costos sospechosos.",
  autocomplete: "Completa descripciones tecnicas sin perder el contexto.",
};
```

- [ ] **Step 2: Add shared action switching**

Inside `AIWorkspace`, after `const providerStatus = ...`, add:

```tsx
  const switchAction = (action: AiAction) => {
    setActiveAction(action);
    setResult(null);
    setError("");
  };
```

- [ ] **Step 3: Add context summary rows**

Inside `AIWorkspace`, after `const providerStatus = ...`, add:

```tsx
  const contextRows = [
    { label: "Proyecto", value: context.project },
    { label: "Modulo", value: context.module },
    { label: "Partida seleccionada", value: context.selectedItem },
    { label: "Unidad", value: context.unit },
    { label: "Costo actual", value: typeof context.currentCost === "number" ? String(context.currentCost) : undefined },
    { label: "Tabla activa", value: context.activeTable },
  ].filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value.trim().length > 0);
```

Place this next to `switchAction` so both derived UI values are easy to find.

- [ ] **Step 4: Render the active work strip below the header card**

In the returned JSX, immediately after the closing `</Card>` for the Khipu identity header and before the runtime status card, insert:

```tsx
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Trabajo activo</p>
                <p className="mt-1 text-sm text-slate-500">Contexto visible que Khipu usara en esta sesion.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                Sesion actual
              </span>
            </div>
            {contextRows.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {contextRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{row.label}</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900">{row.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">Sin contexto activo</p>
            )}
          </CardContent>
        </Card>
```

- [ ] **Step 5: Rename runtime copy to preparation**

In the runtime status card, replace:

```tsx
                <p className="text-sm font-semibold text-slate-900">Estado de runtime</p>
                <p className="mt-1 text-sm text-slate-500">
                  Diagnostico compacto del proveedor y modelos disponibles para la accion activa.
                </p>
```

with:

```tsx
                <p className="text-sm font-semibold text-slate-900">Preparacion</p>
                <p className="mt-1 text-sm text-slate-500">
                  Proveedor, modelos y latencia para ejecutar la accion activa.
                </p>
```

- [ ] **Step 6: Add recommended label to the active command card**

In the action card button body, replace:

```tsx
                <span>
                  <span className="block font-semibold">{action.label}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{action.description}</span>
                </span>
```

with:

```tsx
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{action.label}</span>
                    {active ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">Recomendado</span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{action.description}</span>
                </span>
```

- [ ] **Step 7: Use shared action switching in command cards**

In action card `onClick`, replace:

```tsx
                onClick={() => {
                  setActiveAction(action.id);
                  setResult(null);
                  setError("");
                }}
```

with:

```tsx
                onClick={() => switchAction(action.id)}
```

- [ ] **Step 8: Add execution framing and helper copy**

In the main form card, replace this block:

```tsx
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <ActiveIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{activeConfig.label}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{activeConfig.description}</p>
              </div>
            </div>
```

with:

```tsx
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <ActiveIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ejecucion</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{activeConfig.label}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{ACTION_HELPERS[activeAction]}</p>
              </div>
            </div>
```

- [ ] **Step 9: Run the focused test and verify expected partial progress**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: still FAIL because `Siguientes acciones` shortcut buttons are not implemented yet. Assertions for `Trabajo activo`, `Preparacion`, `Recomendado`, and `Ejecucion` should now pass.

- [ ] **Step 10: Commit the panel shell implementation**

```bash
git add components/ai/AIWorkspace.tsx
git commit -m "feat: add khipu operational panel shell"
```

---

### Task 3: Add Next-Action Shortcuts To The Context Sidebar

**Files:**
- Modify: `components/ai/ContextSidebar.tsx`
- Modify: `components/ai/AIWorkspace.tsx`
- Test: `components/ai/AIWorkspace.bridge.test.tsx`

- [ ] **Step 1: Update `ContextSidebar` props**

In `components/ai/ContextSidebar.tsx`, replace the function signature:

```tsx
export function ContextSidebar({ context, onChange }: { context: AiContext; onChange: (context: AiContext) => void }) {
```

with:

```tsx
export type ContextShortcut = {
  label: string;
  description: string;
  onSelect: () => void;
};

export function ContextSidebar({
  context,
  onChange,
  shortcuts = [],
}: {
  context: AiContext;
  onChange: (context: AiContext) => void;
  shortcuts?: ContextShortcut[];
}) {
```

- [ ] **Step 2: Render the shortcuts below context inputs**

In the same component, after the closing `</div>` for the context input grid and before the closing `</aside>`, insert:

```tsx
      {shortcuts.length ? (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Siguientes acciones</p>
            <p className="text-sm leading-6 text-slate-500">Cambia de comando sin perder el contexto actual.</p>
          </div>
          <div className="mt-3 grid gap-2">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                type="button"
                aria-label={shortcut.label}
                onClick={shortcut.onSelect}
              >
                <span className="block text-sm font-semibold text-slate-900">{shortcut.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{shortcut.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
```

- [ ] **Step 3: Define shortcuts in `AIWorkspace`**

In `components/ai/AIWorkspace.tsx`, after `contextRows`, add:

```tsx
  const nextActionShortcuts = [
    {
      label: "Explicar contexto",
      description: "Abre el chat tecnico con los datos visibles.",
      onSelect: () => switchAction("chat"),
    },
    {
      label: "Generar APU",
      description: "Prepara una propuesta editable de recursos.",
      onSelect: () => switchAction("apu"),
    },
    {
      label: "Revisar presupuesto",
      description: "Busca unidades, duplicados y costos sospechosos.",
      onSelect: () => switchAction("review"),
    },
    {
      label: "Autocompletar texto",
      description: "Completa una descripcion tecnica breve.",
      onSelect: () => switchAction("autocomplete"),
    },
  ];
```

- [ ] **Step 4: Pass shortcuts to `ContextSidebar`**

At the bottom of `AIWorkspace`, replace:

```tsx
      <ContextSidebar context={context} onChange={setContext} />
```

with:

```tsx
      <ContextSidebar context={context} shortcuts={nextActionShortcuts} onChange={setContext} />
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx
```

Expected: PASS. The new shortcut test should verify switching actions without submitting an AI request.

- [ ] **Step 6: Commit the shortcuts**

```bash
git add components/ai/ContextSidebar.tsx components/ai/AIWorkspace.tsx
git commit -m "feat: add khipu next actions"
```

---

### Task 4: Final Verification

**Files:**
- Verify: `components/ai/AIWorkspace.bridge.test.tsx`
- Verify: `components/ai/AIWorkspace.tsx`
- Verify: `components/ai/ContextSidebar.tsx`
- Verify: `app/ai/page.test.tsx`

- [ ] **Step 1: Run the Khipu operational panel test suite**

Run:

```bash
npm run test -- components/ai/AIWorkspace.bridge.test.tsx app/ai/page.test.tsx
```

Expected: PASS. Both files should pass all tests.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 3: Confirm old assistant names remain absent**

Run:

```bash
rg -n "(?i)copilo(to|t)" app components lib docs prd README.md
```

Expected: no output. `rg` exits with code 1 when there are no matches; that is expected.

- [ ] **Step 4: Confirm scope**

Run:

```bash
git status --short
```

Expected: Khipu operational panel changes should be committed. The only remaining dirty files should be the unrelated pre-existing files:

- `app/dashboard/page.tsx`
- `components/budget/budget-editor.tsx`
- `lib/dashboard/onboarding.test.ts`
- `lib/dashboard/onboarding.ts`

Do not stage, commit, revert, or modify those unrelated files.

---

## Self-Review Checklist

- The plan adds `Trabajo activo` and summarizes `AiContext`.
- The plan adds a text-visible `Recomendado` label to the active command.
- The plan renames runtime readiness to `Preparacion`.
- The plan adds `Ejecucion` with action-specific helper copy.
- The plan adds `Siguientes acciones` shortcuts that switch local action state and do not submit.
- The plan does not introduce new network calls, persistence, RAG, streaming, metrics, S10, schema, or calculation changes.
- The plan includes failing tests, implementation steps, verification commands, and commit points.
