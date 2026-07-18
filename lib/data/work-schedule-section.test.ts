/**
 * Real consumer del patron `makeMockDb()` bundle documentado en
 * `docs/superpowers/specs/2026-07-17-work-schedule-test-pattern-design.md` §
 * "Two usage modes → makeMockDb() factory". Materializa el ejemplo como codigo
 * ejecutable y verifica que `getWorkScheduleSection(LIB/DATA/WORK-SCHEDULE.TS)`
 * puede ejercitarse end-to-end a traves del prisma mock compartido sin tocar
 * una base de datos real.
 *
 * Cubre 3 dimensiones:
 * 1. Real data assertion — la funcion retorna un WorkScheduleViewRecord bien
 *    poblado con sub-budgets y partidas del fixture baseline.
 * 2. Custom-fixture extension — partidas adicionales via `addMockBudgetItem`
 *    se proyectan al output (no solo el baseline de 3).
 * 3. Bundle wiring — `bundle.prismaMock` es la misma referencia que la usada
 *    por el codigo bajo test, permitiendo assertions via toHaveBeenCalledTimes.
 *
 * NOTA sobre el patron: el naive `vi.hoisted(() => makeMockDb())` NO funciona
 * en vitest porque `vi.hoisted` corre ANTES de que los imports estaticos
 * esten inicializados. La solucion adopted (Pattern C del design review) es:
 *   1. vi.hoisted declara un SHELL sincronico `{ current: null | Bundle }`
 *   2. vi.mock factory awaits import + popula el shell dinamicamente
 *   3. Tests acceden `bundleRef.current` sincronico (vi.mock factory ya corrio)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { InMemoryPrisma } from "@/lib/data/__mocks__/in-memory-prisma";

// =============================================================================
// MOCK WIRING — Pattern C: vi.hoisted sync shell + vi.mock factory populates it
// =============================================================================

const bundleRef = vi.hoisted<{ current: InMemoryPrisma | null }>(() => ({ current: null }));

vi.mock("@/lib/db/prisma", async () => {
  const { makeMockDb } = await import("@/lib/data/__mocks__/in-memory-prisma");
  bundleRef.current = makeMockDb();
  return { prisma: bundleRef.current.prismaMock };
});

// Imports DEBAJO del vi.mock — vitest levanta el factory antes de evaluar los
// imports del codigo bajo test. NO re-importar mockDb desde la singleton default
// porque introduciria confusion entre singleton y bundle.
import { getWorkScheduleSection } from "@/lib/data/work-schedule";

/**
 * Helper que retorna el bundle populated by vi.mock factory. Throws si se
 * llama antes de que vi.mock factory haya corrido (que seria un bug).
 */
function requireBundle(): InMemoryPrisma {
  if (bundleRef.current === null) {
    throw new Error("Bundle no inicializado: vi.mock factory debio haber corrido primero.");
  }
  return bundleRef.current;
}

// =============================================================================
// TESTS
// =============================================================================

describe("getWorkScheduleSection — makeMockDb() bundle consumer", () => {
  beforeEach(() => {
    // Limpia state del bundle + mockClear todos los vi.fn. Cada test arranca
    // con estado virgen, sin contaminacion cross-test.
    const bundle = requireBundle();
    bundle.reset();
    bundle.populateDefault();
  });

  it("proyecta el fixture baseline: 1 sub-budget Estructuras con 3 partidas (01.01/01.02/01.03)", async () => {
    const view = await getWorkScheduleSection("budget-001", "user-001");

    // Envelope identity
    expect(view.budgetId).toBe("budget-001");
    expect(view.budgetName).toBe("Presupuesto Test General");
    expect(view.projectName).toBe("Proyecto Test MC Presupuestos");
    expect(view.currency).toBe("PEN");
    // fixture default: projectCalendars: [] -> workCalendar null
    expect(view.workCalendar).toBeNull();

    // Groups: el fixture default tiene un sub-budget (Estructuras)
    expect(view.groups.length).toBe(1);
    const group = view.groups[0];
    expect(group.subBudgetId).toBe("sub-budget-001");
    expect(group.subBudgetName).toBe("Estructuras");
    // totalAmount refleja S/ de partidas SIN schedule persistido: `buildWorkScheduleView`
    // suma line.partial incluso cuando startDate=null (el schedule se calcula al
    // persistir, pero el subtotal presupuestal esta disponible siempre).
    expect(group.totalAmount).toBe(28075); // 6250 + 3825 + 18000

    // 3 partidas baseline proyectadas con sus codigos reales
    expect(group.lines.length).toBe(3);
    const codes = group.lines.map((line) => line.itemCode).sort();
    expect(codes).toEqual(["01.01", "01.02", "01.03"]);

    // Cross-invariant: el partial total = suma de los 3 items del fixture
    const totalPartial = group.lines.reduce((sum, line) => sum + line.partial, 0);
    expect(totalPartial).toBe(28075); // 6250 + 3825 + 18000
  });

  it("proyecta partidas custom agregadas via bundle.addMockBudgetItem (8 partidas totales)", async () => {
    const bundle = requireBundle();
    // Extender el baseline de 3 con 5 partidas adicionales en el mismo sub-budget
    bundle.addMockBudgetItem({
      id: "cline_extra_004",
      code: "01.04",
      description: "Losa aligerada",
      unit: "m2",
      quantity: 80,
      unitPrice: 50,
      partial: 4000,
    });
    bundle.addMockBudgetItem({
      id: "cline_extra_005",
      code: "01.05",
      description: "Columnas de concreto",
      unit: "und",
      quantity: 12,
      unitPrice: 200,
      partial: 2400,
    });
    bundle.addMockBudgetItem({
      id: "cline_extra_006",
      code: "01.06",
      description: "Vigas de concreto",
      unit: "m",
      quantity: 60,
      unitPrice: 90,
      partial: 5400,
    });
    bundle.addMockBudgetItem({
      id: "cline_extra_007",
      code: "01.07",
      description: "Muros de albañileria",
      unit: "m2",
      quantity: 200,
      unitPrice: 35,
      partial: 7000,
    });
    bundle.addMockBudgetItem({
      id: "cline_extra_008",
      code: "01.08",
      description: "Techos",
      unit: "m2",
      quantity: 150,
      unitPrice: 40,
      partial: 6000,
    });

    const view = await getWorkScheduleSection("budget-001", "user-001");

    // Cross-invariant: lines count crece de 3 -> 8
    expect(view.groups.length).toBe(1);
    expect(view.groups[0].lines.length).toBe(8);

    // Todos los codigos baseline + custom presentes (sort deterministico)
    const codes = view.groups[0].lines.map((line) => line.itemCode).sort();
    expect(codes).toEqual([
      "01.01",
      "01.02",
      "01.03",
      "01.04",
      "01.05",
      "01.06",
      "01.07",
      "01.08",
    ]);

    // Cross-invariant: partial total refleja las 5 partidas adicionales
    // baseline total = 28075 + customs = 4000+2400+5400+7000+6000 = 24800
    // grand total = 52875
    const totalPartial = view.groups[0].lines.reduce((sum, line) => sum + line.partial, 0);
    expect(totalPartial).toBe(52875);

    // Las partidas custom aparecen con su codigo y descripcion especificos
    const losa = view.groups[0].lines.find((line) => line.itemCode === "01.04");
    expect(losa?.description).toBe("Losa aligerada");
    expect(losa?.unit).toBe("m2");
    expect(losa?.quantity).toBe(80);
    expect(losa?.partial).toBe(4000);
  });

  it("wiring: bundle.prismaMock es la misma ref que el codigo bajo test consume", async () => {
    const bundle = requireBundle();
    // El reset() del beforeEach arriba ya panea los counts, asi que cualquier
    // call desde este test sera un delta limpio.
    expect(bundle.prismaMock.budget.findFirst).toHaveBeenCalledTimes(0);
    expect(bundle.prismaMock.budget.findMany).toHaveBeenCalledTimes(0);
    expect(bundle.prismaMock.workSchedule.findUnique).toHaveBeenCalledTimes(0);

    await getWorkScheduleSection("budget-001", "user-001");

    // El factory wiring funciona: getWorkScheduleSection dispara:
    //   1x prisma.budget.findFirst via getAccessibleGeneralBudget
    //   1x prisma.workSchedule.findUnique via loadWorkScheduleDataset
    //   1x prisma.budget.findMany via getSubBudgetsForProject (sub-budget lookup)
    expect(bundle.prismaMock.budget.findFirst).toHaveBeenCalledTimes(1);
    expect(bundle.prismaMock.budget.findMany).toHaveBeenCalledTimes(1);
    expect(bundle.prismaMock.workSchedule.findUnique).toHaveBeenCalledTimes(1);

    // Cross-invariant: la shape del where clause de findFirst matchea kind:GENERAL e id:budget-001
    const findFirstArg = bundle.prismaMock.budget.findFirst.mock.calls[0]?.[0];
    expect(findFirstArg?.where).toMatchObject({ kind: "GENERAL", id: "budget-001" });
  });

  it("isolation via beforeEach: bundle.reset() + populateDefault() entre tests previene contaminacion", async () => {
    const bundle = requireBundle();
    // Test A: customize con un item extra, verifica lines.length=4
    bundle.addMockBudgetItem({
      id: "cline_isolation_tracer",
      code: "01.99",
      description: "Tracer de isolation",
      unit: "und",
      quantity: 1,
      unitPrice: 1,
      partial: 1,
    });
    const viewWithTracer = await getWorkScheduleSection("budget-001", "user-001");
    expect(viewWithTracer.groups[0].lines.length).toBe(4);
    expect(
      viewWithTracer.groups[0].lines.some((line) => line.itemCode === "01.99"),
    ).toBe(true);

    // El `vitest describe` no ha llamado beforeEach de nuevo dentro del mismo
    // test, asi que el state esta mutado. Para VALIDAR que `bundle.reset()` +
    // `bundle.populateDefault()` restauran el baseline, los invocamos
    // manualmente mid-test y verificamos que la mutacion desaparece.
    bundle.reset();
    bundle.populateDefault();

    const viewAfterReset = await getWorkScheduleSection("budget-001", "user-001");
    expect(viewAfterReset.groups[0].lines.length).toBe(3); // baseline restored
    expect(
      viewAfterReset.groups[0].lines.some((line) => line.itemCode === "01.99"),
    ).toBe(false);
  });
});
