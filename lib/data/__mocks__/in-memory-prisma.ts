/**
 * In-memory Prisma mock server para tests del módulo work-schedule +
 * extension opt-in para modulos resource catalog (lib/data/resources.ts).
 *
 * Patron de uso en el consumer:
 *
 * ```typescript
 * vi.mock("@/lib/db/prisma", async () => {
 *   const { prismaMock } = await import("@/lib/data/__mocks__/in-memory-prisma");
 *   return { prisma: prismaMock };
 * });
 *
 * import {
 *   mockDb,
 *   resetInMemoryState,
 *   populateDefaultWorkScheduleFixture,
 * } from "@/lib/data/__mocks__/in-memory-prisma";
 *
 * beforeEach(() => {
 *   resetInMemoryState();
 *   populateDefaultWorkScheduleFixture();
 * });
 * ```
 *
 * Para tests que requieren state verdaderamente aislado (no compartido cross-tests
 * del archivo), usar `makeMockDb()` y trabajar con el bundle retornado.
 * Para tests que solo necesitan catalog de resources (sin work-schedule),
 * `populateDefaultResourcesFixture()` puede invocarse aisladamente.
 *
 * vi.hoisted NO necesario en el consumer — el dynamic import dentro del factory
 * de vi.mock resuelve la captura del singleton en runtime via el module cache.
 *
 * Mantenido por: tests de lib/data/work-schedule.ts + lib/data/resources.ts.
 */

import { vi, type MockedFunction } from "vitest";

// =============================================================================
// TIPOS PUBLICOS
// =============================================================================

export type MockBudgetItem = {
  id: string;
  budgetId: string;
  levelId: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  sortOrder: number;
  apu: unknown | null;
};

export type MockLevel = {
  id: string;
  budgetId: string;
  parentId: string | null;
  type: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type MockSubBudget = {
  id: string;
  projectId: string;
  name: string;
  levels: MockLevel[];
  items: MockBudgetItem[];
};

export type ResourceCategory = "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT";

export type MockResource = {
  id: string;
  companyId: string | null;
  code: string;
  description: string;
  category: ResourceCategory;
  iu: string | null;
  iuCurrent: string | null;
  subcategory: string | null;
  unit: string;
  unitPrice: number;
  currency: string;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MockBudgetGeneral = {
  id: string;
  projectId: string;
  name: string;
  currency: string;
  project: {
    id: string;
    name: string;
    projectCalendars: unknown[];
  };
};

export type MockWorkScheduleItem = {
  id: string;
  scheduleId: string;
  budgetItemId: string;
  startDate: Date | string;
  endDate: Date | string;
  durationDays: number;
  predecessor: string | null;
  crew: string | null;
  isMilestone: boolean;
  baselineStartDate: Date | string | null;
  baselineEndDate: Date | string | null;
  actualStartDate: Date | string | null;
  actualEndDate: Date | string | null;
  percentComplete: number | null;
};

export type MockDb = {
  budgetGeneral: MockBudgetGeneral | null;
  subBudgets: MockSubBudget[];
  workSchedule: { id: string; budgetId: string } | null;
  workScheduleItems: Map<string, MockWorkScheduleItem>;
  workScheduleDistributions: Map<string, unknown[]>;
  resources: Map<string, MockResource>;
  apuResources: Map<string, Array<{ id: string }>>;
};

export type MockTx = {
  workSchedule: {
    upsert: MockedFunction<(args: { where: { budgetId: string } }) => Promise<{ id: string }>>;
    findUnique: MockedFunction<
      (args: { where: { budgetId: string } }) => Promise<{ id: string } | null>
    >;
  };
  workScheduleItem: {
    findUnique: MockedFunction<
      (args: { where: { scheduleId_budgetItemId: { budgetItemId: string } } }) => Promise<
        { id: string } | null
      >
    >;
    findMany: MockedFunction<
      (args: {
        where: {
          budgetItemId: { in?: string[] } | string[];
          scheduleId: string;
        };
      }) => Promise<Array<{ id: string; budgetItemId: string }>>
    >;
    create: MockedFunction<
      (args: {
        data: Omit<MockWorkScheduleItem, "id"> & {
          distributions?: { createMany?: { data: unknown[] } };
        };
      }) => Promise<MockWorkScheduleItem>
    >;
    update: MockedFunction<
      (args: {
        where: { id: string };
        data: Partial<MockWorkScheduleItem> & {
          distributions?: { createMany?: { data: unknown[] } };
        };
      }) => Promise<MockWorkScheduleItem>
    >;
  };
  workScheduleDistribution: {
    deleteMany: MockedFunction<
      (args: { where: { scheduleItemId: string } }) => Promise<{ count: number }>
    >;
  };
  resource: {
    findMany: MockedFunction<
      (args?: {
        where?: { companyId?: string | null; category?: string; id?: { not?: string } };
        select?: { code?: boolean };
        orderBy?: unknown;
      }) => Promise<unknown[]>
    >;
    count: MockedFunction<(args?: { where?: { id?: { in?: string[] }; companyId?: string | null } }) => Promise<number>>;
    findFirst: MockedFunction<
      (args: {
        where?: { id?: string; OR?: unknown };
        include?: { apuResources?: boolean };
        select?: { companyId?: boolean };
      }) => Promise<unknown>
    >;
    create: MockedFunction<
      (args: {
        data: {
          code: string;
          description: string;
          category: ResourceCategory;
          unit: string;
          unitPrice: number;
          currency?: string;
          iu?: string | null;
          iuCurrent?: string | null;
          subcategory?: string | null;
          source?: string | null;
          company?: { connect?: { id: string } };
        };
      }) => Promise<MockResource>
    >;
    update: MockedFunction<
      (args: {
        where: { id: string };
        data: Partial<MockResource>;
      }) => Promise<MockResource>
    >;
    delete: MockedFunction<(args: { where: { id: string } }) => Promise<MockResource>>;
  };
};

export type PrismaMock = {
  $transaction: MockedFunction<
    (cb: (tx: MockTx) => Promise<unknown>) => Promise<unknown>
  >;
  budget: {
    findFirst: MockedFunction<
      (args: { where: { kind: string; id?: string } }) => Promise<MockBudgetGeneral | null>
    >;
    findMany: MockedFunction<
      (args: {
        where: { kind: string; projectId: string };
      }) => Promise<MockSubBudget[]>
    >;
  };
  budgetItem: {
    findFirst: MockedFunction<
      (args: {
        where: { id: string; budget?: { projectId: string; kind?: string } };
      }) => Promise<{ id: string; code: string; budget: { items: { code: string }[] } } | null>
    >;
  };
  workSchedule: {
    findUnique: MockedFunction<
      (args: {
        where: { budgetId: string };
        include?: { items?: boolean };
      }) => Promise<
        | { id: string; items?: Array<MockWorkScheduleItem & { distributions: unknown[] }> }
        | null
      >
    >;
  };
  resource: {
    findMany: MockedFunction<
      (args?: {
        where?: { companyId?: string | null; category?: string; id?: { not?: string } };
        select?: { code?: boolean };
        orderBy?: unknown;
      }) => Promise<unknown[]>
    >;
    count: MockedFunction<(args?: { where?: { id?: { in?: string[] }; companyId?: string | null } }) => Promise<number>>;
    findFirst: MockedFunction<
      (args: {
        where?: { id?: string; OR?: unknown };
        include?: { apuResources?: boolean };
        select?: { companyId?: boolean };
      }) => Promise<unknown>
    >;
    create: MockedFunction<
      (args: {
        data: {
          code: string;
          description: string;
          category: ResourceCategory;
          unit: string;
          unitPrice: number;
          currency?: string;
          iu?: string | null;
          iuCurrent?: string | null;
          subcategory?: string | null;
          source?: string | null;
          company?: { connect?: { id: string } };
        };
      }) => Promise<MockResource>
    >;
    update: MockedFunction<
      (args: {
        where: { id: string };
        data: Partial<MockResource>;
      }) => Promise<MockResource>
    >;
    delete: MockedFunction<(args: { where: { id: string } }) => Promise<MockResource>>;
  };
};

export type InMemoryPrisma = {
  mockDb: MockDb;
  mockTx: MockTx;
  prismaMock: PrismaMock;
  reset: () => void;
  populateDefault: () => void;
  populateDefaultResourcesFixture: () => void;
  addMockBudgetItem: (overrides: Partial<MockBudgetItem> & { id: string }) => MockBudgetItem;
  addMockSubBudget: (
    overrides: Partial<MockSubBudget> & { id: string; name: string },
  ) => MockSubBudget;
  addMockResource: (overrides: Partial<MockResource> & { id: string }) => MockResource;
};

// =============================================================================
// CONSTANTES POR DEFECTO (fixtures baseline)
// =============================================================================

export const DEFAULT_PROJECT_ID = "project-001";
export const DEFAULT_BUDGET_ID = "budget-001";
export const DEFAULT_SUB_BUDGET_ID = "sub-budget-001";
export const DEFAULT_SUB_BUDGET_NAME = "Estructuras";
export const DEFAULT_LEVEL_ID = "level-01";
export const DEFAULT_LEVEL_CODE = "01";

const EXCAV_ID = "cline_excav_001";
const CIM_ID = "cline_cim_002";
const EST_ID = "cline_est_003";

export const DEFAULT_RESOURCE_MAT_001 = "res-mat-cement";
export const DEFAULT_RESOURCE_MAT_002 = "res-mat-sand";
export const DEFAULT_RESOURCE_EQ_001 = "res-eq-mixer";

// =============================================================================
// HELPERS DE COLECCION
// =============================================================================

function collectAllMockFns(
  ...sources: Array<Record<string, unknown>>
): Array<MockedFunction<(...args: unknown[]) => unknown>> {
  const seen = new WeakSet<object>();
  const out: Array<MockedFunction<(...args: unknown[]) => unknown>> = [];

  const walk = (obj: unknown): void => {
    if (obj === null || typeof obj !== "object") return;
    if (seen.has(obj as object)) return;
    seen.add(obj as object);
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (vi.isMockFunction(v)) {
        out.push(v as MockedFunction<(...args: unknown[]) => unknown>);
      } else if (typeof v === "object" && v !== null) {
        walk(v);
      }
    }
  };

  for (const s of sources) walk(s);
  return out;
}

function createEmptyMockDb(): MockDb {
  return {
    budgetGeneral: null,
    subBudgets: [],
    workSchedule: null,
    workScheduleItems: new Map(),
    workScheduleDistributions: new Map(),
    resources: new Map(),
    apuResources: new Map(),
  };
}

// =============================================================================
// FACTORIES (closures lockean state via referencia capturada)
// =============================================================================

/**
 * Construye los handlers prisma.resource.* compartidos entre prismaMock (top-level)
 * y mockTx.resource (dentro de transactions). Ambos casos lockean la misma
 * instancia de mockDb.resources via closure.
 *
 * Implementa la logica filtrante minima para que `resources.ts` pueda correr
 * sin Postgres real:
 * - findMany: filtra por companyId, category, id.not (auto-generate code lookup)
 * - count: cuenta resources matching where
 * - findFirst (con include apuResources): usado por deleteResource para validar
 *   que el resource no este usado en un APU antes de borrar
 * - create/update: persist + return con timestamps
 * - delete: remove + return
 */
function buildResourceHandlers(mockDb: MockDb): MockTx["resource"] {
  const findMany = vi.fn(
    async (args?: {
      where?: { companyId?: string | null; category?: string; id?: { not?: string } };
      select?: { code?: boolean };
    }) => {
      let list = Array.from(mockDb.resources.values());
      if (args?.where?.companyId !== undefined) {
        list = list.filter((r) => r.companyId === args.where!.companyId);
      }
      if (args?.where?.category) {
        list = list.filter((r) => r.category === args.where!.category);
      }
      if (args?.where?.id?.not) {
        const exclude = args.where.id.not;
        list = list.filter((r) => r.id !== exclude);
      }
      if (args?.select?.code) {
        return list.map((r) => ({ code: r.code }));
      }
      return list;
    },
  );

  const count = vi.fn(
    async (args?: { where?: { id?: { in?: string[] }; companyId?: string | null } }) => {
      let list = Array.from(mockDb.resources.values());
      if (args?.where?.id?.in) {
        const ids = args.where.id.in;
        list = list.filter((r) => ids.includes(r.id));
      }
      if (args?.where?.companyId !== undefined) {
        list = list.filter((r) => r.companyId === args.where!.companyId);
      }
      return list.length;
    },
  );

  const findFirst = vi.fn(
    async (args: {
      where?: { id?: string; OR?: unknown };
      include?: { apuResources?: boolean };
      select?: { companyId?: boolean };
    }) => {
      if (args?.where?.id) {
        const res = mockDb.resources.get(args.where.id);
        if (!res) return null;
        if (args.include?.apuResources) {
          return { ...res, apuResources: mockDb.apuResources.get(args.where.id) ?? [] };
        }
        if (args.select?.companyId) {
          return { companyId: res.companyId };
        }
        return res;
      }
      // OR clause (used by updateResource inside tx): findFirst with OR[company-membership-or-global]
      // Simplified: return first resource matching where.id OR any
      if (args?.where?.OR) {
        // Skip detailed OR evaluation; return null to indicate "not found via OR path".
        // Update flow expects this; if not found, update just won't execute.
        return null;
      }
      return null;
    },
  );

  const create = vi.fn(
    async ({
      data,
    }: {
      data: {
        code: string;
        description: string;
        category: ResourceCategory;
        unit: string;
        unitPrice: number;
        currency?: string;
        iu?: string | null;
        iuCurrent?: string | null;
        subcategory?: string | null;
        source?: string | null;
        company?: { connect?: { id: string } };
      };
    }) => {
      const id = `res-${Math.random().toString(36).slice(2, 8)}`;
      const resource: MockResource = {
        id,
        companyId: data.company?.connect?.id ?? null,
        code: data.code,
        description: data.description,
        category: data.category,
        iu: data.iu ?? null,
        iuCurrent: data.iuCurrent ?? null,
        subcategory: data.subcategory ?? null,
        unit: data.unit,
        unitPrice: data.unitPrice,
        currency: data.currency ?? "PEN",
        source: data.source ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.resources.set(id, resource);
      return resource;
    },
  );

  const update = vi.fn(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<MockResource>;
    }) => {
      const target = mockDb.resources.get(where.id);
      if (!target) {
        throw new Error(`Mock resource ${where.id} not found`);
      }
      Object.assign(target, data, { updatedAt: new Date() });
      return target;
    },
  );

  const del = vi.fn(async ({ where }: { where: { id: string } }) => {
    const target = mockDb.resources.get(where.id);
    if (!target) {
      throw new Error(`Mock resource ${where.id} not found`);
    }
    mockDb.resources.delete(where.id);
    return target;
  });

  return { findMany, count, findFirst, create, update, delete: del };
}

function createMockTx(mockDb: MockDb): MockTx {
  const tx: MockTx = {
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
    resource: buildResourceHandlers(mockDb),
  };

  tx.workSchedule.upsert.mockImplementation(async ({ where }) => {
    const existing = mockDb.workSchedule;
    if (existing !== null && existing.budgetId === where.budgetId) {
      return { id: existing.id };
    }
    mockDb.workSchedule = { id: "ws-default", budgetId: where.budgetId };
    return { id: "ws-default" };
  });

  tx.workSchedule.findUnique.mockImplementation(async ({ where }) => {
    const existing = mockDb.workSchedule;
    if (
      where &&
      where.budgetId !== undefined &&
      existing !== null &&
      existing.budgetId === where.budgetId
    ) {
      return { id: existing.id };
    }
    return null;
  });

  tx.workScheduleItem.findUnique.mockImplementation(async ({ where }) => {
    const k = where.scheduleId_budgetItemId?.budgetItemId;
    const item = mockDb.workScheduleItems.get(k);
    return item ? { id: item.id } : null;
  });

  tx.workScheduleItem.findMany.mockImplementation(async ({ where }) => {
    const ids: string[] =
      (where.budgetItemId && "in" in where.budgetItemId && where.budgetItemId.in) ||
      (Array.isArray(where.budgetItemId) ? where.budgetItemId : []);
    const out: { id: string; budgetItemId: string }[] = [];
    for (const id of ids) {
      const item = mockDb.workScheduleItems.get(id);
      if (item && item.scheduleId === where.scheduleId) {
        out.push({ id: item.id, budgetItemId: item.budgetItemId });
      }
    }
    return out;
  });

  tx.workScheduleItem.create.mockImplementation(async ({ data }) => {
    const id = `wsi-${Math.random().toString(36).slice(2)}`;
    const item: MockWorkScheduleItem = {
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

  tx.workScheduleItem.update.mockImplementation(async ({ where, data }) => {
    let target: MockWorkScheduleItem | null = null;
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

  tx.workScheduleDistribution.deleteMany.mockImplementation(async ({ where }) => {
    const existing = mockDb.workScheduleDistributions.get(where.scheduleItemId);
    const count = existing?.length ?? 0;
    mockDb.workScheduleDistributions.set(where.scheduleItemId, []);
    return { count };
  });

  return tx;
}

function createPrismaMock(mockDb: MockDb, mockTx: MockTx): PrismaMock {
  return {
    $transaction: vi.fn(async (cb) => cb(mockTx)),
    budget: {
      findFirst: vi.fn(async ({ where }) => {
        if (where.kind !== "GENERAL") return null;
        if (where.id && mockDb.budgetGeneral?.id !== where.id) return null;
        return mockDb.budgetGeneral;
      }),
      findMany: vi.fn(async ({ where }) => {
        if (where.kind !== "SUB_BUDGET") return [];
        return mockDb.subBudgets.filter((sb) => sb.projectId === where.projectId);
      }),
    },
    budgetItem: {
      findFirst: vi.fn(async ({ where }) => {
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
      findUnique: vi.fn(async ({ where, include }) => {
        const existing = mockDb.workSchedule;
        if (
          where &&
          where.budgetId !== undefined &&
          existing !== null &&
          existing.budgetId === where.budgetId
        ) {
          if (include?.items) {
            const items = Array.from(mockDb.workScheduleItems.values()).map((item) => ({
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
    resource: buildResourceHandlers(mockDb),
  };
}

// =============================================================================
// FIXTURE POPULATORS
// =============================================================================

function populateDefaultWorkScheduleFixtureImpl(mockDb: MockDb): void {
  mockDb.budgetGeneral = {
    id: DEFAULT_BUDGET_ID,
    projectId: DEFAULT_PROJECT_ID,
    name: "Presupuesto Test General",
    currency: "PEN",
    project: {
      id: DEFAULT_PROJECT_ID,
      name: "Proyecto Test MC Presupuestos",
      projectCalendars: [],
    },
  };

  mockDb.subBudgets = [
    {
      id: DEFAULT_SUB_BUDGET_ID,
      projectId: DEFAULT_PROJECT_ID,
      name: DEFAULT_SUB_BUDGET_NAME,
      levels: [
        {
          id: DEFAULT_LEVEL_ID,
          budgetId: DEFAULT_SUB_BUDGET_ID,
          parentId: null,
          type: "TITLE",
          code: DEFAULT_LEVEL_CODE,
          name: DEFAULT_SUB_BUDGET_NAME,
          sortOrder: 1,
        },
      ],
      items: [
        {
          id: EXCAV_ID,
          budgetId: DEFAULT_SUB_BUDGET_ID,
          levelId: DEFAULT_LEVEL_ID,
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
          id: CIM_ID,
          budgetId: DEFAULT_SUB_BUDGET_ID,
          levelId: DEFAULT_LEVEL_ID,
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
          id: EST_ID,
          budgetId: DEFAULT_SUB_BUDGET_ID,
          levelId: DEFAULT_LEVEL_ID,
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

function addMockBudgetItemImpl(
  mockDb: MockDb,
  overrides: Partial<MockBudgetItem> & { id: string },
): MockBudgetItem {
  if (mockDb.subBudgets.length === 0) {
    throw new Error("addMockBudgetItem requiere populateDefaultWorkScheduleFixture primero.");
  }
  const sub = mockDb.subBudgets[0];
  const base: MockBudgetItem = {
    id: overrides.id,
    budgetId: sub.id,
    levelId: overrides.levelId ?? DEFAULT_LEVEL_ID,
    code: overrides.code ?? "00.00",
    description: overrides.description ?? "(sin descripcion)",
    unit: overrides.unit ?? "UND",
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 0,
    partial: overrides.partial ?? 0,
    sortOrder: overrides.sortOrder ?? sub.items.length + 1,
    apu: overrides.apu ?? null,
  };
  const idx = sub.items.findIndex((it) => it.id === base.id);
  if (idx >= 0) {
    sub.items[idx] = base;
  } else {
    sub.items.push(base);
  }
  return base;
}

function addMockSubBudgetImpl(
  mockDb: MockDb,
  overrides: Partial<MockSubBudget> & { id: string; name: string },
): MockSubBudget {
  if (!mockDb.budgetGeneral) {
    throw new Error("addMockSubBudget requiere populateDefaultWorkScheduleFixture primero.");
  }
  const sub: MockSubBudget = {
    id: overrides.id,
    projectId: overrides.projectId ?? mockDb.budgetGeneral.projectId,
    name: overrides.name,
    levels: overrides.levels ?? [],
    items: overrides.items ?? [],
  };
  const idx = mockDb.subBudgets.findIndex((sb) => sb.id === sub.id);
  if (idx >= 0) {
    mockDb.subBudgets[idx] = sub;
  } else {
    mockDb.subBudgets.push(sub);
  }
  return sub;
}

function addMockResourceImpl(
  mockDb: MockDb,
  overrides: Partial<MockResource> & { id: string },
): MockResource {
  const resource: MockResource = {
    id: overrides.id,
    companyId: overrides.companyId ?? null,
    code: overrides.code ?? "MAT-000",
    description: overrides.description ?? "(sin descripcion)",
    category: overrides.category ?? "MATERIAL",
    iu: overrides.iu ?? null,
    iuCurrent: overrides.iuCurrent ?? null,
    subcategory: overrides.subcategory ?? null,
    unit: overrides.unit ?? "UND",
    unitPrice: overrides.unitPrice ?? 0,
    currency: overrides.currency ?? "PEN",
    source: overrides.source ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
  mockDb.resources.set(resource.id, resource);
  return resource;
}

function populateDefaultResourcesFixtureImpl(mockDb: MockDb): void {
  addMockResourceImpl(mockDb, {
    id: DEFAULT_RESOURCE_MAT_001,
    companyId: null,
    code: "MAT-001",
    description: "Cemento Portland tipo I",
    category: "MATERIAL",
    unit: "bls",
    unitPrice: 28,
  });
  addMockResourceImpl(mockDb, {
    id: DEFAULT_RESOURCE_MAT_002,
    companyId: null,
    code: "MAT-002",
    description: "Arena gruesa",
    category: "MATERIAL",
    unit: "m3",
    unitPrice: 45,
  });
  addMockResourceImpl(mockDb, {
    id: DEFAULT_RESOURCE_EQ_001,
    companyId: null,
    code: "EQ-001",
    description: "Mezcladora de concreto",
    category: "EQUIPMENT",
    unit: "hm",
    unitPrice: 18,
  });
}

function createReset(mockDb: MockDb, mockTx: MockTx, prismaMock: PrismaMock): () => void {
  return () => {
    mockDb.budgetGeneral = null;
    mockDb.subBudgets = [];
    mockDb.workSchedule = null;
    mockDb.workScheduleItems.clear();
    mockDb.workScheduleDistributions.clear();
    mockDb.resources.clear();
    mockDb.apuResources.clear();
    const allMockFns = collectAllMockFns(
      mockTx as unknown as Record<string, unknown>,
      prismaMock as unknown as Record<string, unknown>,
    );
    for (const fn of allMockFns) {
      fn.mockClear();
    }
  };
}

// =============================================================================
// FACTORY PUBLICA
// =============================================================================

export function makeMockDb(): InMemoryPrisma {
  const mockDb = createEmptyMockDb();
  const mockTx = createMockTx(mockDb);
  const prismaMock = createPrismaMock(mockDb, mockTx);
  const reset = createReset(mockDb, mockTx, prismaMock);
  const populateDefault = () => populateDefaultWorkScheduleFixtureImpl(mockDb);
  const populateDefaultResourcesFixture = () => populateDefaultResourcesFixtureImpl(mockDb);
  const addMockBudgetItem = (overrides: Partial<MockBudgetItem> & { id: string }) =>
    addMockBudgetItemImpl(mockDb, overrides);
  const addMockSubBudget = (overrides: Partial<MockSubBudget> & { id: string; name: string }) =>
    addMockSubBudgetImpl(mockDb, overrides);
  const addMockResource = (overrides: Partial<MockResource> & { id: string }) =>
    addMockResourceImpl(mockDb, overrides);
  return {
    mockDb,
    mockTx,
    prismaMock,
    reset,
    populateDefault,
    populateDefaultResourcesFixture,
    addMockBudgetItem,
    addMockSubBudget,
    addMockResource,
  };
}

// =============================================================================
// DEFAULT SINGLETON (eager init en module load para backward compat)
// =============================================================================

const _default = makeMockDb();
export const mockDb: MockDb = _default.mockDb;
export const mockTx: MockTx = _default.mockTx;
export const prismaMock: PrismaMock = _default.prismaMock;

export function resetInMemoryState(): void {
  _default.reset();
}

export function populateDefaultWorkScheduleFixture(): void {
  _default.populateDefault();
}

/**
 * Popula el mockDb con 3 recursos globales baseline (Cemento MAT-001, Arena
 * MAT-002, Mezcladora EQ-001). Llamar antes de tests que esperan catalog
 * no vacio. NO requiere populateDefaultWorkScheduleFixture.
 */
export function populateDefaultResourcesFixture(): void {
  _default.populateDefaultResourcesFixture();
}

/**
 * @deprecated usar `bundle.addMockBudgetItem()` o el singleton via import directo.
 */
export function addMockBudgetItem(overrides: Partial<MockBudgetItem> & { id: string }): MockBudgetItem {
  return _default.addMockBudgetItem(overrides);
}

/**
 * @deprecated usar `bundle.addMockSubBudget()` o el singleton via import directo.
 */
export function addMockSubBudget(
  overrides: Partial<MockSubBudget> & { id: string; name: string },
): MockSubBudget {
  return _default.addMockSubBudget(overrides);
}

/**
 * Agrega un resource al catalog. Llamar despues de `populateDefaultResourcesFixture()`
 * o en lugar de este si solo se necesitan resources custom.
 */
export function addMockResource(overrides: Partial<MockResource> & { id: string }): MockResource {
  return _default.addMockResource(overrides);
}
