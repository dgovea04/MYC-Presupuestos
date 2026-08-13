/* @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BudgetViewModeProvider, useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { ProjectsTable } from "@/components/projects/projects-table";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import type { ProjectRecord } from "@/types/project";

vi.mock("@/lib/client/live-updates", () => ({
  broadcastAppDataChange: vi.fn(),
}));

let activeContainer: HTMLDivElement | null = null;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ProjectsTable excel view mode", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    window.localStorage.clear();

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

  it("tightens the table frame and controls in excel mode", async () => {
    const { getByTestId, getControl, getFrame } = await renderProjectsTable();

    expect(getFrame().className).not.toContain("rounded-md");
    expect(getControl().className).not.toContain("rounded-md");

    await act(async () => {
      getByTestId("excel-mode-button").click();
    });

    expect(getFrame().className).toContain("rounded-none");
    expect(getFrame().className).toContain("border-transparent");
    expect(getFrame().className).toContain("shadow-none");
    expect(getControl().className).toContain("rounded-md");
  });

  it("shows a duplicate action for each project row", async () => {
    const { getProjectRowActionTexts } = await renderProjectsTable();
    const rowActionTexts = getProjectRowActionTexts();

    expect(rowActionTexts).toHaveLength(2);
    expect(rowActionTexts.filter((actions) => actions.includes("Duplicar"))).toHaveLength(rowActionTexts.length);
  });

  it("shows a Demo badge for the onboarding demo project", async () => {
    await renderProjectsTable([
      {
        ...createProject("project-demo", "Edificio Multifamiliar - Demo"),
        isDemo: true,
        demoKey: "edificio-multifamiliar",
      },
    ]);

    expect(screen.getByText("Demo")).not.toBeNull();
    expect(screen.getByText("Edificio Multifamiliar - Demo")).not.toBeNull();
  });

  it("duplicates a project row locally and broadcasts refresh paths", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...createProject("project-3", "Edificio Central (copia)"),
          updatedAt: "2026-05-19T10:00:00.000Z",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDuplicateAction, getProjectNames, getBudgetsCounts } = await renderProjectsTable();

    await act(async () => {
      clickDuplicateAction("project-1");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/duplicate", { method: "POST" });
    expect(getProjectNames()).toEqual(["Edificio Central (copia)", "Edificio Central", "Hospital Norte"]);
    expect(getBudgetsCounts()).toEqual(["3", "3", "3"]);
    expect(broadcastAppDataChange).toHaveBeenCalledWith(["/dashboard", "/projects", "/budgets"], undefined, {
      locallyHandledPaths: ["/projects"],
    });
  });

  it("shows a fallback error when duplicate fails before a JSON body is available", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const { clickDuplicateAction, getErrorMessage, getProjectNames } = await renderProjectsTable();

    await act(async () => {
      clickDuplicateAction("project-1");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/duplicate", { method: "POST" });
    expect(getErrorMessage()).toBe("No se pudo duplicar el proyecto");
    expect(getProjectNames()).toEqual(["Edificio Central", "Hospital Norte"]);
    expect(broadcastAppDataChange).not.toHaveBeenCalled();
  });

  // ─── Delete confirmation dialog ──────────────────────────────────────────

  it("opens the delete confirmation dialog when clicking Eliminar", async () => {
    const { clickDeleteAction } = await renderProjectsTable();

    expect(document.body.textContent).not.toContain("Eliminar proyecto");

    await act(async () => {
      clickDeleteAction("project-1");
    });

    expect(document.body.textContent).toContain("Eliminar proyecto");
    expect(document.body.textContent).toContain("Edificio Central");
    expect(document.body.textContent).toContain("Esta accion no se puede deshacer");
    expect(document.body.textContent).toContain("Cancelar");
  });

  it("closes the delete dialog when clicking Cancelar", async () => {
    const { clickDeleteAction, clickDialogButton } = await renderProjectsTable();

    await act(async () => {
      clickDeleteAction("project-1");
    });

    expect(document.body.textContent).toContain("Eliminar proyecto");

    await act(async () => {
      clickDialogButton("Cancelar");
    });

    expect(document.body.textContent).not.toContain("Eliminar proyecto");
  });

  it("closes the delete dialog when clicking the X close button", async () => {
    const { clickDeleteAction } = await renderProjectsTable();

    await act(async () => {
      clickDeleteAction("project-1");
    });

    expect(document.body.textContent).toContain("Eliminar proyecto");

    await act(async () => {
      const xButton = document.querySelector('button[aria-label="Cerrar"]') as HTMLButtonElement | null;
      if (!xButton) throw new Error("Missing X close button");
      xButton.click();
    });

    expect(document.body.textContent).not.toContain("Eliminar proyecto");
  });

  it("sends DELETE request and removes the project row on confirm", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton, getProjectNames } = await renderProjectsTable();

    await act(async () => {
      clickDeleteAction("project-1");
    });

    expect(document.body.textContent).toContain("Eliminar proyecto");

    await act(async () => {
      clickDialogButton("Eliminar proyecto");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1", { method: "DELETE" });
    expect(getProjectNames()).toEqual(["Hospital Norte"]);
    expect(broadcastAppDataChange).toHaveBeenCalledWith(["/dashboard", "/projects", "/budgets"], undefined, {
      locallyHandledPaths: ["/projects"],
    });
  });

  it("shows inline error in the delete dialog when the API fails and keeps the dialog open", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton } = await renderProjectsTable();

    await act(async () => {
      clickDeleteAction("project-1");
    });

    await act(async () => {
      clickDialogButton("Eliminar proyecto");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1", { method: "DELETE" });
    expect(document.body.textContent).toContain("Eliminar proyecto");
    expect(document.body.textContent).toContain("No se pudo eliminar el proyecto");
  });

  it("shows a permission error in the delete dialog on 403 and keeps the dialog open", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "No tienes permisos para eliminar este proyecto" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { clickDeleteAction, clickDialogButton } = await renderProjectsTable();

    await act(async () => {
      clickDeleteAction("project-1");
    });

    await act(async () => {
      clickDialogButton("Eliminar proyecto");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1", { method: "DELETE" });
    expect(document.body.textContent).toContain("Eliminar proyecto");
    expect(document.body.textContent).toContain("No tienes permisos para eliminar este proyecto");
  });
});

async function renderProjectsTable(
  projects: Array<ProjectRecord & { budgetsCount: number; isDemo?: boolean; demoKey?: string | null }> = [
    createProject("project-1", "Edificio Central"),
    createProject("project-2", "Hospital Norte"),
  ],
) {
  const nextContainer = document.createElement("div");
  document.body.appendChild(nextContainer);
  activeContainer = nextContainer;

  const root = createRoot(nextContainer);
  (nextContainer as HTMLDivElement & { __root?: typeof root }).__root = root;

  await act(async () => {
    root.render(
      <BudgetViewModeProvider>
        <ProjectsTableModeHarness projects={projects} />
      </BudgetViewModeProvider>,
    );
  });

  return {
    getByTestId: (testId: string) => {
      const element = nextContainer.querySelector(`[data-testid="${testId}"]`);

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing element: ${testId}`);
      }

      return element;
    },
    getControl: () => {
      const element = nextContainer.querySelector("[data-testid='projects-filter-summary']");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing filter summary");
      }

      return element;
    },
    getFrame: () => {
      const element = nextContainer.querySelector("[data-testid='static-table-frame']");

      if (!(element instanceof HTMLDivElement)) {
        throw new Error("Missing static table frame");
      }

      return element;
    },
    getProjectRowActionTexts: () =>
      Array.from(nextContainer.querySelectorAll("tbody tr")).map((row) =>
        Array.from(row.querySelectorAll("td:last-child button, td:last-child a"))
          .map((element) => element.textContent?.trim() ?? "")
          .filter(Boolean),
      ),
    clickDuplicateAction: (projectId: string) => {
      const button = nextContainer.querySelector(`button[data-project-action="duplicate"][data-project-id="${projectId}"]`);

      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing duplicate action for ${projectId}`);
      }

      button.click();
    },
    clickDeleteAction: (projectId: string) => {
      const button = nextContainer.querySelector(`button[data-project-action="delete"][data-project-id="${projectId}"]`);

      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing delete action for ${projectId}`);
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
    getProjectNames: () =>
      Array.from(nextContainer.querySelectorAll("tbody tr td:first-child")).map((cell) => cell.textContent?.trim() ?? ""),
    getBudgetsCounts: () =>
      Array.from(nextContainer.querySelectorAll("tbody tr td:nth-child(5)")).map((cell) => cell.textContent?.trim() ?? ""),
    getErrorMessage: () => nextContainer.querySelector("p.theme-status-error")?.textContent?.trim() ?? "",
  };
}

function ProjectsTableModeHarness({ projects }: { projects: Array<ProjectRecord & { budgetsCount: number; isDemo?: boolean; demoKey?: string | null }> }) {
  const { setViewMode } = useBudgetViewMode();

  return (
    <>
      <button data-testid="excel-mode-button" type="button" onClick={() => setViewMode("excel")}>
        Excel
      </button>
      <ProjectsTable projects={projects} />
    </>
  );
}

function createProject(id: string, name: string): ProjectRecord & { budgetsCount: number } {
  return {
    id,
    companyId: "company-1",
    name,
    isDemo: false,
    demoKey: null,
    clientName: "Cliente Demo",
    location: "Lima",
    status: "IN_PROGRESS",
    updatedAt: "2026-05-12T10:00:00.000Z",
    budgetsCount: 3,
  };
}
