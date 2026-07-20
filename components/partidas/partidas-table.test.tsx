/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/partidas/partida-create-sheet", () => ({
  PartidaCreateSheet: () => null,
}));

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
    readOnly,
  }: {
    value?: string | number;
    onChange?: (event: { target: { value: string } }) => void;
    readOnly?: boolean;
  }) => <input value={value ?? ""} onChange={onChange} readOnly={readOnly} />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("@/components/ui/action-button", () => ({
  ActionButton: ({
    label,
    onClick,
    "data-partida-action": dataAction,
    "data-partida-id": dataId,
  }: {
    label: string;
    onClick?: () => void;
    "data-partida-action"?: string;
    "data-partida-id"?: string;
  }) => (
    <button onClick={onClick} data-partida-action={dataAction} data-partida-id={dataId}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  THead: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TR: ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => <tr style={style}>{children}</tr>,
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
const formattingSettingsState: { currencyDecimals: number; excelRowHeight: number } = {
  currencyDecimals: 2,
  excelRowHeight: 74,
};

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({ isExcelMode: viewModeState.isExcelMode }),
}));

vi.mock("@/components/view-mode/view-mode-styles", () => ({
  getTableFrameClassName: () => "table-frame",
  getTableViewportClassName: () => "table-viewport",
}));

vi.mock("@/components/providers/formatting-settings-provider", () => ({
  useFormattingSettings: () => ({
    currencyDecimals: formattingSettingsState.currencyDecimals,
    excelRowHeight: formattingSettingsState.excelRowHeight,
  }),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(" "),
    formatCurrency: (amount: number) => amount.toFixed(2),
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("lucide-react", () => ({
  GitCompareArrows: () => null,
  Plus: () => null,
  AlertTriangle: () => null,
  Loader2: () => null,
  Trash2: () => null,
  X: () => null,
  Copy: () => null,
  Edit: () => null,
  Eye: () => null,
  Save: () => null,
  MoreHorizontal: () => null,
}));

import { PartidasTable } from "@/components/partidas/partidas-table";
import type { CatalogPartidaRecord } from "@/types/partida";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;

function makePartida(overrides: Partial<CatalogPartidaRecord> = {}): CatalogPartidaRecord {
  return {
    id: overrides.id ?? `p-${Math.random().toString(36).slice(2, 7)}`,
    description: overrides.description ?? "Concreto f'c=210 kg/cm2",
    unit: overrides.unit ?? "m3",
    unitPrice: overrides.unitPrice ?? 350.5,
    currency: overrides.currency ?? "PEN",
    source: overrides.source ?? null,
    performance: overrides.performance ?? 25,
    performanceUnit: overrides.performanceUnit ?? "m3",
    performanceRate: overrides.performanceRate ?? "25.0000 m3/DIA",
    apuRows: overrides.apuRows ?? [],
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  viewModeState.isExcelMode = false;
  formattingSettingsState.currencyDecimals = 2;
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

async function renderTable(partidas: CatalogPartidaRecord[] = []) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;

  const root = createRoot(container);
  (container as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(<PartidasTable partidas={partidas} resourcesCatalog={[]} />);
  });

  return {
    container,
    clickDeleteAction: (partidaId: string) => {
      const button = container.querySelector(`button[data-partida-action="delete"][data-partida-id="${partidaId}"]`);
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing delete action for ${partidaId}`);
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
    getPartidaDescriptions: () =>
      Array.from(container.querySelectorAll("tbody tr td:first-child input")).map(
        (input) => (input as HTMLInputElement).value,
      ),
  };
}

describe("PartidasTable", () => {
  it("renders the partidas table", async () => {
    const { container } = await renderTable([makePartida({ id: "p-1" })]);
    expect(container.querySelector("table")).not.toBeNull();
  });

  // ─── Delete confirmation dialog ──────────────────────────────────────────

  it("opens the delete confirmation dialog when clicking Eliminar", async () => {
    const { clickDeleteAction } = await renderTable([
      makePartida({ id: "p-1", description: "Concreto f'c=210 kg/cm2" }),
    ]);

    expect(document.body.textContent).not.toContain("Eliminar partida");

    await act(async () => {
      clickDeleteAction("p-1");
    });

    expect(document.body.textContent).toContain("Eliminar partida");
    expect(document.body.textContent).toContain("Concreto f'c=210 kg/cm2");
    expect(document.body.textContent).toContain("Esta accion no se puede deshacer");
    expect(document.body.textContent).toContain("Cancelar");
  });

  it("closes the delete dialog when clicking Cancelar", async () => {
    const { clickDeleteAction, clickDialogButton } = await renderTable([
      makePartida({ id: "p-1", description: "Concreto f'c=210 kg/cm2" }),
    ]);

    await act(async () => {
      clickDeleteAction("p-1");
    });

    expect(document.body.textContent).toContain("Eliminar partida");

    await act(async () => {
      clickDialogButton("Cancelar");
    });

    expect(document.body.textContent).not.toContain("Eliminar partida");
  });

  it("closes the delete dialog when clicking the X close button", async () => {
    const { clickDeleteAction } = await renderTable([
      makePartida({ id: "p-1", description: "Concreto f'c=210 kg/cm2" }),
    ]);

    await act(async () => {
      clickDeleteAction("p-1");
    });

    expect(document.body.textContent).toContain("Eliminar partida");

    await act(async () => {
      const xButton = document.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement | null;
      if (!xButton) throw new Error("Missing X close button");
      xButton.click();
    });

    expect(document.body.textContent).not.toContain("Eliminar partida");
  });

  it("sends PATCH delete request on confirm", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ created: [], updated: [], deleted: ["p-1"], savedAt: "2026-06-01T00:00:00.000Z" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton, container } = await renderTable([
      makePartida({ id: "p-1", description: "Concreto f'c=210 kg/cm2" }),
    ]);

    await act(async () => {
      clickDeleteAction("p-1");
    });

    expect(document.body.textContent).toContain("Eliminar partida");

    await act(async () => {
      clickDialogButton("Eliminar partida");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/partidas",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ create: [], update: [], delete: ["p-1"] }),
      }),
    );
    expect(container.textContent).not.toContain("Concreto f'c=210 kg/cm2");
  });

  it("shows inline error in the delete dialog when the API fails and keeps the dialog open", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton } = await renderTable([
      makePartida({ id: "p-1", description: "Concreto f'c=210 kg/cm2" }),
    ]);

    await act(async () => {
      clickDeleteAction("p-1");
    });

    await act(async () => {
      clickDialogButton("Eliminar partida");
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(document.body.textContent).toContain("Eliminar partida");
    expect(document.body.textContent).toContain("No se pudo eliminar la partida");
  });

  it("shows a permission error in the delete dialog on 403 and keeps the dialog open", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "No tienes permisos para eliminar esta partida" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton } = await renderTable([
      makePartida({ id: "p-1", description: "Concreto f'c=210 kg/cm2" }),
    ]);

    await act(async () => {
      clickDeleteAction("p-1");
    });

    await act(async () => {
      clickDialogButton("Eliminar partida");
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(document.body.textContent).toContain("Eliminar partida");
    expect(document.body.textContent).toContain("No tienes permisos para eliminar esta partida");
  });

  // ─── Excel mode density contract (Task 8) ──────────────────────

  it("uses the configured Excel row height for partida rows in Excel mode", async () => {
    viewModeState.isExcelMode = true;
    formattingSettingsState.excelRowHeight = 52;

    const { container } = await renderTable([makePartida({ id: "p-1" })]);

    const firstBodyRow = container.querySelector("tbody tr");
    const height = (firstBodyRow?.getAttribute("style") ?? "").match(/height:\s*(\d+)/)?.[1];
    expect(height).toBe("52");
  });

  it("falls back to the default row height in modern mode", async () => {
    viewModeState.isExcelMode = false;
    formattingSettingsState.excelRowHeight = 52;

    const { container } = await renderTable([makePartida({ id: "p-1" })]);

    const firstBodyRow = container.querySelector("tbody tr");
    const height = (firstBodyRow?.getAttribute("style") ?? "").match(/height:\s*(\d+)/)?.[1];
    expect(height).toBe("74");
  });

  it("renders compact row actions in Excel mode and hides inline action buttons", async () => {
    viewModeState.isExcelMode = true;

    const { container } = await renderTable([makePartida({ id: "p-1", description: "Concreto f'c=210 kg/cm2" })]);

    const compactTriggers = container.querySelectorAll('button[aria-label="Abrir acciones de fila"]');
    expect(compactTriggers.length).toBeGreaterThan(0);
    expect(container.querySelector('button[data-partida-action="delete"]')).toBeNull();
    const verApuInline = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "Ver APU",
    );
    expect(verApuInline).toHaveLength(0);
  });

  it("opens the delete confirmation dialog from the compact menu in Excel mode", async () => {
    viewModeState.isExcelMode = true;

    const { container } = await renderTable([
      makePartida({ id: "p-1", description: "Concreto f'c=210 kg/cm2" }),
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

    expect(document.body.textContent).toContain("Eliminar partida");
    expect(document.body.textContent).toContain("Concreto f'c=210 kg/cm2");
  });
});
