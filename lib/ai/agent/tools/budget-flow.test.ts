import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBudgetTool, createBudgetGeneralTool, createSubBudgetTool } from "./budgets";
import type { AgentToolContext } from "../types";

// ─── Mock data modules ───────────────────────────────────────────────────────
// vi.mock se hoistea al tope del archivo, así que los datos deben ir
// dentro de la factory function para evitar TDZ errors.

vi.mock("@/lib/data/budgets", () => {
  // Mock dinámico: el tool ahora pasa generalExpensesRate/utilityRate/igvRate
  // como decimales (0-1). El mock retorna esos mismos valores para que el tool
  // los convierta de vuelta a porcentajes (0-100) en el resultado.
  const mockCreateBudget = vi.fn().mockImplementation(
    (_userId: string, input: Record<string, unknown>) => {
      const i = input as { generalExpensesRate?: number; utilityRate?: number; igvRate?: number };
      return Promise.resolve({
        id: "budget-1",
        name: input.name ?? "Hospital General",
        projectId: input.projectId ?? "proj-1",
        currency: input.currency ?? "PEN",
        igvRate: i.igvRate ?? 0.18,
        generalExpensesRate: i.generalExpensesRate ?? 0.1,
        utilityRate: i.utilityRate ?? 0.1,
      });
    },
  );

  return {
    getBudgetById: vi.fn(),
    createBudget: mockCreateBudget,
  };
});

vi.mock("@/lib/data/settings", () => {
  return {
    getUserSettings: vi.fn().mockResolvedValue({
      defaultSubBudgetNames: [
        "Estructuras",
        "Arquitectura",
        "Instalaciones Sanitarias",
        "Instalaciones Eléctricas",
      ],
      defaultCurrency: "PEN",
      defaultIgvRate: 18,
      defaultGeneralExpensesRate: 10,
      defaultUtilityRate: 10,
    }),
  };
});

vi.mock("@/lib/db/prisma", () => {
  const createSubBudget = vi.fn().mockImplementation(
    ({ data }: { data: { name: string; projectId: string } }) =>
      Promise.resolve({
        id: `sub-${data.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: data.name,
        projectId: data.projectId,
        parentBudgetId: "budget-1",
        kind: "SUB_BUDGET",
        currency: "PEN",
      }),
  );

  return {
    prisma: {
      budget: {
        create: createSubBudget,
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

// ─── Imports after mocks ─────────────────────────────────────────────────────

import { createBudget } from "@/lib/data/budgets";
import { getUserSettings } from "@/lib/data/settings";
import { prisma } from "@/lib/db/prisma";

// ─── Context helper ──────────────────────────────────────────────────────────

function makeContext(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    userId: "user-1",
    projectId: "proj-1",
    executionId: "exec-budget-flow-1",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createBudgetTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tiene risk=write y requiere projectId", () => {
    expect(createBudgetTool.risk).toBe("write");
    expect(createBudgetTool.requiresProjectId).toBe(true);
  });

  it("crea un presupuesto y retorna su estructura con sub-presupuestos", async () => {
    const result = await createBudgetTool.execute(
      {
        projectId: "proj-1",
        name: "Hospital General",
        currency: "PEN",
      },
      makeContext(),
    );

    expect(result).toMatchObject({
      id: "budget-1",
      name: "Hospital General",
      projectId: "proj-1",
      currency: "PEN",
    });
    expect(result.subBudgetCount).toBe(4);
    expect(result.subBudgets).toHaveLength(4);
  });

  it("pasa los parámetros correctos a createBudget (mapeando % a decimales y corrigiendo nombres de campos)", async () => {
    await createBudgetTool.execute(
      {
        projectId: "proj-1",
        name: "Hospital General",
        currency: "PEN",
        indirectCostPercentage: 15,
        utilityPercentage: 8,
        taxPercentage: 18,
      },
      makeContext({ userId: "user-99" }),
    );

    // El tool mapea indirectCostPercentage → generalExpensesRate (dividiendo /100)
    // utilityPercentage → utilityRate, taxPercentage → igvRate
    expect(createBudget).toHaveBeenCalledWith("user-99", {
      name: "Hospital General",
      projectId: "proj-1",
      currency: "PEN",
      generalExpensesRate: 0.15, // 15/100
      utilityRate: 0.08,         // 8/100
      igvRate: 0.18,            // 18/100
    });
  });

  it("usa defaults de Zod para porcentajes y los convierte a decimales", async () => {
    const parsedInput = createBudgetTool.inputSchema.parse({
      projectId: "proj-1",
      name: "Hospital General",
    });
    // parsedInput: { projectId, name, currency: "PEN", indirectCostPercentage: 10, utilityPercentage: 10, taxPercentage: 18 }

    await createBudgetTool.execute(parsedInput, makeContext());

    // Los defaults en % se convierten a decimales (0-1) para createBudget
    expect(createBudget).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        currency: "PEN",
        generalExpensesRate: 0.1, // 10/100
        utilityRate: 0.1,         // 10/100
        igvRate: 0.18,            // 18/100
      }),
    );
  });

  it("consulta getUserSettings del usuario para obtener nombres de sub-presupuestos", async () => {
    await createBudgetTool.execute(
      {
        projectId: "proj-1",
        name: "Hospital General",
      },
      makeContext({ userId: "user-42" }),
    );

    expect(getUserSettings).toHaveBeenCalledWith("user-42");
  });

  it("retorna subBudgets con id y name para cada sub-presupuesto creado", async () => {
    const result = await createBudgetTool.execute(
      {
        projectId: "proj-1",
        name: "Hospital General",
      },
      makeContext(),
    );

    expect(result.subBudgets).toEqual([
      { id: "sub-estructuras", name: "Estructuras" },
      { id: "sub-arquitectura", name: "Arquitectura" },
      { id: "sub-instalaciones-sanitarias", name: "Instalaciones Sanitarias" },
      { id: "sub-instalaciones-eléctricas", name: "Instalaciones Eléctricas" },
    ]);
  });

  it("convierte indirectCostPercentage, utilityPercentage y taxPercentage a Number", async () => {
    const result = await createBudgetTool.execute(
      {
        projectId: "proj-1",
        name: "Hospital General",
      },
      makeContext(),
    );

    expect(typeof result.indirectCostPercentage).toBe("number");
    expect(typeof result.utilityPercentage).toBe("number");
    expect(typeof result.taxPercentage).toBe("number");
  });
});

describe("flujo completo: createBudget → sub-presupuestos automáticos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crea presupuesto con 4 sub-presupuestos en orden correcto de llamadas", async () => {
    // 1. Ejecutar la herramienta
    const result = await createBudgetTool.execute(
      {
        projectId: "proj-1",
        name: "Hospital General",
        currency: "PEN",
        indirectCostPercentage: 12,
        utilityPercentage: 8,
        taxPercentage: 18,
      },
      makeContext(),
    );

    // 2. Verificar estructura completa del resultado
    expect(result).toMatchObject({
      id: "budget-1",
      name: "Hospital General",
      projectId: "proj-1",
      currency: "PEN",
      indirectCostPercentage: 12,
      utilityPercentage: 8,
      taxPercentage: 18,
      subBudgetCount: 4,
    });
    expect(result.subBudgets).toHaveLength(4);

    // 3. Verificar que se llama createBudget primero
    expect(createBudget).toHaveBeenCalledTimes(1);
    expect(createBudget).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        name: "Hospital General",
        projectId: "proj-1",
      }),
    );

    // 4. Verificar que se llama getUserSettings
    expect(getUserSettings).toHaveBeenCalledTimes(1);
    expect(getUserSettings).toHaveBeenCalledWith("user-1");

    // 5. Verificar que se crean sub-presupuestos via prisma.budget.create
    expect(prisma.budget.create).toHaveBeenCalledTimes(4);

    // 6. Verificar orden de llamadas: createBudget → getUserSettings → prisma.budget.create
    const createBudgetOrder = vi.mocked(createBudget).mock.invocationCallOrder[0];
    const settingsOrder = vi.mocked(getUserSettings).mock.invocationCallOrder[0];
    const prismaCreateOrder = vi.mocked(prisma.budget.create).mock.invocationCallOrder[0];

    expect(createBudgetOrder).toBeLessThan(settingsOrder);
    expect(settingsOrder).toBeLessThan(prismaCreateOrder);
  });

  it("cada sub-presupuesto se crea con los datos correctos (proyecto, padre, kind SUB_BUDGET)", async () => {
    await createBudgetTool.execute(
      {
        projectId: "proj-1",
        name: "Hospital General",
      },
      makeContext(),
    );

    // Verificar que cada sub-presupuesto se crea con los campos correctos
    const calls = vi.mocked(prisma.budget.create).mock.calls;
    for (const [args] of calls) {
      expect(args.data.projectId).toBe("proj-1");
      expect(args.data.parentBudgetId).toBe("budget-1");
      expect(args.data.kind).toBe("SUB_BUDGET");
      expect(args.data.currency).toBe("PEN");
    }

    // Verificar nombres específicos
    const names = calls.map(([args]) => args.data.name);
    expect(names).toEqual([
      "Estructuras",
      "Arquitectura",
      "Instalaciones Sanitarias",
      "Instalaciones Eléctricas",
    ]);
  });

  it("summarizeResult menciona el nombre y cantidad de sub-presupuestos", () => {
    const summary = createBudgetTool.summarizeResult!({
      id: "budget-1",
      name: "Hospital General",
      projectId: "proj-1",
      currency: "PEN",
      indirectCostPercentage: 10,
      utilityPercentage: 10,
      taxPercentage: 18,
      subBudgets: [
        { id: "sub-1", name: "Estructuras" },
        { id: "sub-2", name: "Arquitectura" },
      ],
      subBudgetCount: 2,
    });

    expect(summary).toContain("Hospital General");
    expect(summary).toContain("2 sub-presupuestos");
    expect(summary).toContain("proj-1");
  });
});

// ─── createBudgetGeneralTool ─────────────────────────────────────────────────

describe("createBudgetGeneralTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockExistingGeneral = {
    id: "existing-general",
    name: "Presupuesto General",
  };

  it("tiene risk=write y requiere projectId", () => {
    expect(createBudgetGeneralTool.risk).toBe("write");
    expect(createBudgetGeneralTool.requiresProjectId).toBe(true);
  });

  it("crea Presupuesto General con sub-presupuestos cuando no existe uno", async () => {
    // findFirst retorna undefined (no existe GENERAL) → éxito
    vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

    const result = await createBudgetGeneralTool.execute(
      {
        projectId: "proj-1",
        name: "Presupuesto General",
        currency: "PEN",
      },
      makeContext(),
    );

    expect(result).toMatchObject({
      id: "budget-1",
      name: "Presupuesto General",
      projectId: "proj-1",
      kind: "GENERAL",
      currency: "PEN",
      subBudgetCount: 4,
    });
    expect(result.subBudgets).toHaveLength(4);
  });

  it("lanza error cuando ya existe un Presupuesto General en el proyecto", async () => {
    vi.mocked(prisma.budget.findFirst).mockResolvedValue(mockExistingGeneral);

    await expect(
      createBudgetGeneralTool.execute(
        {
          projectId: "proj-1",
          name: "Presupuesto General",
        },
        makeContext(),
      ),
    ).rejects.toThrow("ya tiene un Presupuesto General");
  });

  it("actualiza kind a GENERAL después de crear el presupuesto", async () => {
    vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

    await createBudgetGeneralTool.execute(
      {
        projectId: "proj-1",
        name: "Presupuesto General",
      },
      makeContext(),
    );

    expect(prisma.budget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "budget-1" },
        data: { kind: "GENERAL" },
      }),
    );
  });

  it("consulta getUserSettings para nombres de sub-presupuestos", async () => {
    vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

    await createBudgetGeneralTool.execute(
      {
        projectId: "proj-1",
        name: "Presupuesto General",
      },
      makeContext({ userId: "user-42" }),
    );

    expect(getUserSettings).toHaveBeenCalledWith("user-42");
  });

  it("summarizeResult menciona Presupuesto General y sub-presupuestos", () => {
    const summary = createBudgetGeneralTool.summarizeResult!({
      id: "bg-1",
      name: "Presupuesto General",
      projectId: "proj-1",
      kind: "GENERAL",
      currency: "PEN",
      subBudgets: [{ id: "s1", name: "Estructuras" }],
      subBudgetCount: 1,
    });

    expect(summary).toContain("Presupuesto General");
    expect(summary).toContain("1 sub-presupuestos");
    expect(summary).toContain("proj-1");
  });
});

// ─── createSubBudgetTool ─────────────────────────────────────────────────────

describe("createSubBudgetTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tiene risk=write y requiere projectId", () => {
    expect(createSubBudgetTool.risk).toBe("write");
    expect(createSubBudgetTool.requiresProjectId).toBe(true);
  });

  it("crea un SUB_BUDGET bajo un presupuesto padre existente", async () => {
    // Primer findFirst: validar que el padre existe → retorna parent
    // Segundo findFirst: verificar que no hay duplicado → retorna null
    vi.mocked(prisma.budget.findFirst)
      .mockResolvedValueOnce({
        id: "budget-1",
        currency: "PEN",
        igvRate: 18,
        generalExpensesRate: 10,
        utilityRate: 10,
      })
      .mockResolvedValueOnce(null);

    const result = await createSubBudgetTool.execute(
      {
        parentBudgetId: "budget-1",
        projectId: "proj-1",
        name: "Estructuras",
        currency: "PEN",
      },
      makeContext(),
    );

    expect(result).toMatchObject({
      id: "sub-estructuras",
      name: "Estructuras",
      projectId: "proj-1",
      parentBudgetId: "budget-1",
      kind: "SUB_BUDGET",
      currency: "PEN",
    });
  });

  it("lanza error cuando el presupuesto padre no existe", async () => {
    vi.mocked(prisma.budget.findFirst).mockResolvedValue(null);

    await expect(
      createSubBudgetTool.execute(
        {
          parentBudgetId: "budget-inexistente",
          projectId: "proj-1",
          name: "Estructuras",
        },
        makeContext(),
      ),
    ).rejects.toThrow("no encontrado o no tienes acceso");
  });

  it("lanza error cuando ya existe un sub-presupuesto con el mismo nombre", async () => {
    // Primer findFirst: padre existe
    // Segundo findFirst: ya existe sub-presupuesto con ese nombre
    vi.mocked(prisma.budget.findFirst)
      .mockResolvedValueOnce({
        id: "budget-1",
        currency: "PEN",
        igvRate: 18,
        generalExpensesRate: 10,
        utilityRate: 10,
      })
      .mockResolvedValueOnce({ id: "sub-existente" });

    await expect(
      createSubBudgetTool.execute(
        {
          parentBudgetId: "budget-1",
          projectId: "proj-1",
          name: "Estructuras",
        },
        makeContext(),
      ),
    ).rejects.toThrow("Ya existe un sub-presupuesto");
  });

  it("hereda tasas (igvRate, generalExpensesRate, utilityRate) del presupuesto padre", async () => {
    vi.mocked(prisma.budget.findFirst)
      .mockResolvedValueOnce({
        id: "budget-1",
        currency: "PEN",
        igvRate: 18,
        generalExpensesRate: 10,
        utilityRate: 8,
      })
      .mockResolvedValueOnce(null);

    await createSubBudgetTool.execute(
      {
        parentBudgetId: "budget-1",
        projectId: "proj-1",
        name: "Estructuras",
      },
      makeContext(),
    );

    const createCall = vi.mocked(prisma.budget.create).mock.calls[0][0];
    expect(createCall.data.igvRate).toBe(18);
    expect(createCall.data.generalExpensesRate).toBe(10);
    expect(createCall.data.utilityRate).toBe(8);
  });

  it("summarizeResult menciona el nombre y el padre", () => {
    const summary = createSubBudgetTool.summarizeResult!({
      id: "sub-1",
      name: "Estructuras",
      projectId: "proj-1",
      parentBudgetId: "budget-1",
      kind: "SUB_BUDGET",
      currency: "PEN",
    });

    expect(summary).toContain("Estructuras");
    expect(summary).toContain("budget-1");
  });
});
