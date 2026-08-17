/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourcePriceProviderAdminPanel } from "@/components/admin/resource-price-provider-admin-panel";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const config = {
  provider: "mc-presupuestos-price-api",
  status: "DISABLED",
  baseUrl: "https://price-api.test",
  apiVersion: "v1",
  credentialConfigured: true,
  credentialMasked: "tok...123",
  timeoutMs: 8000,
  maxBatchSize: 50,
  defaultTtlHours: 24,
  allowFallback: false,
  lastHealthCheckAt: null,
  lastHealthStatus: null,
};

describe("ResourcePriceProviderAdminPanel", () => {
  afterEach(async () => {
    if (activeContainer) {
      const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
      if (root) await act(async () => root.unmount());
      activeContainer.remove();
      activeContainer = null;
    }
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("loads the first-party provider without exposing the credential", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => config });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText } = await renderPanel();

    expect(getByText("Proveedor principal de precios")).toBeTruthy();
    expect(getByText("MC Presupuestos Price API")).toBeTruthy();
    expect(getByText("tok...123")).toBeTruthy();
    expect(document.body.textContent).toContain("mc-presupuestos-price-api");
    expect(document.body.textContent).not.toContain("token-productivo");
  });

  it("preserves the stored credential when saving with an empty credential field", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => config })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...config, status: "HEALTHY" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText } = await renderPanel();

    await act(async () => {
      getButtonByText("Guardar configuración").click();
      await Promise.resolve();
    });

    const saveCall = fetchMock.mock.calls[1];
    expect(saveCall[0]).toBe("/api/admin/resource-price-provider-config");
    const body = JSON.parse(saveCall[1]?.body as string) as Record<string, unknown>;
    expect(body.provider).toBe("mc-presupuestos-price-api");
    expect(body.credential).toBeUndefined();
  });

  it("runs the health check against the configured provider only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => config })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, latencyMs: 42 }) });
    vi.stubGlobal("fetch", fetchMock);

    const { getButtonByText } = await renderPanel();
    await act(async () => {
      getButtonByText("Probar conexión").click();
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/admin/resource-price-providers/mc-presupuestos-price-api/test");
  });
});

async function renderPanel() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;
  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<ResourcePriceProviderAdminPanel canManage />);
    await Promise.resolve();
  });

  return {
    getByText: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing text: ${text}`);
      return element;
    },
    getButtonByText: (text: string) => {
      const element = [...document.body.querySelectorAll("button")].find((candidate) => candidate.textContent?.trim() === text);
      if (!(element instanceof HTMLButtonElement)) throw new Error(`Missing button: ${text}`);
      return element;
    },
  };
}
