/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfImportAiSettingsCard } from "@/components/settings/pdf-import-ai-settings-card";

describe("PdfImportAiSettingsCard", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/settings/ai-provider" && !init) {
        return new Response(JSON.stringify({
          pdfImportProvider: "openai",
          openaiConfigured: true,
          geminiConfigured: true,
          openrouterConfigured: false,
        }), { status: 200 });
      }

      return new Response(JSON.stringify({
        pdfImportProvider: "openrouter",
        openaiConfigured: true,
        geminiConfigured: true,
        openrouterConfigured: true,
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("persists the PDF provider without changing Khipu's provider setting", async () => {
    await act(async () => {
      root.render(<PdfImportAiSettingsCard />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    const openrouterButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("OpenRouter"));
    expect(openrouterButton).toBeTruthy();

    await act(async () => {
      openrouterButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const saveButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Guardar"));
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === "PUT");
    expect(putCall).toBeTruthy();
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({ pdfImportProvider: "openrouter" });
  });
});
