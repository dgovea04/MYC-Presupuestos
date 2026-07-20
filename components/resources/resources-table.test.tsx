/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

type Suggestion = { code: string; label: string; score: number; source: string };
const suggestResourceIuCodesMock = vi.fn((..._args: unknown[]) => [] as Suggestion[]);

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onChange,
    value,
  }: {
    children: React.ReactNode;
    onChange?: (event: { target: { value: string } }) => void;
    value?: string;
  }) => (
    <select value={value} onChange={(event) => onChange?.({ target: { value: event.target.value } })}>
      {children}
    </select>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    readOnly,
  }: {
    value?: string | number;
    onChange?: (event: { target: { value: string } }) => void;
    placeholder?: string;
    readOnly?: boolean;
  }) => <input value={value ?? ""} onChange={onChange} placeholder={placeholder} readOnly={readOnly} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("@/components/ui/action-button", () => ({
  ActionButton: ({
    label,
    onClick,
    "data-resource-action": dataAction,
    "data-resource-id": dataId,
  }: {
    label: string;
    onClick?: () => void;
    "data-resource-action"?: string;
    "data-resource-id"?: string;
  }) => (
    <button onClick={onClick} data-resource-action={dataAction} data-resource-id={dataId}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({
    children,
    style,
  }: {
    children: React.ReactNode;
    style?: React.CSSProperties;
  }) => <table style={style}>{children}</table>,
  THead: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TR: React.forwardRef<HTMLTableRowElement, { children: React.ReactNode; style?: React.CSSProperties }>(function MockTR({ children, style }, ref) {
    return <tr ref={ref} style={style}>{children}</tr>;
  }),
  TH: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TD: ({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) => <td colSpan={colSpan}>{children}</td>,
}));

vi.mock("@/components/ui/virtualized-table-frame", () => ({
  VirtualizedTableFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  VirtualizedTableSpacerRow: () => null,
}));

vi.mock("@/components/ui/operational-surfaces", () => ({
  OperationalPanel: ({ controls }: { controls: React.ReactNode }) => <div>{controls}</div>,
  OperationalMetricBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/save-state-badge", () => ({
  SaveStateBadge: () => null,
}));

const viewModeState: { isExcelMode: boolean } = { isExcelMode: false };
const formattingSettingsState: { excelRowHeight: number } = { excelRowHeight: 74 };

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({ isExcelMode: viewModeState.isExcelMode }),
}));

vi.mock("@/components/view-mode/view-mode-styles", () => ({
  getTableFrameClassName: () => "table-frame",
  getTableViewportClassName: () => "table-viewport",
}));

vi.mock("@/components/providers/formatting-settings-provider", () => ({
  useFormattingSettings: () => ({ excelRowHeight: formattingSettingsState.excelRowHeight }),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(" "),
  };
});

vi.mock("@/lib/resources/iu", () => ({
  normalizeResourceIuCode: (value: string | null | undefined) => value?.trim() || "",
}));

vi.mock("@/lib/resources/iu-suggestions", () => ({
  suggestResourceIuCodes: (...args: unknown[]) => suggestResourceIuCodesMock(...args),
}));

import { ResourcesTable } from "@/components/resources/resources-table";
import type { ResourceRecord } from "@/types/resource";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

function makeResource(overrides: Partial<ResourceRecord> = {}): ResourceRecord {
  return {
    id: overrides.id ?? `r-${Math.random().toString(36).slice(2, 7)}`,
    code: overrides.code ?? "MAT-001",
    description: overrides.description ?? "Cemento Portland",
    category: overrides.category ?? "MATERIAL",
    unit: overrides.unit ?? "BOL",
    unitPrice: overrides.unitPrice ?? 25.5,
    currency: overrides.currency ?? "PEN",
    iu: overrides.iu ?? null,
    iuCurrent: overrides.iuCurrent ?? null,
    iuCurrentReviewStatus: overrides.iuCurrentReviewStatus ?? null,
    source: overrides.source ?? null,
    subcategory: overrides.subcategory ?? null,
    companyId: overrides.companyId ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  suggestResourceIuCodesMock.mockReset();
  suggestResourceIuCodesMock.mockReturnValue([]);
  viewModeState.isExcelMode = false;
  formattingSettingsState.excelRowHeight = 74;

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

async function renderTable(resources: ResourceRecord[] = []) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<ResourcesTable resources={resources} unifiedIndexDictionaryRows={[]} unifiedIndexRows={[]} />);
  });

  return {
    container,
    clickDeleteAction: (resourceId: string) => {
      const button = container.querySelector(`button[data-resource-action="delete"][data-resource-id="${resourceId}"]`);
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing delete action for ${resourceId}`);
      }
      button.click();
    },
    clickDialogButton: (label: string) => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (element) => element.textContent?.trim() === label,
      );
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing dialog button: ${label}`);
      }
      button.click();
    },
  };
}

describe("ResourcesTable", () => {
  it("renders the resource table", async () => {
    const { container } = await renderTable([makeResource({ id: "r-1" })]);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
  });

  it("renders one action set per resource row", async () => {
    const { container } = await renderTable([
      makeResource({ id: "r-1", description: "Cemento", source: "Indicopi" }),
      makeResource({ id: "r-2", description: "Arena", source: "Manual" }),
    ]);

    const editButtons = [...container.querySelectorAll("button")].filter((button) => button.textContent === "Editar");
    expect(editButtons).toHaveLength(2);
  });

  it("shows the empty state when there are no rows", async () => {
    const { container } = await renderTable();
    expect(container.textContent).toContain("No encontramos insumos con los filtros actuales.");
  });

  it("keeps only one compact suggestion control visible while editing a row", async () => {
    suggestResourceIuCodesMock.mockReturnValue([
      { code: "030101", label: "Acero estructural", score: 0.9, source: "dictionary" },
      { code: "030102", label: "Acero laminado", score: 0.8, source: "dictionary" },
      { code: "030103", label: "Acero corrugado", score: 0.7, source: "index" },
    ]);

    const { container } = await renderTable([
      makeResource({
        id: "r-1",
        companyId: "company-1",
        source: "Autocreado desde APU del catalogo de partidas",
        iuCurrent: null,
      }),
    ]);

    await act(async () => {
      const editButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Editar");
      editButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const suggestionButtons = [...container.querySelectorAll("button")].filter((button) => button.textContent?.includes("03010"));
    expect(suggestionButtons).toHaveLength(1);
    expect(suggestionButtons[0]?.textContent).toContain("030101");
    expect(suggestionButtons[0]?.textContent).toContain("+2");
  });

  // ─── Delete confirmation dialog ──────────────────────────────────────────

  it("opens the delete confirmation dialog when clicking Eliminar", async () => {
    const { clickDeleteAction } = await renderTable([
      makeResource({ id: "r-1", description: "Cemento Portland", companyId: "company-1" }),
    ]);

    expect(document.body.textContent).not.toContain("Eliminar insumo");

    await act(async () => {
      clickDeleteAction("r-1");
    });

    expect(document.body.textContent).toContain("Eliminar insumo");
    expect(document.body.textContent).toContain("Cemento Portland");
    expect(document.body.textContent).toContain("Esta accion no se puede deshacer");
    expect(document.body.textContent).toContain("Cancelar");
  });

  it("closes the delete dialog when clicking Cancelar", async () => {
    const { clickDeleteAction, clickDialogButton } = await renderTable([
      makeResource({ id: "r-1", description: "Cemento Portland", companyId: "company-1" }),
    ]);

    await act(async () => {
      clickDeleteAction("r-1");
    });

    expect(document.body.textContent).toContain("Eliminar insumo");

    await act(async () => {
      clickDialogButton("Cancelar");
    });

    expect(document.body.textContent).not.toContain("Eliminar insumo");
  });

  it("closes the delete dialog when clicking the X close button", async () => {
    const { clickDeleteAction } = await renderTable([
      makeResource({ id: "r-1", description: "Cemento Portland", companyId: "company-1" }),
    ]);

    await act(async () => {
      clickDeleteAction("r-1");
    });

    expect(document.body.textContent).toContain("Eliminar insumo");

    await act(async () => {
      const xButton = document.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement | null;
      if (!xButton) throw new Error("Missing X close button");
      xButton.click();
    });

    expect(document.body.textContent).not.toContain("Eliminar insumo");
  });

  it("sends PATCH delete request on confirm", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ created: [], updated: [], deleted: ["r-1"], savedAt: "2026-06-01T00:00:00.000Z" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton, container } = await renderTable([
      makeResource({ id: "r-1", description: "Cemento Portland", companyId: "company-1" }),
    ]);

    await act(async () => {
      clickDeleteAction("r-1");
    });

    expect(document.body.textContent).toContain("Eliminar insumo");

    await act(async () => {
      clickDialogButton("Eliminar insumo");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/resources",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ create: [], update: [], delete: ["r-1"] }),
      }),
    );
    expect(container.textContent).not.toContain("Cemento Portland");
  });

  it("shows inline error in the delete dialog when the API fails and keeps the dialog open", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton } = await renderTable([
      makeResource({ id: "r-1", description: "Cemento Portland", companyId: "company-1" }),
    ]);

    await act(async () => {
      clickDeleteAction("r-1");
    });

    await act(async () => {
      clickDialogButton("Eliminar insumo");
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(document.body.textContent).toContain("Eliminar insumo");
    expect(document.body.textContent).toContain("No se pudo eliminar el insumo");
  });

  it("shows a permission error in the delete dialog on 403 and keeps the dialog open", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "No tienes permisos para eliminar este insumo" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton } = await renderTable([
      makeResource({ id: "r-1", description: "Cemento Portland", companyId: "company-1" }),
    ]);

    await act(async () => {
      clickDeleteAction("r-1");
    });

    await act(async () => {
      clickDialogButton("Eliminar insumo");
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(document.body.textContent).toContain("Eliminar insumo");
    expect(document.body.textContent).toContain("No tienes permisos para eliminar este insumo");
  });

  // ─── Excel mode density contract (Task 8) ──────────────────────

  it("uses the configured Excel row height for resource rows in Excel mode", async () => {
    viewModeState.isExcelMode = true;
    formattingSettingsState.excelRowHeight = 52;

    const { container } = await renderTable([makeResource({ id: "r-1" })]);

    const firstBodyRow = container.querySelector("tbody tr");
    const height = (firstBodyRow?.getAttribute("style") ?? "").match(/height:\s*(\d+)/)?.[1];
    expect(height).toBe("52");
  });

  it("falls back to the default row height in modern mode", async () => {
    viewModeState.isExcelMode = false;
    formattingSettingsState.excelRowHeight = 52;

    const { container } = await renderTable([makeResource({ id: "r-1" })]);

    const firstBodyRow = container.querySelector("tbody tr");
    const height = (firstBodyRow?.getAttribute("style") ?? "").match(/height:\s*(\d+)/)?.[1];
    expect(height).toBe("74");
  });

  it("renders compact row actions in Excel mode and hides inline action buttons", async () => {
    viewModeState.isExcelMode = true;

    const { container } = await renderTable([makeResource({ id: "r-1" })]);

    const compactTriggers = container.querySelectorAll('button[aria-label="Abrir acciones de fila"]');
    expect(compactTriggers.length).toBeGreaterThan(0);
    expect(container.querySelector('button[data-resource-action="delete"]')).toBeNull();
    const editarInline = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Editar",
    );
    expect(editarInline).toHaveLength(0);
  });

  it("opens the delete confirmation dialog from the compact menu in Excel mode", async () => {
    viewModeState.isExcelMode = true;

    const { container } = await renderTable([
      makeResource({ id: "r-1", description: "Cemento Portland", companyId: "company-1" }),
    ]);

    await act(async () => {
      const trigger = container.querySelector('button[aria-label="Abrir acciones de fila"]');
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[role="menu"]')).not.toBeNull();

    await act(async () => {
      const items = container.querySelectorAll('[role="menuitem"]');
      const deleteItem = Array.from(items).find((item) => item.textContent?.includes("Eliminar"));
      deleteItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.textContent).toContain("Eliminar insumo");
    expect(document.body.textContent).toContain("Cemento Portland");
  });
});
