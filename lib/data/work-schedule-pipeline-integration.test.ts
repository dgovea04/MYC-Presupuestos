import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WorkScheduleItemSaveInput, WorkScheduleItemPatchInput } from "@/lib/validations/work-schedule";

// =============================================================================
// MOCK PRISMA — dynamic import para resolver captura del singleton en Vitest
// sin tener que usar vi.hoisted en este archivo. Node module cache asegura que
// todos los tests del archivo comparten la misma instancia de `mockDb`.
// =============================================================================

vi.mock("@/lib/db/prisma", async () => {
  const { prismaMock } = await import("@/lib/data/__mocks__/in-memory-prisma");
  return { prisma: prismaMock };
});

// Los imports del codigo bajo test deben ir DESPUES del vi.mock para que
// vitest levante el factory antes. Si los movemos arriba, capturaremos la
// implementacion real en lugar del mock.
import {
  mockDb,
  mockTx,
  resetInMemoryState,
  populateDefaultWorkScheduleFixture,
  DEFAULT_BUDGET_ID,
  DEFAULT_SUB_BUDGET_ID,
} from "@/lib/data/__mocks__/in-memory-prisma";
import { saveWorkScheduleItem, saveWorkScheduleItemPatch } from "@/lib/data/work-schedule";
import { calculateWorkScheduleCriticalPath } from "@/lib/work-schedule/critical-path";

// =============================================================================
// CONSTANTES LOCALES (solo IDs, no fixtures — los fixtures viven en el modulo)
// =============================================================================

const BUDGET_ID = DEFAULT_BUDGET_ID;
const USER_ID = "user-001";

// =============================================================================
// HELPERS ESPECIFICOS DEL PIPELINE (no compartibles con otros tests)
// =============================================================================

/**
 * Reconstruye WorkScheduleLineRecord[] a partir del in-memory store post-save.
 * Es el equivalente in-memory de `loadWorkScheduleDataset` sin pasar por todas
 * las queries de Prisma. Pipeline-specific: no vive en el modulo compartido.
 */
function loadLinesFromMockDb(): Array<{
  budgetItemId: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  subBudgetId: string;
  subBudgetName: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  predecessor: string | null;
}> {
  const itemsById = mockDb.subBudgets.flatMap((sb) => sb.items);
  return Array.from(mockDb.workScheduleItems.values()).map((item) => {
    const meta = itemsById.find((it) => it.id === item.budgetItemId);
    const toIso = (v: Date | string | null) =>
      v instanceof Date
        ? v.toISOString().slice(0, 10)
        : typeof v === "string"
          ? v
          : null;
    return {
      budgetItemId: item.budgetItemId,
      itemCode: meta?.code ?? "?",
      description: meta?.description ?? "",
      unit: meta?.unit ?? "UND",
      quantity: meta?.quantity ?? 1,
      unitPrice: meta?.unitPrice ?? 1,
      partial: meta?.partial ?? 0,
      subBudgetId: DEFAULT_SUB_BUDGET_ID,
      subBudgetName: "Estructuras",
      startDate: toIso(item.startDate),
      endDate: toIso(item.endDate),
      durationDays: item.durationDays,
      predecessor: item.predecessor,
    } as const;
  });
}

/**
 * Constructor ergonomico para WorkScheduleItemSaveInput. Crea una distribucion
 * mensual del 100% en el mes del startDate (work-schedule exige >=1 distribucion).
 */
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
    resetInMemoryState();
    populateDefaultWorkScheduleFixture();
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

    // Patch respeta campos no-provistos: startDate permanece intacto en el store.
    // Esto fija el contrato "patch aplica solo delta; campos ausentes se preservan".
    expect(excavItem?.startDate instanceof Date).toBe(true);
    if (excavItem?.startDate instanceof Date) {
      expect(excavItem.startDate.toISOString().slice(0, 10)).toBe("2024-03-01");
    }

    // Recalcular critical path desde el store actualizado
    const updatedCriticalPath = calculateWorkScheduleCriticalPath(loadLinesFromMockDb() as any);

    // Envelope stability tras patch
    expect(updatedCriticalPath.status).toBe("calculated");
    expect(updatedCriticalPath.itemsByBudgetItemId.size).toBe(3);

    // Excav refleja el patch en el critical path recalculado
    const excavItemAfter = updatedCriticalPath.itemsByBudgetItemId.get("cline_excav_001");
    expect(excavItemAfter?.durationDays).toBe(14);

    // Computed exact: la cascade aplica lazy-shift (cada dependiente arranca
    // el dia siguiente al fin de su predecessor, sin lag explicito). Resultado:
    //   Excav 2024-03-14 -> Cim start 2024-03-15 -> Cim end 2024-03-26
    //   -> Est start 2024-03-27 -> Est end 2024-04-05
    // Span = 2024-03-01 .. 2024-04-05 = 36 calendar days inclusive.
    // Si el algoritmo agrega lag explicito entre cada par, el valor seria 37+.
    // Si difiere en una iteracion futura, ajustar con:
    //   expect(updatedCriticalPath.projectDurationDays).toMatchInlineSnapshot(`36`);
    expect(updatedCriticalPath.projectDurationDays).toBe(36);

    // Cascada propaga: Cim (predecessor FS puro de Excav) arranca 1 dia despues
    // del nuevo fin de Excav (2024-03-14 + 1 = 2024-03-15). Est a su vez se
    // desplaza en cascada desde Cim.
    const cimItem = mockDb.workScheduleItems.get("cline_cim_002");
    const estItem = mockDb.workScheduleItems.get("cline_est_003");
    expect(cimItem?.startDate instanceof Date).toBe(true);
    expect(estItem?.startDate instanceof Date).toBe(true);
    if (cimItem?.startDate instanceof Date && estItem?.startDate instanceof Date) {
      expect(cimItem.startDate.toISOString().slice(0, 10)).toBe("2024-03-15");
      expect(estItem.startDate.toISOString().slice(0, 10)).toBe("2024-03-27");
    }

    // Ninguna partida tiene slack negativo tras el patch
    for (const item of updatedCriticalPath.itemsByBudgetItemId.values()) {
      expect(item.totalSlackDays).toBeGreaterThanOrEqual(0);
    }
  });

  it("idempotencia: una segunda llamada con el mismo input produce WorkScheduleViewRecord equivalente", async () => {
    const excavInput = buildSaveInput("cline_excav_001", "2024-03-01", "2024-03-08", 8);

    const firstView = await saveWorkScheduleItem(BUDGET_ID, USER_ID, excavInput);
    const secondView = await saveWorkScheduleItem(BUDGET_ID, USER_ID, excavInput);

    // Envelope: ambos retornan WorkScheduleViewRecord con budgetId identity
    expect(firstView.budgetId).toBe(BUDGET_ID);
    expect(secondView.budgetId).toBe(BUDGET_ID);

    // Cross-invariant: misma identidad entre views
    expect(firstView.budgetId).toBe(secondView.budgetId);

    // Sanity: 1 item persistido (no duplicado por upsert)
    expect(mockDb.workScheduleItems.size).toBe(1);

    // Critical path recalculado desde store: estado consistente tras 2 calls
    const criticalPath = calculateWorkScheduleCriticalPath(loadLinesFromMockDb() as any);
    expect(criticalPath.status).toBe("calculated");
    expect(criticalPath.projectDurationDays).toBe(8); // single partida

    // Tx call counts: la 2da llamada debe reciclar el upsert sin recrear el item
    expect(mockTx.workSchedule.upsert).toHaveBeenCalledTimes(2); // 1ra crea, 2da recyle
    expect(mockTx.workScheduleItem.create).toHaveBeenCalledTimes(1); // solo en la 1ra
  });
});
