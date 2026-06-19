# Global AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Khipu as a floating global assistant across the authenticated MYC webapp, with live chat streaming and current-view context awareness.

**Architecture:** Mount a client-only global assistant provider from `app/layout.tsx`, extract reusable chat/controller logic out of the current `AIWorkspace`, and add a structured current-view context registry that pages can publish into. Keep the existing Khipu routes and project-history pipeline, extending only the context types and validation so the floating assistant and `/ai` page share the same engine.

**Tech Stack:** Next.js App Router, React 19 client/server components, TypeScript strict mode, Vitest, existing Khipu AI routes and services

---

## File Structure

**Create**
- `components/ai/global-ai-assistant-provider.tsx` - global provider that owns open/close state, route visibility, and current-view context registry
- `components/ai/floating-ai-assistant.tsx` - floating FAB and expanded panel shell anchored at bottom-right
- `components/ai/ai-assistant-panel.tsx` - reusable chat panel UI shared by the floating widget and `AIWorkspace`
- `components/ai/use-ai-assistant-controller.ts` - shared controller for request submission, streaming, history, feedback, and provider status
- `components/ai/ai-view-context.tsx` - client context and hooks to publish/read the active view context
- `hooks/use-ai-view-context.ts` - helper hook for route modules to publish structured context
- `components/ai/global-ai-assistant-provider.test.tsx`
- `components/ai/floating-ai-assistant.test.tsx`
- `components/ai/use-ai-assistant-controller.test.tsx`
- `components/ai/ai-view-context.test.tsx`

**Modify**
- `app/layout.tsx` - mount the global assistant provider under the root `body`
- `components/ai/AIWorkspace.tsx` - reduce to page composition using the shared controller/panel
- `lib/ai/types.ts` - expand `AiContext` with route and entity metadata
- `lib/ai/validation.ts` - validate expanded `AiContext` shape for all AI routes
- `lib/ai/context-builder.ts` - format the expanded context block cleanly
- `lib/ai/context/assembled-context.ts` - include current-view context in the assembled backend context
- `app/api/ai/chat/stream/route.ts` - keep streaming route compatible with expanded context payloads
- `app/ai/page.tsx` - pass `projectId` and initial context through the shared panel contract
- `components/layout/app-shell.tsx` - mount a route-scoped helper that can publish default module context when needed
- `app/budgets/[id]/page.tsx`
- `app/projects/[id]/page.tsx`
- `app/resources/page.tsx`
- `app/partidas/page.tsx`
- `app/dashboard/page.tsx`

**Test**
- `app/ai/page.test.tsx`
- `app/api/ai/chat/stream/route.test.ts`
- `components/ai/AIWorkspace.bridge.test.tsx`

### Task 1: Mount the global assistant shell

**Files:**
- Create: `components/ai/global-ai-assistant-provider.tsx`
- Create: `components/ai/floating-ai-assistant.tsx`
- Create: `components/ai/global-ai-assistant-provider.test.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write the failing layout/provider tests**

Create `components/ai/global-ai-assistant-provider.test.tsx` with coverage for:
- rendering children unchanged
- rendering the floating assistant on authenticated app routes
- hiding it on `/login` and `/register`
- toggling expanded/minimized state

```tsx
/* @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { GlobalAiAssistantProvider } from "@/components/ai/global-ai-assistant-provider";

describe("GlobalAiAssistantProvider", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the floating launcher on authenticated routes", async () => {
    window.history.replaceState({}, "", "/dashboard");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <GlobalAiAssistantProvider>
          <div>Contenido</div>
        </GlobalAiAssistantProvider>,
      );
    });

    expect(document.body.textContent).toContain("Contenido");
    expect(document.body.textContent).toContain("Khipu");
    expect(document.querySelector("[data-khipu-launcher]")).toBeTruthy();
  });

  it("hides the floating launcher on auth routes", async () => {
    window.history.replaceState({}, "", "/login");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <GlobalAiAssistantProvider>
          <div>Login</div>
        </GlobalAiAssistantProvider>,
      );
    });

    expect(document.querySelector("[data-khipu-launcher]")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/ai/global-ai-assistant-provider.test.tsx`
Expected: FAIL with module-not-found errors for `GlobalAiAssistantProvider`

- [ ] **Step 3: Implement the global provider and floating shell**

Create `components/ai/global-ai-assistant-provider.tsx` and `components/ai/floating-ai-assistant.tsx` with a small route-aware shell:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";
import { AiViewContextProvider } from "@/components/ai/ai-view-context";

const HIDDEN_ROUTES = new Set(["/login", "/register"]);

export function GlobalAiAssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hidden = pathname ? HIDDEN_ROUTES.has(pathname) : false;

  return (
    <AiViewContextProvider>
      {children}
      {hidden ? null : <FloatingAiAssistant open={open} onOpenChange={setOpen} />}
    </AiViewContextProvider>
  );
}
```

```tsx
"use client";

import { BotMessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function FloatingAiAssistant({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex items-end justify-end">
      {open ? (
        <Card className="pointer-events-auto w-[min(420px,calc(100vw-2rem))] rounded-3xl border-slate-200 shadow-xl">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Khipu</p>
              <h2 className="text-base font-semibold text-slate-950">Asistente tecnico</h2>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Button
        data-khipu-launcher
        type="button"
        className="pointer-events-auto ml-3 h-14 rounded-2xl px-4 shadow-lg"
        onClick={() => onOpenChange(!open)}
      >
        <BotMessageSquare className="mr-2 h-5 w-5" />
        Khipu
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Mount the provider from the root layout**

Update `app/layout.tsx`:

```tsx
import { GlobalAiAssistantProvider } from "@/components/ai/global-ai-assistant-provider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // ...
  return (
    <html /* ... */>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <GlobalAiAssistantProvider>{children}</GlobalAiAssistantProvider>
        <Script id="app-preferences-bootstrap" src="/app-preferences-bootstrap.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run tests to verify the shell passes**

Run: `npm run test -- components/ai/global-ai-assistant-provider.test.tsx`
Expected: PASS with route visibility and launcher behavior green

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx components/ai/global-ai-assistant-provider.tsx components/ai/floating-ai-assistant.tsx components/ai/global-ai-assistant-provider.test.tsx
git commit -m "feat: mount global khipu assistant shell"
```

### Task 2: Extract the shared assistant controller and reusable panel

**Files:**
- Create: `components/ai/use-ai-assistant-controller.ts`
- Create: `components/ai/use-ai-assistant-controller.test.tsx`
- Create: `components/ai/ai-assistant-panel.tsx`
- Create: `components/ai/floating-ai-assistant.test.tsx`
- Modify: `components/ai/AIWorkspace.tsx`

- [ ] **Step 1: Write the failing controller tests**

Create `components/ai/use-ai-assistant-controller.test.tsx` to lock down the current behavior:
- chat requests stream partial deltas and then final result
- cloud requests still use `/api/ai/execute`
- history entries are added for session mode

```tsx
/* @vitest-environment jsdom */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";

describe("useAiAssistantController", () => {
  it("commits streamed chat text before the final event", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/ai/chat/stream") {
        return new Response(
          "event: delta\\ndata: {\\"text\\":\\"Hola\\"}\\n\\n" +
            "event: final\\ndata: {\\"answer\\":\\"Hola mundo\\",\\"model\\":\\"llama3\\",\\"requestedModel\\":\\"llama3\\",\\"fallbackUsed\\":false,\\"warnings\\":[]}\\n\\n",
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }

      return new Response(JSON.stringify({ status: "ok", providers: {} }), { status: 200 });
    }));

    const { result } = renderHook(() =>
      useAiAssistantController({
        projectId: undefined,
        initialAction: "chat",
        initialContext: { module: "Presupuestos" },
      }),
    );

    await act(async () => {
      await result.current.submit({
        action: "chat",
        payload: { message: "Explica la vista", context: { module: "Presupuestos" } },
      });
    });

    expect(result.current.result?.answer).toContain("Hola mundo");
    expect(result.current.history).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/ai/use-ai-assistant-controller.test.tsx`
Expected: FAIL because `useAiAssistantController` does not exist yet

- [ ] **Step 3: Extract the request/state logic from `AIWorkspace`**

Create `components/ai/use-ai-assistant-controller.ts` by moving these responsibilities out of `AIWorkspace.tsx`:
- `submitRequest`
- `submitStreamingChatRequest`
- `submitCloudRequest`
- `loadHealth`
- history and feedback state

Skeleton:

```tsx
"use client";

import { useMemo, useRef, useState } from "react";
import type { AiContext, AiEndpointResult } from "@/lib/ai/types";

export type AssistantAction = "chat" | "apu" | "review" | "autocomplete";

export function useAiAssistantController({
  projectId,
  initialAction,
  initialContext,
}: {
  projectId?: string;
  initialAction: AssistantAction;
  initialContext: AiContext;
}) {
  const [activeAction, setActiveAction] = useState<AssistantAction>(initialAction);
  const [context, setContext] = useState<AiContext>(initialContext);
  const [result, setResult] = useState<AiEndpointResult | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; action: AssistantAction; context: AiContext }>>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const lastProjectId = useRef(projectId);

  async function submit(request: { action: AssistantAction; payload: Record<string, unknown> }) {
    // move the current submit logic here from AIWorkspace
  }

  return {
    activeAction,
    context,
    history,
    loading,
    result,
    setActiveAction,
    setContext,
    streaming,
    submit,
  };
}
```

- [ ] **Step 4: Build the reusable panel and slim `AIWorkspace`**

Create `components/ai/ai-assistant-panel.tsx` and convert `AIWorkspace.tsx` into a thin page wrapper:

```tsx
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";

export function AIWorkspace(props: AIWorkspaceProps) {
  const controller = useAiAssistantController({
    projectId: props.projectId,
    initialAction: props.initialAction ?? "chat",
    initialContext: props.initialContext ?? {},
  });

  return <AiAssistantPanel controller={controller} layout="page" />;
}
```

`AiAssistantPanel` should accept a `layout` prop:

```tsx
type AiAssistantPanelLayout = "page" | "floating";
```

Use it to switch between:
- full-page hero/cards for `/ai`
- compact floating panel body for the global widget

- [ ] **Step 5: Wire the floating assistant to the shared panel**

Update `components/ai/floating-ai-assistant.tsx`:

```tsx
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { useAiAssistantController } from "@/components/ai/use-ai-assistant-controller";
import { useActiveAiViewContext } from "@/components/ai/ai-view-context";

const viewContext = useActiveAiViewContext();
const controller = useAiAssistantController({
  projectId: viewContext.projectId,
  initialAction: "chat",
  initialContext: viewContext,
});

return (
  <Card /* ... */>
    <AiAssistantPanel controller={controller} layout="floating" />
  </Card>
);
```

- [ ] **Step 6: Run the focused assistant tests**

Run: `npm run test -- components/ai/use-ai-assistant-controller.test.tsx components/ai/floating-ai-assistant.test.tsx app/ai/page.test.tsx components/ai/AIWorkspace.bridge.test.tsx`
Expected: PASS with old behavior preserved and floating mode using the shared controller

- [ ] **Step 7: Commit**

```bash
git add components/ai/use-ai-assistant-controller.ts components/ai/use-ai-assistant-controller.test.tsx components/ai/ai-assistant-panel.tsx components/ai/floating-ai-assistant.tsx components/ai/floating-ai-assistant.test.tsx components/ai/AIWorkspace.tsx app/ai/page.test.tsx components/ai/AIWorkspace.bridge.test.tsx
git commit -m "refactor: share khipu controller across page and widget"
```

### Task 3: Add structured current-view context publishing and backend compatibility

**Files:**
- Create: `components/ai/ai-view-context.tsx`
- Create: `components/ai/ai-view-context.test.tsx`
- Create: `hooks/use-ai-view-context.ts`
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/validation.ts`
- Modify: `lib/ai/context-builder.ts`
- Modify: `lib/ai/context/assembled-context.ts`
- Modify: `app/api/ai/chat/stream/route.test.ts`

- [ ] **Step 1: Write failing tests for current-view context**

Create `components/ai/ai-view-context.test.tsx`:

```tsx
/* @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { AiViewContextProvider, useActiveAiViewContext, usePublishAiViewContext } from "@/components/ai/ai-view-context";

function Publisher() {
  usePublishAiViewContext({
    route: "/budgets/1",
    projectId: "project-1",
    budgetId: "budget-1",
    module: "Presupuesto",
    activeTable: "Partidas",
    selectedItem: "Concreto f'c=210",
    selectionType: "partida",
    selectionId: "partida-1",
  });
  return null;
}

function Reader() {
  const context = useActiveAiViewContext();
  return <pre>{JSON.stringify(context)}</pre>;
}

describe("AiViewContextProvider", () => {
  it("publishes the active route context for the floating assistant", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AiViewContextProvider>
          <Publisher />
          <Reader />
        </AiViewContextProvider>,
      );
    });

    expect(container.textContent).toContain('"projectId":"project-1"');
    expect(container.textContent).toContain('"selectedItem":"Concreto f\'c=210"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/ai/ai-view-context.test.tsx`
Expected: FAIL because the provider/hooks do not exist

- [ ] **Step 3: Expand the shared `AiContext` type and validators**

Update `lib/ai/types.ts`:

```ts
export type AiContext = {
  route?: string;
  projectId?: string;
  budgetId?: string;
  module?: string;
  selectedItem?: string;
  selectionType?: "project" | "budget" | "partida" | "resource" | "metrado";
  selectionId?: string;
  unit?: string;
  currentCost?: number;
  activeTable?: string;
  viewSummary?: string;
};
```

Update `lib/ai/validation.ts`:

```ts
const aiContextSchema = z.object({
  route: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
  budgetId: z.string().trim().min(1).optional(),
  module: z.string().trim().min(1).optional(),
  selectedItem: z.string().trim().min(1).optional(),
  selectionType: z.enum(["project", "budget", "partida", "resource", "metrado"]).optional(),
  selectionId: z.string().trim().min(1).optional(),
  unit: z.string().trim().min(1).optional(),
  currentCost: z.coerce.number().nonnegative().optional(),
  activeTable: z.string().trim().min(1).optional(),
  viewSummary: z.string().trim().min(1).optional(),
});
```

- [ ] **Step 4: Implement the current-view registry and formatter**

Create `components/ai/ai-view-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AiContext } from "@/lib/ai/types";

const AiViewContextState = createContext<AiContext>({});
const AiViewContextPublish = createContext<(next: AiContext) => void>(() => undefined);

export function AiViewContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AiContext>({});
  const publish = useMemo(() => (next: AiContext) => setContext(next), []);

  return (
    <AiViewContextPublish.Provider value={publish}>
      <AiViewContextState.Provider value={context}>{children}</AiViewContextState.Provider>
    </AiViewContextPublish.Provider>
  );
}

export function useActiveAiViewContext() {
  return useContext(AiViewContextState);
}

export function usePublishAiViewContext(next: AiContext) {
  const publish = useContext(AiViewContextPublish);
  useEffect(() => {
    publish(next);
  }, [next, publish]);
}
```

Update `lib/ai/context-builder.ts` so new fields are visible but concise:

```ts
const entries = [
  ["Ruta", context.route],
  ["Proyecto", context.project],
  ["Project ID", context.projectId],
  ["Budget ID", context.budgetId],
  ["Modulo", context.module],
  ["Partida seleccionada", context.selectedItem],
  ["Tipo de seleccion", context.selectionType],
  ["Selection ID", context.selectionId],
  ["Unidad", context.unit],
  ["Costo actual", typeof context.currentCost === "number" ? String(context.currentCost) : undefined],
  ["Tabla activa", context.activeTable],
  ["Resumen visible", context.viewSummary],
];
```

- [ ] **Step 5: Keep the assembled backend context aligned**

Update `lib/ai/context/assembled-context.ts` so the user payload context remains part of retrieval and the final assembled block:

```ts
return {
  projectContext,
  projectHistory: /* ... */,
  projectMemory,
  retrievalEvidence,
  userRequest: { task, payload },
};
```

Do not create a second context pipeline; instead, rely on `payload.context` now containing richer route metadata.

Update `app/api/ai/chat/stream/route.test.ts` to send and assert the expanded context shape:

```ts
context: {
  route: "/budgets/budget-1",
  projectId: "project-1",
  budgetId: "budget-1",
  module: "Presupuesto",
  activeTable: "Partidas",
  selectedItem: "Concreto f'c=210",
}
```

- [ ] **Step 6: Run the context and route tests**

Run: `npm run test -- components/ai/ai-view-context.test.tsx app/api/ai/chat/stream/route.test.ts`
Expected: PASS with the expanded context accepted by validators and preserved by streaming

- [ ] **Step 7: Commit**

```bash
git add components/ai/ai-view-context.tsx components/ai/ai-view-context.test.tsx hooks/use-ai-view-context.ts lib/ai/types.ts lib/ai/validation.ts lib/ai/context-builder.ts lib/ai/context/assembled-context.ts app/api/ai/chat/stream/route.test.ts
git commit -m "feat: add structured current-view context for khipu"
```

### Task 4: Publish real context from key views and finish verification

**Files:**
- Modify: `app/budgets/[id]/page.tsx`
- Modify: `app/projects/[id]/page.tsx`
- Modify: `app/resources/page.tsx`
- Modify: `app/partidas/page.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `components/ai/floating-ai-assistant.tsx`
- Modify: `components/ai/floating-ai-assistant.test.tsx`

- [ ] **Step 1: Write a failing floating-assistant integration test**

Extend `components/ai/floating-ai-assistant.test.tsx` to assert that published view context appears in the compact panel:

```tsx
/* @vitest-environment jsdom */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { AiViewContextProvider, usePublishAiViewContext } from "@/components/ai/ai-view-context";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";

function PublishBudgetContext() {
  usePublishAiViewContext({
    route: "/budgets/budget-1",
    projectId: "project-1",
    budgetId: "budget-1",
    module: "Presupuesto",
    activeTable: "Partidas",
    selectedItem: "Acero corrugado",
  });
  return null;
}

describe("FloatingAiAssistant", () => {
  it("shows active module and selection inside the compact panel", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AiViewContextProvider>
          <PublishBudgetContext />
          <FloatingAiAssistant open onOpenChange={() => undefined} />
        </AiViewContextProvider>,
      );
    });

    expect(container.textContent).toContain("Presupuesto");
    expect(container.textContent).toContain("Acero corrugado");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/ai/floating-ai-assistant.test.tsx`
Expected: FAIL because the compact panel does not yet render active route context

- [ ] **Step 3: Publish context from the high-value routes**

In each page, add a tiny client bridge rather than making the page itself client-only.

Create a small route helper pattern:

```tsx
"use client";

import { useAiViewContext } from "@/hooks/use-ai-view-context";

export function BudgetPageAiContextBridge({
  projectId,
  budgetId,
  selectedItem,
}: {
  projectId: string;
  budgetId: string;
  selectedItem?: string;
}) {
  useAiViewContext({
    route: `/budgets/${budgetId}`,
    projectId,
    budgetId,
    module: "Presupuesto",
    activeTable: "Partidas",
    selectedItem,
    selectionType: selectedItem ? "partida" : "budget",
    viewSummary: selectedItem ? `Partida activa: ${selectedItem}` : "Vista general de presupuesto",
  });

  return null;
}
```

Mount equivalents from:
- `app/budgets/[id]/page.tsx`
- `app/projects/[id]/page.tsx`
- `app/resources/page.tsx`
- `app/partidas/page.tsx`
- `app/dashboard/page.tsx`

If a page does not yet have a reliable selected entity, publish only route/module/project-level data in this phase.

- [ ] **Step 4: Render live context in the floating panel**

Update `components/ai/floating-ai-assistant.tsx` to show:
- module badge
- active selection
- quick action buttons

```tsx
const activeContext = useActiveAiViewContext();

<div className="border-b border-slate-200 px-4 py-3">
  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
    {activeContext.module ?? "Contexto general"}
  </p>
  <p className="mt-1 text-sm font-medium text-slate-900">
    {activeContext.selectedItem ?? activeContext.viewSummary ?? "Sin seleccion activa"}
  </p>
</div>
```

- [ ] **Step 5: Run full verification**

Run: `npm run test -- components/ai/global-ai-assistant-provider.test.tsx components/ai/floating-ai-assistant.test.tsx components/ai/use-ai-assistant-controller.test.tsx components/ai/ai-view-context.test.tsx app/ai/page.test.tsx app/api/ai/chat/stream/route.test.ts components/ai/AIWorkspace.bridge.test.tsx`
Expected: PASS with the floating widget, shared controller, expanded context, and streaming behavior all green

Run: `npm run lint`
Expected: PASS with no TypeScript `any`, hook, or unused-import regressions

- [ ] **Step 6: Commit**

```bash
git add app/budgets/[id]/page.tsx app/projects/[id]/page.tsx app/resources/page.tsx app/partidas/page.tsx app/dashboard/page.tsx components/layout/app-shell.tsx components/ai/floating-ai-assistant.tsx components/ai/floating-ai-assistant.test.tsx
git commit -m "feat: publish live route context to global khipu assistant"
```

## Self-Review

### Spec coverage

- Global mounting in `app/layout.tsx`: covered by Task 1
- Floating widget at bottom-right: covered by Task 1 and Task 4
- Reuse of current Khipu engine: covered by Task 2
- Current-view context capture: covered by Task 3 and Task 4
- Live streaming requests/responses: preserved and regression-tested in Task 2 and Task 3
- Key route rollout for budgets/projects/resources/partidas/dashboard: covered by Task 4

### Placeholder scan

- No `TODO`, `TBD`, or “similar to previous task” placeholders remain
- Every task has explicit files, commands, and code anchors

### Type consistency

- `AiContext` is the canonical context contract for page, widget, validator, and backend formatting
- `AssistantAction` remains aligned with existing `chat | apu | review | autocomplete` usage in `AIWorkspace`

