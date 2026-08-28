/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminAiUsageDrilldown } from "@/components/admin/admin-ai-usage-drilldown";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function createReportPayload(overrides?: { byTask?: unknown[]; byProvider?: unknown[]; bySource?: unknown[] }) {
  return {
    summary: { requests: 3, tokens: 1200, actualCostMinor: 45, estimatedCostMinor: 50 },
    byTask: overrides?.byTask ?? [
      { task: "chat", requests: 2, tokens: 900, actualCostMinor: 30 },
      { task: "review_apu", requests: 1, tokens: 300, actualCostMinor: 15 },
    ],
    byProvider: overrides?.byProvider ?? [
      { provider: "OPENROUTER", model: "openrouter/free", requests: 3, tokens: 1200, actualCostMinor: 45 },
    ],
    bySource: overrides?.bySource ?? [
      { credentialSource: "PLATFORM", billingScope: "PLATFORM", requests: 3, tokens: 1200, actualCostMinor: 45 },
    ],
  };
}

const USERS = [
  { userId: "user-1", name: "Ana", email: "ana@example.com" },
  { userId: "user-2", name: "Bruno", email: "bruno@example.com" },
];

describe("AdminAiUsageDrilldown", () => {
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
    vi.restoreAllMocks();
  });

  async function renderCard() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    const root = createRoot(container);
    (container as HTMLDivElement & { __root?: typeof root }).__root = root;
    await act(async () => {
      root.render(<AdminAiUsageDrilldown users={USERS} />);
    });
    return { container, root };
  }

  function readSelect(container: HTMLDivElement) {
    const select = container.querySelector("select");
    return select as HTMLSelectElement | null;
  }

  async function setDateInput(input: HTMLInputElement, value: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("loads the global report on mount and renders the user filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => createReportPayload() });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/ai-usage", expect.objectContaining({ cache: "no-store" }));
    expect(container.textContent).toContain("Detalle de consumo IA");
    expect(container.textContent).toContain("Todos los usuarios");
    expect(container.textContent).toContain("Ana");
    expect(container.textContent).toContain("chat");
    expect(container.textContent).toContain("OPENROUTER");
    expect(container.textContent).toContain("PLATFORM · PLATFORM");
  });

  it("refetches with the userId filter when a user is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => createReportPayload() });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    const select = readSelect(container);
    expect(select).toBeTruthy();
    await act(async () => {
      select!.value = "user-1";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/ai-usage?userId=user-1",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(container.textContent).toContain("Mostrando consumo de");
    expect(container.textContent).toContain("Ana");
  });

  it("refetches with ISO from/to dates when a date range is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => createReportPayload() });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    const dateInputs = Array.from(container.querySelectorAll("input[type=date]"));
    expect(dateInputs.length).toBe(2);
    const [fromInput, toInput] = dateInputs as HTMLInputElement[];

    await setDateInput(fromInput, "2026-08-01");
    await setDateInput(toInput, "2026-08-15");

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/ai-usage?from=2026-08-01T00%3A00%3A00.000Z&to=2026-08-15T23%3A59%3A59.999Z",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(container.textContent).toContain("2026-08-01 → 2026-08-15");
  });

  it("combines the user filter with the date range", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => createReportPayload() });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    const select = readSelect(container);
    const [fromInput] = Array.from(container.querySelectorAll("input[type=date]")) as HTMLInputElement[];

    await act(async () => {
      select!.value = "user-2";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await setDateInput(fromInput, "2026-08-01");

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/ai-usage?userId=user-2&from=2026-08-01T00%3A00%3A00.000Z",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("shows the empty state when there is no consumption for the filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        createReportPayload({
          byTask: [],
          byProvider: [],
          bySource: [],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    expect(container.querySelectorAll("p.theme-dashed-panel").length).toBeGreaterThan(0);
  });

  it("surfaces fetch errors without crashing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "No autorizado" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    expect(container.textContent).toContain("No se pudo cargar el consumo de IA.");
  });
});
