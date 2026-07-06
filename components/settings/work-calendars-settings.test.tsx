/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkCalendarsSettings } from "@/components/settings/work-calendars-settings";

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MOCK_CALENDAR_A = {
  id: "cal-1",
  name: "Lun-Vie 8h",
  workDays: 31,
  workHoursPerDay: 8,
};

const MOCK_CALENDAR_B = {
  id: "cal-2",
  name: "Lun-Sab 6h",
  workDays: 63,
  workHoursPerDay: 6,
};

const MOCK_EXCEPTIONS = [
  {
    id: "exc-1",
    workCalendarId: "cal-1",
    date: "2026-07-28",
    type: "HOLIDAY" as const,
    description: "Fiestas Patrias",
  },
  {
    id: "exc-2",
    workCalendarId: "cal-1",
    date: "2026-12-25",
    type: "HOLIDAY" as const,
    description: "Navidad",
  },
];

async function renderComponent({ initialCalendars }: { initialCalendars?: typeof MOCK_CALENDAR_A[] } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

  await act(async () => {
    root.render(<WorkCalendarsSettings initialCalendars={initialCalendars} />);
  });

  // Flush any pending effects (e.g. initial fetch in useEffect)
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
    clickButton: async (text: string) => {
      const button = [...document.body.querySelectorAll("button")].find(
        (candidate) => candidate.textContent?.trim() === text,
      );
      if (!button) throw new Error(`Missing button: ${text}`);
      await act(async () => {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });
    },
    setInputValue: async (input: HTMLElement, value: string) => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await act(async () => {
        await Promise.resolve();
      });
    },
    container,
  };
}

describe("WorkCalendarsSettings", () => {
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

  describe("Initial loading and rendering", () => {
    it("shows the title and description", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [MOCK_CALENDAR_A],
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText } = await renderComponent();

      expect(getByText("Calendarios laborales")).toBeTruthy();
      expect(
        getByText(
          "Define calendarios personalizados con los dias y horas laborables. Asignalos a tus proyectos desde el formulario de creacion o edicion.",
        ),
      ).toBeTruthy();
    });

    it("shows a spinner while loading then renders calendars", async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      const fetchMock = vi.fn().mockReturnValue(fetchPromise);
      vi.stubGlobal("fetch", fetchMock);

      const container = document.createElement("div");
      document.body.appendChild(container);
      activeContainer = container;
      const root = createRoot(container);
      (container as HTMLDivElement & { __root?: ReturnType<typeof createRoot> }).__root = root;

      await act(async () => {
        root.render(<WorkCalendarsSettings />);
      });

      // Should show spinner before fetch resolves
      expect(container.querySelector(".animate-spin")).toBeTruthy();

      // Resolve fetch
      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => [MOCK_CALENDAR_A],
        });
      });
      await act(async () => {
        await Promise.resolve();
      });

      // Spinner gone, calendar name visible
      expect(container.querySelector(".animate-spin")).toBeFalsy();
      expect(container.textContent).toContain("Lun-Vie 8h");
    });

    it("shows empty state when no calendars exist", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText } = await renderComponent();

      expect(getByText("Sin calendarios personalizados")).toBeTruthy();
      expect(
        getByText("Crea tu primer calendario laboral para asignarlo a tus proyectos."),
      ).toBeTruthy();
    });

    it("shows error when fetch fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Error de conexion" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText } = await renderComponent();

      expect(getByText("Error de conexion")).toBeTruthy();
    });
  });

  describe("Creating a calendar", () => {
    it("shows the create form when 'Crear calendario' is clicked", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText, clickButton } = await renderComponent();

      expect(getByText("Sin calendarios personalizados")).toBeTruthy();

      await clickButton("Crear calendario");

      expect(getByText("Nuevo calendario")).toBeTruthy();
    });

    it("creates a calendar via POST on save", async () => {
      let callCount = 0;
      const fetchMock = vi.fn((url: string, options?: RequestInit) => {
        callCount++;
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => MOCK_CALENDAR_A,
          });
        }
        // First GET returns empty, second GET (reload) returns [A]
        if (callCount <= 1) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [MOCK_CALENDAR_A],
        });
      });

      vi.stubGlobal("fetch", fetchMock);

      const { clickButton, setInputValue, getByText } = await renderComponent();

      await clickButton("Crear calendario");
      expect(getByText("Nuevo calendario")).toBeTruthy();

      // Fill name
      const nameInput = document.querySelector<HTMLInputElement>("input[placeholder='Ej: Lun-Vie 8h']");
      if (!nameInput) throw new Error("Missing name input");
      await setInputValue(nameInput, "Mi Calendario");

      // Click "Crear"
      await clickButton("Crear");

      // Verify POST was called with correct body
      const postCalls = fetchMock.mock.calls.filter((call) => call[1]?.method === "POST");
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
      const postBody = JSON.parse(postCalls[0][1]!.body as string);
      expect(postBody.name).toBe("Mi Calendario");
      expect(postBody.workDays).toBe(31);

      // Reload happpens, calendar appears in list
      expect(getByText("Lun-Vie 8h")).toBeTruthy();
    });

    it("shows validation errors for empty name", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      vi.stubGlobal("fetch", fetchMock);

      const { clickButton, getByText } = await renderComponent();
      await clickButton("Crear calendario");
      await clickButton("Crear");

      expect(getByText("El nombre del calendario es requerido")).toBeTruthy();
    });
  });

  describe("Editing a calendar", () => {
    it("opens edit form when edit button is clicked", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [MOCK_CALENDAR_A],
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText, clickButton } = await renderComponent();

      // Click the edit button
      const editButton = [...document.querySelectorAll("button")].find(
        (b) => b.querySelector("svg") && b.getAttribute("title") === "Editar",
      );
      if (!editButton) throw new Error("Missing edit button");
      await act(async () => {
        editButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(getByText("Editar calendario")).toBeTruthy();
    });

    it("sends PATCH request when saving edited calendar", async () => {
      const initialGet = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [MOCK_CALENDAR_A, MOCK_CALENDAR_B],
      });
      const patch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...MOCK_CALENDAR_A, name: "Editado" }),
      });
      const reloadGet = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ ...MOCK_CALENDAR_A, name: "Editado" }, MOCK_CALENDAR_B],
      });

      let callCount = 0;
      const fetchMock = vi.fn((url: string, options?: RequestInit) => {
        callCount++;
        if (options?.method === "PATCH") return patch(url, options);
        // First GET returns initial, subsequent GET returns reloaded
        if (callCount <= 1) return initialGet();
        return reloadGet();
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText, setInputValue, clickButton } = await renderComponent();

      // Click edit button on first calendar
      const editButton = [...document.querySelectorAll("button")].find(
        (b) => b.querySelector("svg") && b.getAttribute("title") === "Editar",
      );
      if (!editButton) throw new Error("Missing edit button");
      await act(async () => {
        editButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(getByText("Editar calendario")).toBeTruthy();

      // Change name
      const nameInput = document.querySelector<HTMLInputElement>("input[placeholder='Ej: Lun-Vie 8h']");
      if (!nameInput) throw new Error("Missing name input");
      await setInputValue(nameInput, "Editado");

      // Click "Guardar"
      await clickButton("Guardar");

      // Verify PATCH was called with correct body and id
      const patchCalls = fetchMock.mock.calls.filter((call) => call[1]?.method === "PATCH");
      expect(patchCalls.length).toBeGreaterThanOrEqual(1);
      const patchUrl = patchCalls[0][0] as string;
      expect(patchUrl).toContain("cal-1");
      const patchBody = JSON.parse(patchCalls[0][1]!.body as string);
      expect(patchBody.name).toBe("Editado");
    });

    it("cancels editing and returns to view mode", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [MOCK_CALENDAR_A],
      });
      vi.stubGlobal("fetch", fetchMock);

      const { clickButton } = await renderComponent();

      // Open edit
      const editButton = [...document.querySelectorAll("button")].find(
        (b) => b.querySelector("svg") && b.getAttribute("title") === "Editar",
      );
      if (!editButton) throw new Error("Missing edit button");
      await act(async () => {
        editButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      // Click cancel
      await clickButton("Cancelar");

      // Should show "Crear calendario" button again (not in editing mode)
      expect(document.body.textContent).toContain("Crear calendario");
    });
  });

  describe("Deleting a calendar", () => {
    it("requires confirmation before deleting", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [MOCK_CALENDAR_A],
      });
      vi.stubGlobal("fetch", fetchMock);

      await renderComponent();

      const deleteButton = [...document.querySelectorAll("button")].find(
        (b) => b.querySelector("svg") && b.getAttribute("title") === "Eliminar",
      );
      if (!deleteButton) throw new Error("Missing delete button");

      await act(async () => {
        deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      const confirmButton = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Eliminar",
      );

      expect(confirmButton).toBeTruthy();
      // There should be a cancel option too
      expect(document.body.textContent).toContain("Cancelar");
    });

    it("sends DELETE request on confirmation", async () => {
      let callCount = 0;
      const deleteFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });
      const fetchMock = vi.fn((url: string, options?: RequestInit) => {
        callCount++;
        if (options?.method === "DELETE") return deleteFn(url, options);
        // First GET returns [A], after delete returns []
        if (callCount <= 1) {
          return Promise.resolve({
            ok: true,
            json: async () => [MOCK_CALENDAR_A],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const { clickButton } = await renderComponent();

      // Click delete
      const deleteButton = [...document.querySelectorAll("button")].find(
        (b) => b.querySelector("svg") && b.getAttribute("title") === "Eliminar",
      );
      if (!deleteButton) throw new Error("Missing delete button");
      await act(async () => {
        deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      // Click confirm
      await clickButton("Eliminar");

      // Verify DELETE was called with correct id
      const deleteCalls = fetchMock.mock.calls.filter((call) => call[1]?.method === "DELETE");
      expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
      const deleteUrl = deleteCalls[0][0] as string;
      expect(deleteUrl).toContain("cal-1");

      // Empty state shows after reload
      expect(document.body.textContent).toContain("Sin calendarios personalizados");
    });
  });

  describe("Exceptions", () => {
    it("expands the exceptions section when the exceptions button is clicked", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [MOCK_CALENDAR_A],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => MOCK_EXCEPTIONS,
        });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText } = await renderComponent();

      const exceptionsButton = [...document.querySelectorAll("button")].find(
        (b) => b.querySelector("svg") && b.getAttribute("title") === "Excepciones",
      );
      if (!exceptionsButton) throw new Error("Missing exceptions button");
      await act(async () => {
        exceptionsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(getByText("Excepciones (2)")).toBeTruthy();
      expect(getByText("2026-07-28")).toBeTruthy();
      expect(getByText("2026-12-25")).toBeTruthy();
      expect(getByText("Fiestas Patrias")).toBeTruthy();
      expect(getByText("Navidad")).toBeTruthy();
    });

    it("shows the add exception form when 'Agregar' is clicked", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [MOCK_CALENDAR_A],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => MOCK_EXCEPTIONS,
        });
      vi.stubGlobal("fetch", fetchMock);

      const { clickButton, getByText } = await renderComponent();

      const exceptionsButton = [...document.querySelectorAll("button")].find(
        (b) => b.querySelector("svg") && b.getAttribute("title") === "Excepciones",
      );
      if (!exceptionsButton) throw new Error("Missing exceptions button");
      await act(async () => {
        exceptionsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      await clickButton("Agregar");

      expect(getByText("Guardar")).toBeTruthy();
    });
  });

  describe("CalendarEditCard", () => {
    it("renders day toggle buttons with correct active state", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      vi.stubGlobal("fetch", fetchMock);

      await renderComponent();
      const createButton = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Crear calendario",
      );
      if (!createButton) throw new Error("Missing create button");
      await act(async () => {
        createButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      // By default (Mon-Fri = 31), Lun should be active (sky), Sab should be inactive
      const dayButtons = [...document.querySelectorAll("button")].filter((b) =>
        ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].includes(b.textContent?.trim() ?? ""),
      );

      const lun = dayButtons.find((b) => b.textContent?.trim() === "Lun");
      const sab = dayButtons.find((b) => b.textContent?.trim() === "Sab");

      expect(lun?.className).toContain("sky");
      expect(sab?.className).not.toContain("sky");
    });

    it("shows hours per day input", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText } = await renderComponent();
      const createButton = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Crear calendario",
      );
      if (!createButton) throw new Error("Missing create button");
      await act(async () => {
        createButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(getByText("Horas por dia")).toBeTruthy();
      const hoursInput = document.querySelector<HTMLInputElement>("input[type='number']");
      expect(hoursInput).toBeTruthy();
      expect(hoursInput?.value).toBe("8");
    });
  });

  describe("Validation", () => {
    it("rejects hours outside valid range", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });
      vi.stubGlobal("fetch", fetchMock);

      const { getByText, setInputValue, clickButton } = await renderComponent();

      await clickButton("Crear calendario");

      const nameInput = document.querySelector<HTMLInputElement>("input[placeholder='Ej: Lun-Vie 8h']");
      if (!nameInput) throw new Error("Missing name input");
      await setInputValue(nameInput, "Test");

      // Set hours to 99
      const hoursInput = document.querySelector<HTMLInputElement>("input[type='number']");
      if (!hoursInput) throw new Error("Missing hours input");
      await setInputValue(hoursInput, "99");

      await clickButton("Crear");

      expect(getByText("Horas por dia debe ser entre 0.5 y 24")).toBeTruthy();
    });
  });
});
