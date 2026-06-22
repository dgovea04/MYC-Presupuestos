/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onChange,
    value,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    id?: string;
    onChange?: (event: { target: { value: string } }) => void;
    value?: string;
  }) => (
    <select
      value={value}
      onChange={(event) => onChange?.({ target: { value: event.target.value } })}
    >
      {children}
    </select>
  ),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(" "),
  };
});

// ─── Imports ────────────────────────────────────────────────────

import { FloatingKhipuSettingsCard } from "@/components/settings/floating-khipu-settings-card";
import type { AiProviderPreference, FloatingKhipuFontSize, FloatingKhipuPosition, FloatingKhipuTheme } from "@/types/settings";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

// ─── Helpers ────────────────────────────────────────────────────

const baseSettings = {
  floatingKhipuProvider: "ollama" as AiProviderPreference,
  floatingKhipuWidth: 600,
  floatingKhipuHeight: 500,
  floatingKhipuFontSize: "normal" as FloatingKhipuFontSize,
  floatingKhipuPosition: "bottom-right" as FloatingKhipuPosition,
  floatingKhipuTheme: "light" as FloatingKhipuTheme,
  defaultCurrency: "PEN",
  currencyDecimals: 2,
  dateFormat: "DD_MMM_YYYY",
  appTheme: "light" as const,
  defaultViewMode: "modern",
  excelShowFieldBorders: true,
  excelRowHeight: 52,
  defaultIgvRate: 0.18,
  defaultGeneralExpensesRate: 0.1,
  defaultUtilityRate: 0.08,
  defaultSubBudgetNames: ["Estructuras", "Arquitectura"],
  aiProviderPreference: "auto" as AiProviderPreference,
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (activeContainer) {
    const root = (activeContainer as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root;
    if (root) {
      await act(async () => { root.unmount(); });
    }
    activeContainer.remove();
    activeContainer = null;
  }
});

async function renderCard(
  overrides: Partial<typeof baseSettings> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  const onSaved = vi.fn();

  await act(async () => {
    root.render(
      <FloatingKhipuSettingsCard
        settings={{ ...baseSettings, ...overrides }}
        onSaved={onSaved}
      />,
    );
  });

  const getSelect = (value: string) => {
    const element = [...container.querySelectorAll("select")].find(
      (candidate) => candidate.value === value,
    );
    if (!(element instanceof HTMLSelectElement)) {
      throw new Error(`Missing select with value=${value}`);
    }
    return element;
  };

  const getSelectOptions = (select: HTMLSelectElement) =>
    [...select.querySelectorAll("option")].map((opt) => opt.textContent);

  const getButton = (pattern: RegExp) => {
    const element = [...container.querySelectorAll("button")].find(
      (candidate) => pattern.test(candidate.textContent ?? ""),
    );
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error(`Missing button matching ${pattern.source}`);
    }
    return element;
  };

  const getInputByAriaLabel = (label: string) => {
    const elements = container.querySelectorAll(
      'input[type="number"]',
    );
    // In the card, width comes first, then height
    const inputs = [...elements].filter(
      (el): el is HTMLInputElement => el instanceof HTMLInputElement,
    );
    if (label === "width") return inputs[0];
    if (label === "height") return inputs[1];
    throw new Error(`Unknown input label: ${label}`);
  };

  const getText = (pattern: RegExp) => {
    const element = [...container.querySelectorAll("*")].find(
      (candidate) => pattern.test(candidate.textContent ?? ""),
    );
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing text matching ${pattern.source}`);
    }
    return element;
  };

  const queryText = (pattern: RegExp) => {
    const element = [...container.querySelectorAll("*")].find(
      (candidate) => pattern.test(candidate.textContent ?? ""),
    );
    return element instanceof HTMLElement ? element : null;
  };

  return { container, getSelect, getSelectOptions, getButton, getInputByAriaLabel, getText, queryText, onSaved };
}

function updateInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!valueSetter) throw new Error("Missing HTMLInputElement value setter");
  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// ─── Tests ──────────────────────────────────────────────────────

describe("FloatingKhipuSettingsCard", () => {
  describe("render", () => {
    it("renders the card title and description", async () => {
      const { getText } = await renderCard();

      expect(getText(/Panel flotante Khipu/)).toBeTruthy();
      expect(getText(/Configura el proveedor/)).toBeTruthy();
    });

    it("renders provider select with all options and initial value", async () => {
      const { getSelect, getSelectOptions } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      const select = getSelect("ollama");
      const options = getSelectOptions(select);
      expect(options).toContain("Ollama (local)");
      expect(options).toContain("Automático");
      expect(options).toContain("OpenAI");
      expect(select.value).toBe("ollama");
    });

    it("renders width and height inputs with correct initial values", async () => {
      const { getInputByAriaLabel } = await renderCard({
        floatingKhipuWidth: 500,
        floatingKhipuHeight: 400,
      });

      expect(getInputByAriaLabel("width").value).toBe("500");
      expect(getInputByAriaLabel("height").value).toBe("400");
    });

    it("renders font size select with all options and initial value", async () => {
      const { getSelect, getSelectOptions } = await renderCard({
        floatingKhipuFontSize: "normal",
      });

      const select = getSelect("normal");
      const options = getSelectOptions(select);
      expect(options).toContain("Compacto");
      expect(options).toContain("Normal");
      expect(options).toContain("Grande");
      expect(select.value).toBe("normal");
    });

    it("renders position select with all options and initial value", async () => {
      const { getSelect, getSelectOptions } = await renderCard({
        floatingKhipuPosition: "bottom-right",
      });

      const select = getSelect("bottom-right");
      const options = getSelectOptions(select);
      expect(options).toContain("Inferior derecha");
      expect(options).toContain("Superior izquierda");
      expect(select.value).toBe("bottom-right");
    });

    it("renders theme select with all options and initial value", async () => {
      const { getSelect, getSelectOptions } = await renderCard({
        floatingKhipuTheme: "light",
      });

      const select = getSelect("light");
      const options = getSelectOptions(select);
      expect(options).toContain("Claro");
      expect(options).toContain("Oscuro");
      expect(select.value).toBe("light");
    });

    it("renders the save button disabled when no changes", async () => {
      const { getButton } = await renderCard();

      const saveBtn = getButton(/Guardar configuración/);
      expect(saveBtn.disabled).toBe(true);
    });

    it("does not show error message initially", async () => {
      const { queryText } = await renderCard();

      expect(queryText(/Error al guardar/)).toBeNull();
    });
  });

  describe("changes", () => {
    it("enables save button when provider changes", async () => {
      const { getSelect, getButton } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      await act(async () => {
        const select = getSelect("ollama");
        select.value = "openai";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      expect(getButton(/Guardar configuración/).disabled).toBe(false);
    });

    it("enables save button when width changes", async () => {
      const { getInputByAriaLabel, getButton } = await renderCard({
        floatingKhipuWidth: 600,
      });

      await act(async () => {
        updateInputValue(getInputByAriaLabel("width"), "700");
      });

      expect(getButton(/Guardar configuración/).disabled).toBe(false);
    });

    it("enables save button when height changes", async () => {
      const { getInputByAriaLabel, getButton } = await renderCard({
        floatingKhipuHeight: 500,
      });

      await act(async () => {
        updateInputValue(getInputByAriaLabel("height"), "350");
      });

      expect(getButton(/Guardar configuración/).disabled).toBe(false);
    });

    it("enables save button when font size changes", async () => {
      const { getSelect, getButton } = await renderCard({
        floatingKhipuFontSize: "normal",
      });

      await act(async () => {
        const select = getSelect("normal");
        select.value = "compact";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      expect(getButton(/Guardar configuración/).disabled).toBe(false);
    });

    it("enables save button when position changes", async () => {
      const { getSelect, getButton } = await renderCard({
        floatingKhipuPosition: "bottom-right",
      });

      await act(async () => {
        const select = getSelect("bottom-right");
        select.value = "top-left";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      expect(getButton(/Guardar configuración/).disabled).toBe(false);
    });

    it("enables save button when theme changes", async () => {
      const { getSelect, getButton } = await renderCard({
        floatingKhipuTheme: "light",
      });

      await act(async () => {
        const select = getSelect("light");
        select.value = "dark";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      expect(getButton(/Guardar configuración/).disabled).toBe(false);
    });

    it("keeps save button disabled when value changes back to initial", async () => {
      const { getSelect, getButton } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      // Change to openai
      await act(async () => {
        const select = getSelect("ollama");
        select.value = "openai";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(getButton(/Guardar configuración/).disabled).toBe(false);

      // Change back
      await act(async () => {
        const select = getSelect("openai");
        select.value = "ollama";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      expect(getButton(/Guardar configuración/).disabled).toBe(true);
    });
  });

  describe("save", () => {
    it("sends correct payload and calls onSaved on success", async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({}),
      }));
      vi.stubGlobal("fetch", fetchMock);

      const { getSelect, getButton, onSaved } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      // Change provider
      await act(async () => {
        const select = getSelect("ollama");
        select.value = "openai";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Click save
      await act(async () => {
        getButton(/Guardar configuración/).click();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          appTheme: "light" as const,
          defaultViewMode: "modern",
          excelShowFieldBorders: true,
          excelRowHeight: 52,
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Estructuras", "Arquitectura"],
          aiProviderPreference: "auto",
          floatingKhipuProvider: "openai",
          floatingKhipuWidth: 600,
          floatingKhipuHeight: 500,
          floatingKhipuFontSize: "normal",
          floatingKhipuPosition: "bottom-right",
          floatingKhipuTheme: "light",
        }),
      });

      expect(onSaved).toHaveBeenCalledWith({
        floatingKhipuProvider: "openai",
        floatingKhipuWidth: 600,
        floatingKhipuHeight: 500,
        floatingKhipuFontSize: "normal",
        floatingKhipuPosition: "bottom-right",
        floatingKhipuTheme: "light",
      });
    });

    it("shows saving state during the request", async () => {
      let resolveFetch: ((value: { ok: boolean; json: () => Promise<unknown> }) => void) | null = null;
      const fetchMock = vi.fn(
        () =>
          new Promise<{ ok: boolean; json: () => Promise<unknown> }>((resolve) => {
            resolveFetch = resolve;
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const { getSelect, getButton } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      // Change provider to enable save
      await act(async () => {
        const select = getSelect("ollama");
        select.value = "gemini";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Click save
      await act(async () => {
        getButton(/Guardar configuración/).click();
      });

      // Should show saving state
      expect(getButton(/Guardando\.\.\./)).toBeTruthy();
      expect(getButton(/Guardando\.\.\./).disabled).toBe(true);

      // Resolve
      await act(async () => {
        resolveFetch?.({ ok: true, json: async () => ({}) });
      });

      // Should be back to normal
      expect(getButton(/Guardar configuración/)).toBeTruthy();
    });

    it("shows error message on failed response", async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Error del servidor" }),
      }));
      vi.stubGlobal("fetch", fetchMock);

      const { getSelect, getButton, getText } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      // Change and save
      await act(async () => {
        const select = getSelect("ollama");
        select.value = "openai";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await act(async () => {
        getButton(/Guardar configuración/).click();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(getText(/Error del servidor/)).toBeTruthy();
    });

    it("shows fallback error when response is not JSON", async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        json: async () => { throw new Error("invalid json"); },
      }));
      vi.stubGlobal("fetch", fetchMock);

      const { getSelect, getButton, getText } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      await act(async () => {
        const select = getSelect("ollama");
        select.value = "gemini";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await act(async () => {
        getButton(/Guardar configuración/).click();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(getText(/No se pudo guardar la configuración\./)).toBeTruthy();
    });

    it("shows fallback error on network failure", async () => {
      const fetchMock = vi.fn(async () => {
        throw new Error("Network error");
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getSelect, getButton, getText } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      await act(async () => {
        const select = getSelect("ollama");
        select.value = "openrouter";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await act(async () => {
        getButton(/Guardar configuración/).click();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(getText(/Network error/)).toBeTruthy();
    });

    it("does not call onSaved when save fails", async () => {
      const fetchMock = vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "bad" }),
      }));
      vi.stubGlobal("fetch", fetchMock);

      const { getSelect, getButton, onSaved } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      await act(async () => {
        const select = getSelect("ollama");
        select.value = "openai";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      await act(async () => {
        getButton(/Guardar configuración/).click();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(onSaved).not.toHaveBeenCalled();
    });

    it("clears previous error on subsequent save attempt", async () => {
      let callCount = 0;
      const fetchMock = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, json: async () => ({ error: "Error 1" }) };
        }
        return { ok: true, json: async () => ({}) };
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getSelect, getButton, getText, queryText } = await renderCard({
        floatingKhipuProvider: "ollama",
      });

      // First save - fails
      await act(async () => {
        const select = getSelect("ollama");
        select.value = "openai";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => {
        getButton(/Guardar configuración/).click();
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(getText(/Error 1/)).toBeTruthy();

      // Second save - succeeds, error cleared
      await act(async () => {
        const select = getSelect("openai");
        select.value = "gemini";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => {
        getButton(/Guardar configuración/).click();
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(queryText(/Error 1/)).toBeNull();
    });
  });
});
