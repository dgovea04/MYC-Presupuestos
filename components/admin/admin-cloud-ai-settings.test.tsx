/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminCloudAiSettings } from "@/components/admin/admin-cloud-ai-settings";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function createSettingsPayload(overrides?: {
  openaiConfigured?: boolean;
  geminiConfigured?: boolean;
  openrouterConfigured?: boolean;
  openaiApiKeyMasked?: string;
  geminiApiKeyMasked?: string;
  openrouterApiKeyMasked?: string;
  openaiModel?: string;
  geminiModel?: string;
  openrouterModel?: string;
  agentModel?: string;
}) {
  return {
    openaiApiKeyMasked: overrides?.openaiApiKeyMasked ?? "sk-d...-key",
    geminiApiKeyMasked: overrides?.geminiApiKeyMasked ?? "ai-d...-key",
    openrouterApiKeyMasked: overrides?.openrouterApiKeyMasked ?? "sk-o...-key",
    openaiModel: overrides?.openaiModel ?? "gpt-5-mini",
    geminiModel: overrides?.geminiModel ?? "gemini-2.5-flash",
    openrouterModel: overrides?.openrouterModel ?? "deepseek/deepseek-chat-v3-0324:free",
    agentModel: overrides?.agentModel ?? "google/gemini-2.5-flash",
    openaiConfigured: overrides?.openaiConfigured ?? true,
    geminiConfigured: overrides?.geminiConfigured ?? true,
    openrouterConfigured: overrides?.openrouterConfigured ?? true,
  };
}

describe("AdminCloudAiSettings", () => {
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

  it("shows the clear (Trash2) button for OpenAI when openaiConfigured is true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createSettingsPayload({ openaiConfigured: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getClearOpenaiButton } = await renderCard();

    expect(getClearOpenaiButton()).toBeTruthy();
  });

  it("does NOT show the clear button for OpenAI when openaiConfigured is false", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createSettingsPayload({ openaiConfigured: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getClearOpenaiButton } = await renderCard();

    expect(getClearOpenaiButton()).toBeNull();
  });

  it("shows the clear (Trash2) button for Gemini when geminiConfigured is true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createSettingsPayload({ geminiConfigured: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getClearGeminiButton } = await renderCard();

    expect(getClearGeminiButton()).toBeTruthy();
  });

  it("does NOT show the clear button for Gemini when geminiConfigured is false", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createSettingsPayload({ geminiConfigured: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getClearGeminiButton } = await renderCard();

    expect(getClearGeminiButton()).toBeNull();
  });

  it("sends clear request with openaiApiKey empty and preserves model values", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => createSettingsPayload({ openaiConfigured: true, openaiModel: "custom-openai", geminiModel: "custom-gemini", agentModel: "google/gemini-2.5-flash" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => createSettingsPayload({ openaiConfigured: false, openaiModel: "custom-openai", geminiModel: "custom-gemini", agentModel: "google/gemini-2.5-flash" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { getClearOpenaiButton, getButtonByText } = await renderCard();

    // Step 1: click trash icon to show confirmation
    const clearButton = getClearOpenaiButton();
    expect(clearButton).toBeTruthy();

    await act(async () => {
      clearButton!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Step 2: click "Eliminar" confirmation button
    const confirmButton = getButtonByText("Eliminar");
    await act(async () => {
      confirmButton.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Second call should be the clear PUT request
    const putCallArgs = fetchMock.mock.calls[1];
    expect(putCallArgs[0]).toBe("/api/admin/system-settings");
    expect(putCallArgs[1]?.method).toBe("PUT");

    const body = JSON.parse(putCallArgs[1]?.body as string);
    expect(body.openaiApiKey).toBe("");
    expect(body.openaiModel).toBe("custom-openai");
    expect(body.geminiModel).toBe("custom-gemini");
    expect(body.agentModel).toBe("google/gemini-2.5-flash");
  });

  it("shows success message after clearing a key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => createSettingsPayload({ openaiConfigured: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => createSettingsPayload({ openaiConfigured: false }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { getClearOpenaiButton, getButtonByText, getByText } = await renderCard();

    // Step 1: click trash icon to show confirmation
    const clearButton = getClearOpenaiButton();
    await act(async () => {
      clearButton!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Step 2: click "Eliminar" confirmation button
    const confirmButton = getButtonByText("Eliminar");
    await act(async () => {
      confirmButton.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText("API key de OpenAI eliminada del sistema.")).toBeTruthy();
  });

  it("shows error message when clear request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => createSettingsPayload({ openaiConfigured: true }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "DB write error" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { getClearOpenaiButton, getButtonByText, getByText } = await renderCard();

    // Step 1: click trash icon to show confirmation
    const clearButton = getClearOpenaiButton();
    await act(async () => {
      clearButton!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Step 2: click "Eliminar" confirmation button
    const confirmButton = getButtonByText("Eliminar");
    await act(async () => {
      confirmButton.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getByText("DB write error")).toBeTruthy();
  });
});

async function renderCard() {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<AdminCloudAiSettings />);
  });

  // Wait for the useEffect fetch to resolve
  await act(async () => {
    await Promise.resolve();
  });

  return {
    getByText: (text: string) => {
      const element = [...document.body.querySelectorAll("*")].find(
        (candidate) => candidate.textContent?.trim() === text,
      );
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text: ${text}`);
      }
      return element;
    },
    getButtonByText: (text: string) => {
      const element = [...document.body.querySelectorAll("button")].find(
        (candidate) => candidate.textContent?.trim() === text,
      );
      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button: ${text}`);
      }
      return element;
    },
    getClearOpenaiButton: () => {
      // Find the OpenAI section header, then find the clear button within its parent card
      const openaiHeader = [...document.body.querySelectorAll("*")].find(
        (candidate) => candidate.textContent?.trim() === "OpenAI (ChatGPT API)",
      );
      if (!openaiHeader) return null;

      // Navigate up to the card div, then find the Trash2 button
      const cardDiv = openaiHeader.closest(".rounded-2xl");
      if (!cardDiv) return null;

      return (cardDiv.querySelector("button.text-rose-600") ?? null) as HTMLButtonElement | null;
    },
    getClearGeminiButton: () => {
      const geminiHeader = [...document.body.querySelectorAll("*")].find(
        (candidate) => candidate.textContent?.trim() === "Google Gemini API",
      );
      if (!geminiHeader) return null;

      const cardDiv = geminiHeader.closest(".rounded-2xl");
      if (!cardDiv) return null;

      return (cardDiv.querySelector("button.text-rose-600") ?? null) as HTMLButtonElement | null;
    },
  };
}
