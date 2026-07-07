/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotesDrawer, openNoteDraft } from "@/components/notes/notes-drawer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/budgets/budget-1",
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({ isExcelMode: false }),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-1",
    body: "Revisar metrado",
    priority: "HIGH",
    status: "OPEN",
    sourcePath: "/budgets/budget-1",
    author: { name: "Test User", avatarUrl: null },
    sharedWith: [],
    createdAt: "2026-05-27T10:00:00.000Z",
    updatedAt: "2026-05-27T10:00:00.000Z",
    ...overrides,
  };
}

describe("NotesDrawer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(async () => {
    if (activeContainer) {
      const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
      if (root) {
        await act(async () => {
          root.unmount();
        });
      }
      activeContainer.remove();
      activeContainer = null;
    }

    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads open notes when opened and resolves one", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            notes: [makeNote()],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            note: makeNote({ status: "RESOLVED", resolvedAt: "2026-05-27T10:01:00.000Z" }),
          }),
          { status: 200 },
        ),
      );

    const { getButtonByText, getTextByExactMatch } = await renderDrawer();

    await act(async () => {
      getButtonByText("Notas").click();
    });

    expect(fetch).toHaveBeenCalledWith("/api/notes?status=OPEN");
    expect(getTextByExactMatch("Revisar metrado")).toBeTruthy();

    await act(async () => {
      getButtonByText("Resolver").click();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/notes/note-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "RESOLVED" }),
      }),
    );
  });

  it("opens with item context from the budget editor event and creates a linked note", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ notes: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            note: makeNote({
              id: "note-2",
              body: "Validar partida",
              priority: "MEDIUM",
              budgetId: "budget-1",
              budgetItemId: "item-1",
            }),
          }),
          { status: 200 },
        ),
      );

    const { getButtonByText, getTextarea } = await renderDrawer();

    await act(async () => {
      openNoteDraft({
        budgetId: "budget-1",
        budgetItemId: "item-1",
        budgetItemCode: "01.01",
        budgetItemDescription: "Concreto",
        sourcePath: "/budgets/budget-1",
      });
    });

    expect(document.body.textContent).toContain("01.01");

    await act(async () => {
      setNativeValue(getTextarea(), "Validar partida");
      getTextarea().dispatchEvent(new InputEvent("input", { bubbles: true }));
    });

    await act(async () => {
      getButtonByText("Crear nota").click();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          body: "Validar partida",
          priority: "MEDIUM",
          sourcePath: "/budgets/budget-1",
          budgetId: "budget-1",
          budgetItemId: "item-1",
        }),
      }),
    );
  });

  it("displays the author name on each note", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          notes: [makeNote({ author: { name: "Carlos Perez", avatarUrl: null } })],
        }),
        { status: 200 },
      ),
    );

    const { getButtonByText } = await renderDrawer();

    await act(async () => {
      getButtonByText("Notas").click();
    });

    expect(document.body.textContent).toContain("Carlos Perez");
  });
});

async function renderDrawer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;
  activeContainer = container;

  await act(async () => {
    root.render(<NotesDrawer />);
  });

  return {
    getButtonByText: (text: string) => {
      const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
      if (!button) throw new Error(`Button not found: ${text}`);
      return button as HTMLButtonElement;
    },
    getTextByExactMatch: (text: string) => {
      const element = [...document.querySelectorAll("body *")].find((candidate) => candidate.textContent?.trim() === text);
      if (!element) throw new Error(`Text not found: ${text}`);
      return element as HTMLElement;
    },
    getTextarea: () => {
      const textarea = document.querySelector("textarea");
      if (!textarea) throw new Error("Textarea not found");
      return textarea;
    },
  };
}

function setNativeValue(element: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
    return;
  }

  valueSetter?.call(element, value);
}
