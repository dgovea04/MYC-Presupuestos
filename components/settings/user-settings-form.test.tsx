/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    disabled,
    id,
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
      data-testid={id}
      disabled={disabled}
      id={id}
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
    formatCurrency: vi.fn((value: number, currency: string, decimals: number) => `${currency}:${decimals}:${value}`),
    formatDate: vi.fn((_value: string | Date | null | undefined, dateFormat?: string) => `DATE:${dateFormat ?? "DD_MMM_YYYY"}`),
  };
});

vi.mock("@/lib/settings/budget-rate-percentages", () => ({
  formatBudgetRatePercentageInput: vi.fn((rate: number) => String(rate * 100)),
  parseBudgetRatePercentageInput: vi.fn((value: string) => Number(value) / 100),
}));

import { UserSettingsForm } from "@/components/settings/user-settings-form";
import { formatBudgetRatePercentageInput, parseBudgetRatePercentageInput } from "@/lib/settings/budget-rate-percentages";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_INITIAL_SUB_BUDGET_NAMES } from "@/types/settings";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("UserSettingsForm", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

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
  });

  it("submits changed currency and selected currency decimals", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const { form, getInput, getSelect, getText } = await renderForm(
      <UserSettingsForm
        initialSettings={{
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
        }}
      />,
    );

    expect(formatCurrency).toHaveBeenCalledWith(7723.48, "PEN", 2);
    expect(formatBudgetRatePercentageInput).toHaveBeenCalledWith(0.18);
    expect(formatBudgetRatePercentageInput).toHaveBeenCalledWith(0.1);
    expect(formatBudgetRatePercentageInput).toHaveBeenCalledWith(0.08);
    expect(getText(/PEN:2:7723\.48/)).toBeTruthy();
    expect(getSelect("currencyDecimals").value).toBe("2");
    expect(getSelect("dateFormat").value).toBe("DD_MMM_YYYY");
    expect(getSelect("currencyDecimals").disabled).toBe(false);

    await act(async () => {
      getSelect("defaultCurrency").value = "USD";
      getSelect("defaultCurrency").dispatchEvent(new Event("change", { bubbles: true }));
      getSelect("currencyDecimals").value = "3";
      getSelect("currencyDecimals").dispatchEvent(new Event("change", { bubbles: true }));
      getSelect("dateFormat").value = "DD_MM_YYYY";
      getSelect("dateFormat").dispatchEvent(new Event("change", { bubbles: true }));
      updateInputValue(getInput("defaultIgvRate"), "19");
      updateInputValue(getInput("defaultGeneralExpensesRate"), "12.5");
      updateInputValue(getInput("defaultUtilityRate"), "9");
      updateInputValue(getInput("defaultSubBudgetName-0"), "Movimiento de tierras");
    });

    expect(formatCurrency).toHaveBeenLastCalledWith(7723.48, "USD", 3);
    expect(getText(/USD:3:7723\.48/)).toBeTruthy();

    await act(async () => {
      form.requestSubmit();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultCurrency: "USD",
        currencyDecimals: 3,
        dateFormat: "DD_MM_YYYY",
        defaultIgvRate: 0.19,
        defaultGeneralExpensesRate: 0.125,
        defaultUtilityRate: 0.09,
        defaultSubBudgetNames: [
          "Movimiento de tierras",
          DEFAULT_INITIAL_SUB_BUDGET_NAMES[1],
          DEFAULT_INITIAL_SUB_BUDGET_NAMES[2],
          DEFAULT_INITIAL_SUB_BUDGET_NAMES[3],
        ],
      }),
    });
    expect(parseBudgetRatePercentageInput).toHaveBeenCalledWith("19");
    expect(parseBudgetRatePercentageInput).toHaveBeenCalledWith("12.5");
    expect(parseBudgetRatePercentageInput).toHaveBeenCalledWith("9");
  });

  it("shows an actionable client-side error when a percentage cannot be parsed", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(parseBudgetRatePercentageInput).mockImplementation((value: string) => {
      if (value === "abc") {
        throw new Error("Budget rate percentage must be a valid number");
      }

      return Number(value) / 100;
    });

    const { form, getInput, getText } = await renderForm(
      <UserSettingsForm
        initialSettings={{
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
        }}
      />,
    );

    await act(async () => {
      updateInputValue(getInput("defaultIgvRate"), "abc");
    });

    await act(async () => {
      form.requestSubmit();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getText(/IGV: Ingresa un porcentaje válido entre 0 y 100\./)).toBeTruthy();
  });

  it("keeps pending state safe and shows a fallback error on failed non-JSON responses", async () => {
    let resolveFetch: ((value: { ok: boolean; json: () => Promise<never> }) => void) | null = null;
    const fetchMock = vi.fn(
      () =>
        new Promise<{ ok: boolean; json: () => Promise<never> }>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { form, getButton, getInput, getSelect, getText } = await renderForm(
      <UserSettingsForm
        initialSettings={{
          defaultCurrency: "USD",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
        }}
      />,
    );

    await act(async () => {
      form.requestSubmit();
    });

    expect(getButton(/Guardando/)).toBeTruthy();
    expect(getSelect("defaultCurrency").disabled).toBe(true);
    expect(getSelect("currencyDecimals").disabled).toBe(true);
    expect(getSelect("dateFormat").disabled).toBe(true);
    expect(getInput("defaultIgvRate").disabled).toBe(true);
    expect(getInput("defaultGeneralExpensesRate").disabled).toBe(true);
    expect(getInput("defaultUtilityRate").disabled).toBe(true);
    expect(getInput("defaultSubBudgetName-0").disabled).toBe(true);

    await act(async () => {
      resolveFetch?.({
        ok: false,
        json: async () => {
          throw new Error("invalid json");
        },
      });
    });

    expect(getText(/No se pudo guardar la configuración/)).toBeTruthy();
    expect(getSelect("defaultCurrency").disabled).toBe(false);
    expect(getSelect("currencyDecimals").disabled).toBe(false);
    expect(getSelect("dateFormat").disabled).toBe(false);
    expect(getInput("defaultIgvRate").disabled).toBe(false);
    expect(getInput("defaultGeneralExpensesRate").disabled).toBe(false);
    expect(getInput("defaultUtilityRate").disabled).toBe(false);
    expect(getInput("defaultSubBudgetName-0").disabled).toBe(false);
    expect(getButton(/Guardar configuración/)).toBeTruthy();
  });

  it("allows adding and removing initial sub budgets from the table before submit", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const { form, getButton, getInput, getDeleteButtons } = await renderForm(
      <UserSettingsForm
        initialSettings={{
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Estructuras", "Arquitectura"],
        }}
      />,
    );

    await act(async () => {
      getButton(/Agregar especialidad/).click();
    });

    await act(async () => {
      updateInputValue(getInput("defaultSubBudgetName-2"), "Instalaciones");
      getDeleteButtons()[0]?.click();
    });

    await act(async () => {
      form.requestSubmit();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: "DD_MMM_YYYY",
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: ["Arquitectura", "Instalaciones"],
      }),
    });
  });

  it("restores the recommended base list before submit", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const { form, getButton, getInput } = await renderForm(
      <UserSettingsForm
        initialSettings={{
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Obras preliminares"],
        }}
      />,
    );

    expect(getInput("defaultSubBudgetName-0").value).toBe("Obras preliminares");

    await act(async () => {
      getButton(/Restaurar base/).click();
    });

    expect(getInput("defaultSubBudgetName-0").value).toBe(DEFAULT_INITIAL_SUB_BUDGET_NAMES[0]);

    await act(async () => {
      form.requestSubmit();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: "DD_MMM_YYYY",
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
      }),
    });
  });

  it("disables restore when the table already matches the recommended base list", async () => {
    const { getButton, getInput, getText, queryText } = await renderForm(
      <UserSettingsForm
        initialSettings={{
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: DEFAULT_INITIAL_SUB_BUDGET_NAMES,
        }}
      />,
    );

    expect(getButton(/Restaurar base/).disabled).toBe(true);
    expect(getText(/Usando lista base/)).toBeTruthy();

    await act(async () => {
      updateInputValue(getInput("defaultSubBudgetName-0"), "Base modificada");
    });

    expect(getButton(/Restaurar base/).disabled).toBe(false);
    expect(queryText(/Usando lista base/)).toBeNull();
  });

  it("reorders initial sub budgets by dragging rows before submit", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const { form, getRows } = await renderForm(
      <UserSettingsForm
        initialSettings={{
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Estructuras", "Arquitectura", "Instalaciones"],
        }}
      />,
    );

    await act(async () => {
      getRows()[0]?.dispatchEvent(new Event("dragstart", { bubbles: true }));
    });

    await act(async () => {
      getRows()[2]?.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
      getRows()[2]?.dispatchEvent(new Event("drop", { bubbles: true }));
    });

    await act(async () => {
      getRows()[0]?.dispatchEvent(new Event("dragend", { bubbles: true }));
    });

    await act(async () => {
      form.requestSubmit();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: "DD_MMM_YYYY",
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: ["Arquitectura", "Instalaciones", "Estructuras"],
      }),
    });
  });
});

async function renderForm(node: React.ReactNode) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(node);
  });

  const form = nextContainer.querySelector("form");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Missing form");
  }

  return {
    form,
    getButton: (pattern: RegExp) => {
      const element = [...nextContainer.querySelectorAll("button")].find((candidate) => pattern.test(candidate.textContent ?? ""));

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing button matching ${pattern.source}`);
      }

      return element;
    },
    getDeleteButtons: () =>
      [...nextContainer.querySelectorAll('button[aria-label="Eliminar"]')].filter(
        (element): element is HTMLButtonElement => element instanceof HTMLButtonElement,
      ),
    getRows: () =>
      [...nextContainer.querySelectorAll("tbody tr")].filter(
        (element): element is HTMLTableRowElement => element instanceof HTMLTableRowElement,
      ),
    getSelect: (id: string) => {
      const element = nextContainer.querySelector(`select#${id}`);

      if (!(element instanceof HTMLSelectElement)) {
        throw new Error(`Missing select ${id}`);
      }

      return element;
    },
    getInput: (id: string) => {
      const element = nextContainer.querySelector(`input#${id}`);

      if (!(element instanceof HTMLInputElement)) {
        throw new Error(`Missing input ${id}`);
      }

      return element;
    },
    getText: (pattern: RegExp) => {
      const element = [...nextContainer.querySelectorAll("*")].find((candidate) => pattern.test(candidate.textContent ?? ""));

      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing text matching ${pattern.source}`);
      }

      return element;
    },
    queryText: (pattern: RegExp) => {
      const element = [...nextContainer.querySelectorAll("*")].find((candidate) => pattern.test(candidate.textContent ?? ""));
      return element instanceof HTMLElement ? element : null;
    },
  };
}

function updateInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  if (!valueSetter) {
    throw new Error("Missing HTMLInputElement value setter");
  }

  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
