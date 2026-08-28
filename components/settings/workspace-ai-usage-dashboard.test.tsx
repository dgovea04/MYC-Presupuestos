/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceAiUsageDashboard } from "@/components/settings/workspace-ai-usage-dashboard";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function createReportPayload(overrides?: { byUser?: unknown[] }) {
  return {
    summary: { requests: 3, tokens: 1200, actualCostMinor: 45 },
    byProvider: [
      { provider: "OPENROUTER", model: "openrouter/free", requests: 3, tokens: 1200, actualCostMinor: 45 },
    ],
    bySource: [
      { credentialSource: "PLATFORM", billingScope: "PLATFORM", requests: 3, tokens: 1200, actualCostMinor: 45 },
    ],
    byUser:
      overrides?.byUser ?? [
        { userId: "user-1", name: "Ana", email: "ana@example.com", requests: 2, tokens: 900, actualCostMinor: 30 },
        { userId: "user-2", name: "Bruno", email: "bruno@example.com", requests: 1, tokens: 300, actualCostMinor: 15 },
      ],
  };
}

describe("WorkspaceAiUsageDashboard", () => {
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
      root.render(<WorkspaceAiUsageDashboard workspaceId="ws-1" />);
    });
    return { container };
  }

  function readSelects(container: HTMLDivElement) {
    const selects = Array.from(container.querySelectorAll("select"));
    return { provider: selects[0] as HTMLSelectElement | null, user: selects[1] as HTMLSelectElement | null };
  }

  it("loads the workspace report and populates the user dropdown from the breakdown", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => createReportPayload() });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ai-usage?workspaceId=ws-1",
      expect.objectContaining({ cache: "no-store" }),
    );
    const { user } = readSelects(container);
    expect(user).toBeTruthy();
    expect(container.textContent).toContain("Ana");
    expect(container.textContent).toContain("Bruno");
    expect(container.textContent).toContain("Consumo por usuario");
  });

  it("refetches with the userId filter when a user is selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => createReportPayload() });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    const { user } = readSelects(container);
    expect(user).toBeTruthy();
    await act(async () => {
      user!.value = "user-1";
      user!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/ai-usage?workspaceId=ws-1&userId=user-1",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(container.textContent).toContain("Mostrando consumo de Ana");
  });

  it("refetches with from/to dates when a date range is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => createReportPayload() });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    const dateInputs = Array.from(container.querySelectorAll("input[type=date]")) as HTMLInputElement[];
    expect(dateInputs.length).toBe(2);

    const setValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    await act(async () => {
      setValue(dateInputs[0], "2026-08-01");
    });
    await act(async () => {
      setValue(dateInputs[1], "2026-08-31");
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/ai-usage?workspaceId=ws-1&from=2026-08-01T00%3A00%3A00.000Z&to=2026-08-31T23%3A59%3A59.999Z",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps the user options stable when filtering by user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => createReportPayload() });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = await renderCard();

    const { user } = readSelects(container);
    await act(async () => {
      user!.value = "user-1";
      user!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const options = Array.from(user!.options).map((option) => option.value);
    expect(options).toContain("user-1");
    expect(options).toContain("user-2");
  });
});
