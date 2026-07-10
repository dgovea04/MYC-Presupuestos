import { describe, expect, it, vi, beforeEach } from "vitest";
import { searchCompaniesTool, createProjectTool } from "./projects";
import type { AgentToolContext } from "../types";

// ─── Mock data module ────────────────────────────────────────────────────────
// vi.mock() se hoistea al tope del archivo, así que los datos de mock
// deben definirse dentro de la factory function para evitar TDZ errors.

vi.mock("@/lib/data/projects", () => {
  const companies = [
    { id: "comp-1", name: "Constructora Los Andes S.A.C.", ruc: "20123456789", email: "contacto@losandes.pe", phone: "01-234-5678", address: "Av. Principal 123, Lima" },
    { id: "comp-2", name: "Inmobiliaria del Sur E.I.R.L.", ruc: "20987654321", email: "ventas@inmobiliariasur.pe", phone: "01-987-6543", address: "Jr. Secundaria 456, Arequipa" },
  ];
  const project = {
    id: "proj-1",
    name: "Hospital General",
    companyId: "comp-1",
    clientName: "MINSA",
    location: "Lima, Perú",
    projectType: "Edificacion",
    status: "PLANNING" as const,
    startDate: new Date("2026-08-01"),
    endDate: new Date("2027-08-01"),
    createdAt: new Date("2026-07-09"),
  };

  return {
    getUserCompanies: vi.fn().mockResolvedValue(companies),
    createProject: vi.fn().mockResolvedValue(project),
  };
});

// ─── Import after mock ───────────────────────────────────────────────────────

import { getUserCompanies, createProject } from "@/lib/data/projects";

// ─── Context helper ──────────────────────────────────────────────────────────

function makeContext(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    userId: "user-1",
    executionId: "exec-flow-1",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("searchCompaniesTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tiene risk=read y no requiere projectId", () => {
    expect(searchCompaniesTool.risk).toBe("read");
    expect(searchCompaniesTool.requiresProjectId).toBe(false);
  });

  it("retorna todas las empresas cuando no hay query", async () => {
    const result = await searchCompaniesTool.execute(
      {},
      makeContext(),
    ) as { count: number; totalCount: number; companies: Array<{ id: string; name: string }> };

    expect(result.count).toBe(2);
    expect(result.totalCount).toBe(2);
    expect(result.companies).toHaveLength(2);
    expect(result.companies[0].name).toBe("Constructora Los Andes S.A.C.");
    expect(result.companies[1].name).toBe("Inmobiliaria del Sur E.I.R.L.");
  });

  it("filtra por nombre con query", async () => {
    const result = await searchCompaniesTool.execute(
      { query: "Andes" },
      makeContext(),
    ) as { count: number; totalCount: number; companies: Array<{ id: string; name: string }> };

    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(2);
    expect(result.companies[0].id).toBe("comp-1");
    expect(result.companies[0].name).toBe("Constructora Los Andes S.A.C.");
  });

  it("filtra por RUC con query", async () => {
    const result = await searchCompaniesTool.execute(
      { query: "20987654321" },
      makeContext(),
    ) as { count: number; totalCount: number; companies: Array<{ id: string; name: string }> };

    expect(result.count).toBe(1);
    expect(result.companies[0].id).toBe("comp-2");
  });

  it("retorna count=0 cuando no hay coincidencias", async () => {
    const result = await searchCompaniesTool.execute(
      { query: "Empresa Inexistente S.A." },
      makeContext(),
    ) as { count: number; totalCount: number; companies: unknown[] };

    expect(result.count).toBe(0);
    expect(result.totalCount).toBe(2);
    expect(result.companies).toHaveLength(0);
  });

  it("llama a getUserCompanies con el userId del contexto", async () => {
    await searchCompaniesTool.execute({}, makeContext({ userId: "user-42" }));
    expect(getUserCompanies).toHaveBeenCalledWith("user-42");
  });
});

describe("createProjectTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tiene risk=write y no requiere projectId", () => {
    // createProject crea el proyecto, no opera sobre uno existente
    expect(createProjectTool.risk).toBe("write");
    expect(createProjectTool.requiresProjectId).toBe(false);
  });

  it("crea un proyecto y retorna su estructura completa", async () => {
    const result = await createProjectTool.execute(
      {
        companyId: "comp-1",
        name: "Hospital General",
        clientName: "MINSA",
        location: "Lima, Perú",
        projectType: "Edificacion",
        startDate: "2026-08-01",
        endDate: "2027-08-01",
        status: "PLANNING",
      },
      makeContext(),
    ) as Record<string, unknown>;

    expect(result.id).toBe("proj-1");
    expect(result.name).toBe("Hospital General");
    expect(result.companyId).toBe("comp-1");
    expect(result.clientName).toBe("MINSA");
    expect(result.status).toBe("PLANNING");
    expect(result.startDate).toContain("2026-08-01");
    expect(result.endDate).toContain("2027-08-01");
    expect(result.createdAt).toBeDefined();
  });

  it("pasa los parámetros correctos a createProject", async () => {
    await createProjectTool.execute(
      {
        companyId: "comp-1",
        name: "Hospital General",
        clientName: "MINSA",
        status: "PLANNING",
      },
      makeContext({ userId: "user-99" }),
    );

    expect(createProject).toHaveBeenCalledWith("user-99", {
      companyId: "comp-1",
      name: "Hospital General",
      clientName: "MINSA",
      location: undefined,
      projectType: undefined,
      startDate: undefined,
      endDate: undefined,
      status: "PLANNING",
      workCalendarId: null,
    });
  });

  it("usa status PLANNING por defecto cuando se parsea con Zod", async () => {
    // El ToolExecutor parsea el input con Zod antes de llamar a execute.
    // Aquí simulamos ese paso para verificar el default.
    const parsedInput = createProjectTool.inputSchema.parse({
      companyId: "comp-1",
      name: "Edificio",
    });

    await createProjectTool.execute(parsedInput, makeContext());

    const call = vi.mocked(createProject).mock.calls[0][1] as { status: string };
    expect(call.status).toBe("PLANNING");
  });

  it("trata workCalendarId undefined como null", async () => {
    await createProjectTool.execute(
      {
        companyId: "comp-1",
        name: "Edificio",
      },
      makeContext(),
    );

    const call = vi.mocked(createProject).mock.calls[0][1] as { workCalendarId: string | null };
    expect(call.workCalendarId).toBeNull();
  });
});

describe("flujo completo: searchCompanies → createProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("simula el flujo real: busca empresas, luego crea proyecto con la primera", async () => {
    // 1. Buscar empresas del usuario
    const searchResult = await searchCompaniesTool.execute(
      {},
      makeContext(),
    ) as { count: number; companies: Array<{ id: string; name: string; ruc: string }> };

    expect(searchResult.count).toBeGreaterThan(0);
    expect(getUserCompanies).toHaveBeenCalledTimes(1);

    // 2. Usar la primera empresa para crear el proyecto
    const firstCompany = searchResult.companies[0];
    expect(firstCompany.id).toBe("comp-1");
    expect(firstCompany.name).toBe("Constructora Los Andes S.A.C.");

    const projectResult = await createProjectTool.execute(
      {
        companyId: firstCompany.id,
        name: "Hospital General",
        clientName: "MINSA",
        location: "Lima, Perú",
        projectType: "Edificacion",
      },
      makeContext(),
    ) as Record<string, unknown>;

    // 3. Verificar la estructura creada
    expect(projectResult.id).toBe("proj-1");
    expect(projectResult.name).toBe("Hospital General");
    expect(projectResult.companyId).toBe(firstCompany.id);
    expect(projectResult.clientName).toBe("MINSA");
    expect(projectResult.location).toBe("Lima, Perú");
    expect(projectResult.projectType).toBe("Edificacion");
    expect(projectResult.status).toBe("PLANNING");
    expect(projectResult.startDate).toBeDefined();
    expect(projectResult.endDate).toBeDefined();
    expect(projectResult.createdAt).toBeDefined();

    // 4. Verificar que createProject fue llamado con los datos correctos
    expect(createProject).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        companyId: firstCompany.id,
        name: "Hospital General",
      }),
    );

    // 5. Verificar la secuencia de llamadas
    expect(getUserCompanies).toHaveBeenCalledTimes(1);
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getUserCompanies).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createProject).mock.invocationCallOrder[0],
    );
  });

  it("summarizeResult del createProject menciona la estructura creada", () => {
    const summary = createProjectTool.summarizeResult!({
      id: "proj-1",
      name: "Hospital General",
      companyId: "comp-1",
      clientName: "MINSA",
      location: "Lima",
      projectType: "Edificacion",
      status: "PLANNING",
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2027-08-01T00:00:00.000Z",
      createdAt: "2026-07-09T12:00:00.000Z",
    });

    expect(summary).toContain("Hospital General");
    expect(summary).toContain("Presupuesto General");
    expect(summary).toContain("sub-presupuestos");
  });
});
