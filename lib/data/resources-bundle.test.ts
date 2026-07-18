/**
 * Consumer test para el in-memory prisma extension (Pattern C bundle).
 *
 * Materializa el ejemplo del §"Two usage modes → makeMockDb() factory" del
 * spec doc como un consumidor real de los handlers de `prisma.resource.*`.
 *
 * Esta test NO cubre los mismos recursos que `lib/data/resources.test.ts`:
 * ese test cubre la funcion pura `mergeVisibleResourcesForCatalog` (sin
 * tocar Prisma). Esta test cubre el camino Prisma-via-in-memory-mock
 * que el extension del modulo shared (Round 5 de commits) habilito.
 *
 * Funcionalmente:
 * - Verifica que `mockDb.resources` se popula correctamente via el fixture helper.
 * - Verifica que los handlers prismaMock.resource.{findMany, count, findFirst,
 *   create, update, delete} respetan el contrato minimo que `lib/data/resources.ts`
 *   espera.
 * - Verifica que `resourceMutationTouchesGlobalCatalog(resourceIds)` — funcion
 *   exportada de resources.ts que solo depende de `prisma.resource.count` —
 *   end-to-end funciona contra el in-memory mock.
 * - Verifica isolation via `bundle.reset()` (relevant para tests paralelos).
 *
 * Pattern C: vi.hoisted sync shell { current: InMemoryPrisma | null } populated
 * by vi.mock factory via `await import`. Detalles en
 * docs/superpowers/specs/2026-07-17-work-schedule-test-pattern-design.md.
 *
 * Nota TS-strict: los handlers del mock devuelven `Promise<unknown[]>` /
 * `Promise<unknown>` para mantener compat con el codigo de produccion que
 * tipea via el `Prisma.Resource*` generado. Los consumidores castean al
 * tipo estructural esperado (MockResource o proyecciones como `{ code: string }`)
 * al site de uso — esto NO requiere `any` y mantiene AGENTS.md "Never use any".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InMemoryPrisma, MockResource } from "@/lib/data/__mocks__/in-memory-prisma";

// Pattern C bundle — sync shell populated asynchronously by vi.mock factory.
const bundleRef = vi.hoisted<{ current: InMemoryPrisma | null }>(() => ({ current: null }));

vi.mock("@/lib/db/prisma", async () => {
  const { makeMockDb } = await import("@/lib/data/__mocks__/in-memory-prisma");
  bundleRef.current = makeMockDb();
  return { prisma: bundleRef.current.prismaMock };
});

import {
  DEFAULT_RESOURCE_MAT_001,
  DEFAULT_RESOURCE_MAT_002,
  DEFAULT_RESOURCE_EQ_001,
} from "@/lib/data/__mocks__/in-memory-prisma";
import { resourceMutationTouchesGlobalCatalog } from "@/lib/data/resources";

type ResourceCodeProjection = { code: string };
type ResourceCompanyIdProjection = { companyId: string | null };
type ResourceWithApuResources = MockResource & { apuResources: Array<{ id: string }> };

// Helper defensivo: bundle Ref solo se popula en el factory de vi.mock.
// Si requireBundle se invoca antes que el factory (e.g. durante una refactor
// que mueve el mock), el test fallara con un mensaje claro en vez de un NPE.
function requireBundle(): InMemoryPrisma {
  if (!bundleRef.current) {
    throw new Error(
      "[resources-bundle.test] bundleRef.current not populated — vi.mock factory should have populated it. "
        + "Check that vi.mock is declared BEFORE the static import of @/lib/data/resources.",
    );
  }
  return bundleRef.current;
}

describe("resources.ts + in-memory prisma extension", () => {
  beforeEach(() => {
    const bundle = requireBundle();
    bundle.reset();
    bundle.populateDefaultResourcesFixture();
  });

  afterEach(() => {
    // Garantizar isolation incluso si un test falla mid-flight:
    // clear all mock call history y blank state para que el siguiente test
    // empiece desde un fixture conocido.
    requireBundle().reset();
  });

  it("populates 3 default resources after populateDefaultResourcesFixture()", () => {
    const { mockDb } = requireBundle();
    expect(mockDb.resources.size).toBe(3);
    expect(mockDb.resources.get(DEFAULT_RESOURCE_MAT_001)?.code).toBe("MAT-001");
    expect(mockDb.resources.get(DEFAULT_RESOURCE_MAT_001)?.category).toBe("MATERIAL");
    expect(mockDb.resources.get(DEFAULT_RESOURCE_MAT_001)?.unitPrice).toBe(28);
    expect(mockDb.resources.get(DEFAULT_RESOURCE_MAT_002)?.code).toBe("MAT-002");
    expect(mockDb.resources.get(DEFAULT_RESOURCE_EQ_001)?.code).toBe("EQ-001");
    expect(mockDb.resources.get(DEFAULT_RESOURCE_EQ_001)?.category).toBe("EQUIPMENT");
  });

  it("prismaMock.resource.findMany filters by category", async () => {
    const { prismaMock } = requireBundle();

    const materialsOnly = (await prismaMock.resource.findMany({
      where: { category: "MATERIAL" },
    })) as MockResource[];
    expect(materialsOnly).toHaveLength(2);
    expect(materialsOnly.every((r) => r.category === "MATERIAL")).toBe(true);

    const equipmentOnly = (await prismaMock.resource.findMany({
      where: { category: "EQUIPMENT" },
    })) as MockResource[];
    expect(equipmentOnly).toHaveLength(1);

    const laborOnly = (await prismaMock.resource.findMany({
      where: { category: "LABOR" },
    })) as MockResource[];
    expect(laborOnly).toHaveLength(0);
  });

  it("prismaMock.resource.findMany filters by companyId (global vs scoped)", async () => {
    const { prismaMock, addMockResource } = requireBundle();
    addMockResource({
      id: "res-company-001",
      companyId: "company-1",
      code: "MAT-100",
      description: "Recurso de empresa",
      category: "MATERIAL",
      unit: "bls",
      unitPrice: 50,
    });

    const globalOnly = (await prismaMock.resource.findMany({
      where: { companyId: null },
    })) as MockResource[];
    expect(globalOnly).toHaveLength(3);
    expect(globalOnly.every((r) => r.companyId === null)).toBe(true);

    const companyScoped = (await prismaMock.resource.findMany({
      where: { companyId: "company-1" },
    })) as MockResource[];
    expect(companyScoped).toHaveLength(1);
    expect(companyScoped[0]?.id).toBe("res-company-001");
  });

  it("prismaMock.resource.findMany with select: { code } returns { code } projections", async () => {
    const { prismaMock } = requireBundle();
    const projections = (await prismaMock.resource.findMany({
      select: { code: true },
    })) as ResourceCodeProjection[];
    expect(projections).toHaveLength(3);
    expect(projections.every((row) => typeof row.code === "string")).toBe(true);
  });

  it("generateNextResourceCode path: findMany with id.not excludes the resource being updated", async () => {
    const { prismaMock } = requireBundle();
    // resources.ts::generateNextResourceCode calls findMany with
    // { where: { category, companyId, id: { not: excludeId } }, select: { code: true } }
    // when generating the next code for an UPDATE.
    const codes = (await prismaMock.resource.findMany({
      where: { category: "MATERIAL", companyId: null, id: { not: DEFAULT_RESOURCE_MAT_001 } },
      select: { code: true },
    })) as ResourceCodeProjection[];
    expect(codes).toHaveLength(1);
    expect(codes[0]?.code).toBe("MAT-002"); // Only MAT-002 remains after excluding MAT-001
  });

  it("resourceMutationTouchesGlobalCatalog → true when IDs include a global resource", async () => {
    const { prismaMock } = requireBundle();
    const reached = await resourceMutationTouchesGlobalCatalog([
      DEFAULT_RESOURCE_MAT_001,
      DEFAULT_RESOURCE_MAT_002,
    ]);
    expect(reached).toBe(true);

    expect(prismaMock.resource.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.resource.count).toHaveBeenCalledWith({
      where: {
        id: { in: [DEFAULT_RESOURCE_MAT_001, DEFAULT_RESOURCE_MAT_002] },
        companyId: null,
      },
    });
  });

  it("resourceMutationTouchesGlobalCatalog → false when all IDs are unknown", async () => {
    const reached = await resourceMutationTouchesGlobalCatalog(["non-existent-xyz", "another-fake"]);
    expect(reached).toBe(false);
  });

  it("resourceMutationTouchesGlobalCatalog → false and skips prisma when IDs are empty", async () => {
    const { prismaMock } = requireBundle();
    const reached = await resourceMutationTouchesGlobalCatalog([]);
    expect(reached).toBe(false);
    // Short-circuit at length === 0: prisma.resource.count not called.
    expect(prismaMock.resource.count).not.toHaveBeenCalled();
  });

  it("resourceMutationTouchesGlobalCatalog → false when IDs only match company-scoped resources", async () => {
    const { addMockResource } = requireBundle();
    addMockResource({
      id: "res-company-only",
      companyId: "company-9",
      code: "MAT-200",
      description: "Solo de empresa",
      category: "MATERIAL",
      unit: "bls",
      unitPrice: 10,
    });

    const reached = await resourceMutationTouchesGlobalCatalog(["res-company-only"]);
    expect(reached).toBe(false);
  });

  it("prismaMock.resource.create + findFirst + update + delete full CRUD lifecycle", async () => {
    const { prismaMock, mockDb } = requireBundle();

    const created = (await prismaMock.resource.create({
      data: {
        code: "MAT-099",
        description: "Recurso de prueba",
        category: "MATERIAL",
        unit: "bls",
        unitPrice: 25,
      },
    })) as MockResource;
    expect(created.code).toBe("MAT-099");
    expect(created.id).toBeTruthy();
    expect(mockDb.resources.has(created.id)).toBe(true);

    const found = (await prismaMock.resource.findFirst({
      where: { id: created.id },
    })) as MockResource | null;
    expect(found?.code).toBe("MAT-099");
    expect(found?.unitPrice).toBe(25);

    const updated = (await prismaMock.resource.update({
      where: { id: created.id },
      data: { unitPrice: 30 },
    })) as MockResource;
    expect(updated.unitPrice).toBe(30);
    expect(mockDb.resources.get(created.id)?.unitPrice).toBe(30);

    const deleted = (await prismaMock.resource.delete({
      where: { id: created.id },
    })) as MockResource;
    expect(deleted.id).toBe(created.id);
    expect(mockDb.resources.has(created.id)).toBe(false);

    // After delete: findFirst should return null.
    const afterDelete = (await prismaMock.resource.findFirst({
      where: { id: created.id },
    })) as MockResource | null;
    expect(afterDelete).toBeNull();
  });

  it("findFirst with include: { apuResources } returns nested apuResources array (used by deleteResource safety check)", async () => {
    const { prismaMock, mockDb, addMockResource } = requireBundle();
    addMockResource({
      id: "res-used-in-apu",
      code: "MO-001",
      description: "Capataz",
      category: "LABOR",
      unit: "HH",
      unitPrice: 25,
    });
    // Mock the apuResources lookup that deleteResource uses to refuse deletion
    // of resources already referenced in any APU.
    mockDb.apuResources.set("res-used-in-apu", [{ id: "apu-res-linkage-1" }]);

    const found = (await prismaMock.resource.findFirst({
      where: { id: "res-used-in-apu" },
      include: { apuResources: true },
    })) as ResourceWithApuResources | null;
    expect(found).not.toBeNull();
    expect(found?.apuResources).toHaveLength(1);
    expect(found?.apuResources[0]?.id).toBe("apu-res-linkage-1");

    // Same id without include: should return raw resource (no apuResources field).
    const bareFound = (await prismaMock.resource.findFirst({
      where: { id: "res-used-in-apu" },
    })) as MockResource | null;
    expect(bareFound?.id).toBe("res-used-in-apu");
  });

  it("findFirst with select: { companyId } returns the companyId projection (used by resourcePatchTouchesGlobalCatalog)", async () => {
    const { prismaMock } = requireBundle();
    const projection = (await prismaMock.resource.findFirst({
      where: { id: DEFAULT_RESOURCE_MAT_001 },
      select: { companyId: true },
    })) as ResourceCompanyIdProjection | null;
    expect(projection).toEqual({ companyId: null });
  });

  it("isolation: bundle.reset() restores baseline state and clears mock call history", () => {
    const bundle = requireBundle();
    expect(bundle.mockDb.resources.size).toBe(3);

    bundle.reset();
    expect(bundle.mockDb.resources.size).toBe(0);

    bundle.populateDefaultResourcesFixture();
    expect(bundle.mockDb.resources.size).toBe(3);

    bundle.prismaMock.resource.findMany.mockClear();
    void bundle.prismaMock.resource.findMany({ where: {} });
    expect(bundle.prismaMock.resource.findMany.mock.calls.length).toBe(1);
  });
});
