import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WorkScheduleItemSaveInput, WorkScheduleItemPatchInput } from "@/lib/validations/work-schedule";

// =============================================================================
// MOCK PRISMA (in-memory) — debe estar declarada ANTES de cualquier import
// que consuma `@/lib/db/prisma`. Usamos vi.hoisted para que el store y los
// handlers esten disponibles al momento de evaluar el factory de vi.mock.
// =============================================================================

const { mockDb, mockTx } = vi.hoisted(() => {
  const mockTx = {
    workSchedule: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    workScheduleItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workScheduleDistribution: {
      deleteMany: vi.fn(),
    },
  };

  const mockDb = {
    budgetGeneral: null as null | {
      id: string;
      projectId: string;
      name: string;
      currency: string;
      project: { id: string; name: string; projectCalendars: any[] };
    },
    subBudgets: [] as Array<{
      id: string;
      projectId: string;
      name: string;
      levels: any[];
      items: any[];
    }>,
    workSchedule: null as null | { id: string; budgetId: string },
    workScheduleItems: new Map<string, any>(),
    workScheduleDistributions: new Map<string, any[]>(),
  };

  // ---- Tx handlers --------------------------------------------------------

  mockTx.workSchedule.upsert.mockImplementation(async ({ where }: any) => {
    const existing = mockDb.workSchedule;
    if (existing !== null && existing.budgetId === where.budgetId) {
      return { id: existing.id };
    }
    mockDb.workSchedule = { id: "ws-test", budgetId: where.budgetId };
    return { id: "ws-test" };
  });

  mockTx.workSchedule.findUnique.mockImplementation(async ({ where }: any) => {
    const existing = mockDb.workSchedule;
    if (where && where.budgetId !== undefined && existing !== null && existing.budgetId === where.budgetId) {
      return { id: existing.id };
    }
    return null;
  });

  mockTx.workScheduleItem.findUnique.mockImplementation(async ({ where }: any) => {
    const k = where.scheduleId_budgetItemId?.budgetItemId;
    const item = mockDb.workScheduleItems.get(k);
    return item ? { id: item.id } : null;
  });

  mockTx.workScheduleItem.findMany.mockImplementation(async ({ where }: any) => {
    const ids: string[] = where.budgetItemId?.in ?? (Array.isArray(where.budgetItemId) ? where.budgetItemId : []);
    const out: any[] = [];
    for (const id of ids) {
      const item = mockDb.workScheduleItems.get(id);
      if (item && item.scheduleId === where.scheduleId) {
        out.push({ id: item.id, budgetItemId: item.budgetItemId });
      }
    }
    return out;
  });

  mockTx.workScheduleItem.create.mockImplementation(async ({ data }: any) => {
    const id = `wsi-${Math.random().toString(36).slice(2)}`;
    const item = {
      id,
      scheduleId: data.scheduleId,
      budgetItemId: data.budgetItemId,
      startDate: data.startDate,
      endDate: data.endDate,
      durationDays: data.durationDays,
      predecessor: data.predecessor ?? null,
      crew: data.crew ?? null,
      isMilestone: data.isMilestone ?? false,
      baselineStartDate: data.baselineStartDate ?? null,
      baselineEndDate: data.baselineEndDate ?? null,
      actualStartDate: data.actualStartDate ?? null,
      actualEndDate: data.actualEndDate ?? null,
      percentComplete: data.percentComplete ?? null,
    };
    mockDb.workScheduleItems.set(data.budgetItemId, item);
    if (data.distributions?.createMany?.data) {
      mockDb.workScheduleDistributions.set(id, data.distributions.createMany.data);
    }
    return { ...item };
  });

  mockTx.workScheduleItem.update.mockImplementation(async ({ where, data }: any) => {
    let target: any | null = null;
    for (const item of mockDb.workScheduleItems.values()) {
      if (item.id === where.id) {
        target = item;
        break;
      }
    }
    if (!target) {
      throw new Error(`workScheduleItem ${where.id} not found in mock`);
    }
    Object.assign(target, data);
    if (data.distributions?.createMany?.data) {
      mockDb.workScheduleDistributions.set(target.id, data.distributions.createMany.data);
    }
    return { ...target };
  });

  mockTx.workScheduleDistribution.deleteMany.mockImplementation(async ({ where }: any) => {
    const existing = mockDb.workScheduleDistributions.get(where.scheduleItemId);
    const count = existing?.length ?? 0;
    mockDb.workScheduleDistributions.set(where.scheduleItemId, []);
    return { count };
  });

  return { mockDb, mockTx };
});

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: any) => cb(mockTx)),
    budget: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.kind !== "GENERAL") return null;
        if (where.id && mockDb.budgetGeneral?.id !== where.id) return null;
        return mockDb.budgetGeneral;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        if (where.kind !== "SUB_BUDGET") return [];
        return mockDb.subBudgets.filter((sb) => sb.projectId === where.projectId);
      }),
    },
    budgetItem: {
      findFirst: vi.fn(async ({ where }: any) => {
        const allItems = mockDb.subBudgets.flatMap((sb) => sb.items);
        const item = allItems.find((it) => it.id === where.id);
        if (!item) return null;
        if (where.budget?.projectId !== mockDb.budgetGeneral?.projectId) return null;
        if (where.budget?.kind && where.budget.kind !== "SUB_BUDGET") return null;
        return {
          id: item.id,
          code: item.code,
          budget: { items: allItems.map((it) => ({ code: it.code })) },
        };
      }),
    },
    workSchedule: {
      findUnique: vi.fn(async ({ where, include }: any) => {
        const existing = mockDb.workSchedule;
        if (where && where.budgetId !== undefined && existing !== null && existing.budgetId === where.budgetId) {
          if (include?.items) {
            const items = Array.from(mockDb.workScheduleItems.values()).map((item: any) => ({
              ...item,
              distributions: mockDb.workScheduleDistributions.get(item.id) ?? [],
            }));
            return { id: existing.id, items };
          }
          return { id: existing.id };
        }
        return null;
      }),
    },
  },
}));

// =============================================================================
// IMPORTS POST-MOCK — todo codigo que dependa de `@/lib/db/prisma` debe estar
// abajo del bloque vi.mock para que Vitest levante el factory primero.
// =============================================================================

import { saveWorkScheduleItem, saveWorkScheduleItemPatch } from "@/lib/data/work-schedule";
import { calculateWorkScheduleCriticalPath } from "@/lib/work-schedule/critical-path";

// =============================================================================
// FIXTURE HELPERS
// =============================================================================

const BUDGET_ID = "budget-001";
const SUB_BUDGET_ID = "sub-budget-001";
const PROJECT_ID = "project-001";
const BUDGET_GENERAL_NAME = "Presupuesto Test General";
const USER_ID = "user-001";

function resetMockDb() {
  mockDb.budgetGeneral = null;
  mockDb.subBudgets = [];
  mockDb.workSchedule = null;
  mockDb.workScheduleItems.clear();
  mockDb.workScheduleDistributions.clear();
}

function setUpFixture() {
  mockDb.budgetGeneral = {
    id: BUDGET_ID,
    projectId: PROJECT_ID,
    name: BUDGET_GENERAL_NAME,
    currency: "PEN",
    project: {
      id: PROJECT_ID,
      name: "Proyecto Test MC Presupuestos",
      projectCalendars: [],
    },
  };

  mockDb.subBudgets = [
    {
      id: SUB_BUDGET_ID,
      projectId: PROJECT_ID,
      name: "Estructuras",
      levels: [
        {
          id: "level-01",
          budgetId: SUB_BUDGET_ID,
          parentId: null,
          type: "TITLE",
          code: "01",
          name: "Estructuras",
          sortOrder: 1,
        },
      ],
      items: [
        {
          id: "cline_excav_001",
          budgetId: SUB_BUDGET_ID,
          levelId: "level-01",
          code: "01.01",
          description: "Excavacion manual de zanjas",
          unit: "m3",
          quantity: 250,
          unitPrice: 25,
          partial: 6250,
          sortOrder: 1,
          apu: null,
        },
        {
          id: "cline_cim_002",
          budgetId: SUB_BUDGET_ID,
          levelId: "level-01",
          code: "01.02",
          description: "Cimentacion corrida de concreto",
          unit: "m3",
          quantity: 45,
          unitPrice: 85,
          partial: 3825,
          sortOrder: 2,
          apu: null,
        },
        {
          id: "cline_est_003",
          budgetId: SUB_BUDGET_ID,
          levelId: "level-01",
          code: "01.03",
          description: "Estructura de concreto armado",
          unit: "m3",
          quantity: 120,
          unitPrice: 150,
          partial: 18000,
          sortOrder: 3,
          apu: null,
        },
      ],
    },
  ];
}

/**
 * Reconstruye WorkScheduleLineRecord[] a partir del in-memory store
 * post-save. Es el equivalente in-memory de `loadWorkScheduleDataset`
 * sin pasar por todas las queries de Prisma.
 */
function loadLinesFromMockDb(): any[] {
  const itemsByItem = mockDb.subBudgets.flatMap((sb) => sb.items);
  return Array.from(mockDb.workScheduleItems.values()).map((item: any) => {
    const itemMeta = itemsByItem.find((it) => it.id === item.budgetItemId);
    const startIso =
      item.startDate instanceof Date
        ? item.startDate.toISOString().slice(0, 10)
        : typeof item.startDate === "string"
          ? item.startDate
          : null;
    const endIso =
      item.endDate instanceof Date
        ? item.endDate.toISOString().slice(0, 10)
        : typeof item.endDate === "string"
          ? item.endDate
          : null;
    return {
      budgetItemId: item.budgetItemId,
      itemCode: itemMeta?.code ?? "?",
      description: itemMeta?.description ?? "",
      unit: itemMeta?.unit ?? "UND",
      quantity: itemMeta?.quantity ?? 1,
      unitPrice: itemMeta?.unitPrice ?? 1,
      partial: itemMeta?.partial ?? 0,
      subBudgetId: SUB_BUDGET_ID,
      subBudgetName: "Estructuras",
      startDate: startIso,
      endDate: endIso,
      durationDays: item.durationDays,
      predecessor: item.predecessor,
      monthlyDistributions: [],
    };
  });
}

// =============================================================================
// INPUT BUILDERS
// =============================================================================

function buildSaveInput(
  budgetItemId: string,
  startDate: string,
  endDate: string,
  durationDays: number,
  predecessor: string | null = null,
): WorkScheduleItemSaveInput {
  return {
    budgetItemId,
    startDate,
    endDate,
    durationDays,
    predecessor,
    isMilestone: false,
    monthlyDistributions: [
      {
        year: Number(startDate.slice(0, 4)),
        month: Number(startDate.slice(5, 7)),
        percentage: 100,
      },
    ],
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("data/work-schedule.saveWorkScheduleItem + critical-path pipeline", () => {
  beforeEach(() => {
    resetMockDb();
    setUpFixture();
  });

  it("initial save de cadena FS puro produce critical path consistente con suma de durations", async () => {
    // Cadena constructiva realista: Excav 8d -> Cim 12d (FS puro) -> Est 10d (FS puro)
    const excavInput = buildSaveInput("cline_excav_001", "2024-03-01", "2024-03-08", 8);
    const cimInput = buildSaveInput("cline_cim_002", "2024-03-09", "2024-03-20", 12, "01.01FS");
    const estInput = buildSaveInput("cline_est_003", "2024-03-21", "2024-03-30", 10, "01.02FS");

    await saveWorkScheduleItem(BUDGET_ID, USER_ID, excavInput);
    await saveWorkScheduleItem(BUDGET_ID, USER_ID, cimInput);
    await saveWorkScheduleItem(BUDGET_ID, USER_ID, estInput);

    // Sanity: 3 items persistidos en el mock store
    expect(mockDb.workScheduleItems.size).toBe(3);
    expect(mockDb.workSchedule?.budgetId).toBe(BUDGET_ID);

    // Recalcular critical path desde los items persistidos
    const lines = loadLinesFromMockDb();
    const criticalPath = calculateWorkScheduleCriticalPath(lines as any);

    // Envelope
    expect(criticalPath.status).toBe("calculated");
    expect(criticalPath.issues).toEqual([]);
    expect(criticalPath.itemsByBudgetItemId.size).toBe(3);

    // Duracion del proyecto = suma de las 3 partidas en cadena FS puro
    expect(criticalPath.projectDurationDays).toBe(30); // 8 + 12 + 10

    // Las 3 partidas son criticas (FS puro sin slack)
    expect(criticalPath.itemsByBudgetItemId.get("cline_excav_001")?.isCritical).toBe(true);
    expect(criticalPath.itemsByBudgetItemId.get("cline_cim_002")?.isCritical).toBe(true);
    expect(criticalPath.itemsByBudgetItemId.get("cline_est_003")?.isCritical).toBe(true);
    expect(criticalPath.itemsByBudgetItemId.get("cline_excav_001")?.totalSlackDays).toBe(0);
    expect(criticalPath.itemsByBudgetItemId.get("cline_cim_002")?.totalSlackDays).toBe(0);
    expect(criticalPath.itemsByBudgetItemId.get("cline_est_003")?.totalSlackDays).toBe(0);

    // Cross-invariant: ultima partida cierra el proyecto (earlyFinishDay + 1 === projectDurationDays)
    const lastItem = criticalPath.itemsByBudgetItemId.get("cline_est_003");
    if (!lastItem) throw new Error("expected cline_est_003 in critical path");
    expect(lastItem.earlyFinishDay + 1).toBe(criticalPath.projectDurationDays);
  });

  it("agent-level patch (extender duration via saveWorkScheduleItemPatch) preserva invariants del critical path recalculado", async () => {
    // Setup inicial igual al test anterior
    await saveWorkScheduleItem(
      BUDGET_ID,
      USER_ID,
      buildSaveInput("cline_excav_001", "2024-03-01", "2024-03-08", 8),
    );
    await saveWorkScheduleItem(
      BUDGET_ID,
      USER_ID,
      buildSaveInput("cline_cim_002", "2024-03-09", "2024-03-20", 12, "01.01FS"),
    );
    await saveWorkScheduleItem(
      BUDGET_ID,
      USER_ID,
      buildSaveInput("cline_est_003", "2024-03-21", "2024-03-30", 10, "01.02FS"),
    );

    const initialCriticalPath = calculateWorkScheduleCriticalPath(loadLinesFromMockDb() as any);
    expect(initialCriticalPath.projectDurationDays).toBe(30);

    // Agent tool (moveTask / updateTask) extiende Excav de 8 a 14 dias
    const patch: WorkScheduleItemPatchInput = {
      budgetItemId: "cline_excav_001",
      durationDays: 14,
    };
    await saveWorkScheduleItemPatch(BUDGET_ID, USER_ID, patch);

    // Verifica que el patch persistio el cambio (endDate rederivado a partir de startDate + new duration)
    const excavItem = mockDb.workScheduleItems.get("cline_excav_001");
    expect(excavItem?.durationDays).toBe(14);

    // Recalcular critical path desde el store actualizado
    const updatedCriticalPath = calculateWorkScheduleCriticalPath(loadLinesFromMockDb() as any);

    // El critical path recalculado:
    //  - sigue siendo "calculated" (no ciclo introducido por el patch)
    //  - incluye las 3 partidas (no se eliminaron items)
    //  - projectDurationDays >= 30 (porque Excav duro +6 dias)
    expect(updatedCriticalPath.status).toBe("calculated");
    expect(updatedCriticalPath.itemsByBudgetItemId.size).toBe(3);
    expect(updatedCriticalPath.projectDurationDays).toBeGreaterThan(30);

    // Excav refleja el patch
    const excavItemAfter = updatedCriticalPath.itemsByBudgetItemId.get("cline_excav_001");
    expect(excavItemAfter?.durationDays).toBe(14);

    // Ninguna partida tiene slack negativo (no se introdujeron ciclos en la cadena)
    for (const item of updatedCriticalPath.itemsByBudgetItemId.values()) {
      expect(item.totalSlackDays).toBeGreaterThanOrEqual(0);
    }

    // Cross-invariant: la nueva duracion critica es al menos la suma de
    // durations actualizados del chain (Excav 14, Cim/Estr permanecen pero sus
    // startDates pueden haberse desplazado via cascada si el recalculo asi lo decide).
    // En FS puro sin cascada agresiva, la nueva duracion critica >= 14 + 12 + 10 = 36
    expect(updatedCriticalPath.projectDurationDays).toBeGreaterThanOrEqual(36);
  });

  it("idempotencia: una segunda llamada con el mismo input produce WorkScheduleViewRecord equivalente", async () => {
    const excavInput = buildSaveInput("cline_excav_001", "2024-03-01", "2024-03-08", 8);

    const firstView = await saveWorkScheduleItem(BUDGET_ID, USER_ID, excavInput);
    const secondView = await saveWorkScheduleItem(BUDGET_ID, USER_ID, excavInput);

    // Envelope: ambos retornan WorkScheduleViewRecord
    expect(firstView.budgetId).toBe(BUDGET_ID);
    expect(secondView.budgetId).toBe(BUDGET_ID);

    // Sane regression: el mock store tiene SOLO 1 item (no duplicado por upsert)
    expect(mockDb.workScheduleItems.size).toBe(1);

    // Sane regression: critical path es identico tras las 2 calls (mismo estado persistido)
    const criticalPath = calculateWorkScheduleCriticalPath(loadLinesFromMockDb() as any);
    expect(criticalPath.status).toBe("calculated");
    expect(criticalPath.projectDurationDays).toBe(8); // single partida

    // Ambos views tienen la misma cantidad de partidas (1)
    const firstLineCount = firstView.groups?.reduce?.((sum: number, g: any) => sum + (g.lines?.length ?? 0), 0) ?? 0;
    const secondLineCount = secondView.groups?.reduce?.((sum: number, g: any) => sum + (g.lines?.length ?? 0), 0) ?? 0;
    expect(firstLineCount).toBeGreaterThan(0);
    expect(secondLineCount).toBe(firstLineCount);
  });
});
