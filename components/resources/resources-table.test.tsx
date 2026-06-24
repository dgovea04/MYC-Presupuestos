/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const suggestResourceIuCodesMock = vi.fn(() => []);

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
  ActionButton: ({ label, onClick }: { label: string; onClick?: () => void }) => <button onClick={onClick}>{label}</button>,
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
  TR: React.forwardRef<HTMLTableRowElement, { children: React.ReactNode }>(function MockTR({ children }, ref) {
    return <tr ref={ref}>{children}</tr>;
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

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  useAppViewMode: () => ({ isExcelMode: false }),
}));

vi.mock("@/components/view-mode/view-mode-styles", () => ({
  getTableFrameClassName: () => "table-frame",
  getTableViewportClassName: () => "table-viewport",
}));

vi.mock("@/components/providers/formatting-settings-provider", () => ({
  useFormattingSettings: () => ({
    excelRowHeight: 74,
  }),
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

  return { container };
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
});
