/**
 * 4th Pattern C consumer test para el in-memory prisma extension.
 *
 * Complementa `lib/data/resources-bundle.test.ts` (cubrio resourceMutationT
 * ouchesGlobalCatalog end-to-end + find/count/first handlers) cubriendo las
 * mutating functions de `lib/data/resources.ts`:
 *   - createResource
 *   - createResourceForUser (con workspace check)
 *   - updateResource (con regenerate-code paths)
 *   - deleteResource (con apuResources safety check)
 *   - saveResourcesPatch (via $transaction, combinado create/update/delete)
 *
 * Round 7 task surface. Mock layer adicional: @/lib/workspace/access se
 * stubbea via vi.mock (no via spy en el import real) para que los tests puedan
 * controlar la respuesta de assertWorkspaceMembership sin tocar Postgres real.
 * El bundle de in-memory prisma sigue siendo Pattern C (vi.hoisted shell +
 * vi.mock factory populate via await import).
 *
 * Limitaciones conocidas del mock que validan estos tests:
 *   - findFirst con `where: { id, company: { memberships: { some: ... } } }`
 *     resuelve solo por `where.id` (la empresa membership-query no se modela).
 *     En test, esto significa que CUALQUIER resource con id matching en mockDb
 *     pasa el workspace-check via query. La capa workspace.mock cubre la ruta
 *     directa (companyId input + assertWorkspaceMembership).
 *   - generateNextResourceCode llama findMany(select:code) filtrando por
 *     companyId + category. Mock respeta los 2 filtros principales.
 *   - findFirst con `include: { apuResources: <objeto> }` se considera truthy
 *     (no solo `true` literal) para cubrir `include: { apuResources: { select,
 *     take } }` que deleteResource/saveResourcesPatch pasan en produccion.
 *
 * Inputs compatibles con Zod: `companyId: z.string().optional()` acepta omit
 * o `undefined` pero NO `null`. Si un test quiere "resource global", deja
 * fuera el campo (no usar `null`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InMemoryPrisma } from "@/lib/data/__mocks__/in-memory-prisma";

// =============================================================================
// Pattern C bundle for prisma (sync shell populated by vi.mock factory)
// =============================================================================

const bundleRef = vi.hoisted<{ current: InMemoryPrisma | null }>(() => ({ current: null }));

vi.mock("@/lib/db/prisma", async () => {
  const { makeMockDb } = await import("@/lib/data/__mocks__/in-memory-prisma");
  bundleRef.current = makeMockDb();
  return { prisma: bundleRef.current.prismaMock };
});

// =============================================================================
// Workspace access: stub assertWorkspaceMembership as a separate layer.
// by default: mockResolvedValue({ companyId: "company-mock", role: "ADMIN" })
// se mantiene entre tests a menos que un test override con mockRejectedValueOnce
// o mockImplementationOnce. mockClear en afterEach resetea call history.
// =============================================================================

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: vi.fn().mockResolvedValue({
    companyId: "company-mock",
    role: "ADMIN",
  }),
}));

// =============================================================================
// Static imports resolved AFTER vi.mock declarations
// =============================================================================

import {
  createResource,
  createResourceForUser,
  updateResource,
  deleteResource,
  saveResourcesPatch,
} from "@/lib/data/resources";
import { assertWorkspaceMembership } from "@/lib/workspace/access";

function requireBundle(): InMemoryPrisma {
  if (!bundleRef.current) {
    throw new Error(
      "[resources-mutating-bundle.test] bundleRef.current not populated \u2014 vi.mock factory should have populated it. "
        + "Check that vi.mock is declared BEFORE the static import of @/lib/data/resources.",
    );
  }
  return bundleRef.current;
}

// =============================================================================
// Test fixtures constants
// =============================================================================

const USER_ID = "user-author-001";
const COMPANY_ID = "company-mock";

describe("resources.ts mutating functions + in-memory prisma + workspace stub", () => {
  beforeEach(() => {
    const bundle = requireBundle();
    bundle.reset();
    // No populateDefaultResourcesFixture: queremos state vacio para que cada
    // test pueble explicitamente via addMockResource (evita interferences
    // cross-test con resources seeded por el fixture general).
  });

  afterEach(() => {
    requireBundle().reset();
    // Clear workspace mock call history entre tests.
    vi.mocked(assertWorkspaceMembership).mockClear();
  });

  // ---------------------------------------------------------------------------
  // createResource \u2014 no workspace check (variante simple)
  // ---------------------------------------------------------------------------

  it("createResource \u2192 genera codigo MAT-001 (first in category GLOBAL), persiste, normaliza description/unit", async () => {
    const { mockDb } = requireBundle();
    const created = await createResource({
      // Sin companyId \u2192 category en global.
      category: "MATERIAL",
      description: "  Ladrillo King Kong 18 huecos  ", // trimmed
      unit: "  UND  ", // trimmed
      unitPrice: 120,
      currency: "PEN",
    });

    expect(created.code).toBe("MAT-001");
    expect(created.description).toBe("Ladrillo King Kong 18 huecos");
    expect(created.unit).toBe("UND");
    expect(created.unitPrice).toBe(120);
    expect(created.category).toBe("MATERIAL");

    // Persistencia via mockDb.resources
    const persisted = mockDb.resources.get(created.id);
    expect(persisted).toBeDefined();
    expect(persisted?.code).toBe("MAT-001");
    expect(persisted?.description).toBe("Ladrillo King Kong 18 huecos");
  });

  it("createResource \u2192 segundo MATERIAL GLOBAL \u2192 MAT-002 (next secuence)", async () => {
    const created1 = await createResource({
      category: "MATERIAL",
      description: "Cemento Portland bolsa 42.5 kg",
      unit: "bls",
      unitPrice: 28,
      currency: "PEN",
    });
    const created2 = await createResource({
      category: "MATERIAL",
      description: "Arena gruesa m3",
      unit: "m3",
      unitPrice: 45,
      currency: "PEN",
    });

    expect(created1.code).toBe("MAT-001");
    expect(created2.code).toBe("MAT-002");
  });

  it("createResource \u2192 company-scoped code (MAT-001 per company, isolated del global)", async () => {
    // Global MAT-001 ya existe (de cualquier test anterior o si re-seed)
    // pero createResource(companyId: COMPANY_ID, MATERIAL) genera MAT-001
    // para ESA empresa sin colisionar con global.
    const created = await createResource({
      companyId: COMPANY_ID,
      category: "MATERIAL",
      description: "Recurso scoped a company-mock",
      unit: "bls",
      unitPrice: 99,
      currency: "PEN",
    });
    expect(created.code).toBe("MAT-001");
    expect(created.companyId).toBe(COMPANY_ID);
  });

  // ---------------------------------------------------------------------------
  // createResourceForUser \u2014 workspace check IS triggered when companyId set
  // ---------------------------------------------------------------------------

  it("createResourceForUser con companyId \u2192 invoca assertWorkspaceMembership(EDITOR)", async () => {
    const { mockDb } = requireBundle();
    await createResourceForUser(USER_ID, {
      companyId: COMPANY_ID,
      category: "LABOR",
      description: "Capataz de obra",
      unit: "HH",
      unitPrice: 25,
      currency: "PEN",
    });

    expect(assertWorkspaceMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        companyId: COMPANY_ID,
        minimumRole: "EDITOR",
      }),
    );

    // Persistencia en mockDb.resources verificada via iteracion.
    const allResources = Array.from(mockDb.resources.values());
    expect(allResources).toHaveLength(1);
    const onlyResource = allResources[0]!;
    expect(onlyResource.category).toBe("LABOR");
    expect(onlyResource.companyId).toBe(COMPANY_ID);
    expect(onlyResource.code).toBe("MO-001"); // LABOR prefix
  });

  it("createResourceForUser sin companyId \u2192 workspace check NO se invoca, persiste como global", async () => {
    const created = await createResourceForUser(USER_ID, {
      // companyId omitido \u2192 zod's .optional() lo trata como undefined \u2192
      // normalized.companyId = null \u2192 branch if(normalized.companyId) skip.
      category: "EQUIPMENT",
      description: "Mezcladora de concreto 9pc",
      unit: "hm",
      unitPrice: 18,
      currency: "PEN",
    });

    expect(assertWorkspaceMembership).not.toHaveBeenCalled();
    expect(created.companyId).toBeUndefined();
    expect(created.code).toBe("EQ-001");
    expect(created.category).toBe("EQUIPMENT");
  });

  it("createResourceForUser con companyId + workspace rejection \u2192 propagates the rejection", async () => {
    // createResourceForUser llama `assertWorkspaceMembership` DIRECTAMENTE
    // (sin el wrapper `assertCompanyOwnership` que re-throw).
    // El error que llega al caller es el mismo que el mock throw.
    vi.mocked(assertWorkspaceMembership).mockRejectedValueOnce(
      new Error("Forbidden: user is not a member of company"),
    );

    await expect(
      createResourceForUser(USER_ID, {
        companyId: COMPANY_ID,
        category: "LABOR",
        description: "Capataz rechazado",
        unit: "HH",
        unitPrice: 30,
        currency: "PEN",
      }),
    ).rejects.toThrow(/Forbidden: user is not a member of company/);
  });

  // ---------------------------------------------------------------------------
  // updateResource \u2014 findFirst via mock + optional companyId workspace check
  // ---------------------------------------------------------------------------

  it("updateResource \u2192 muta fields manteniendo mismo category (no regen codigo)", async () => {
    const { addMockResource, mockDb } = requireBundle();
    addMockResource({
      id: "res-pre-exist-001",
      companyId: COMPANY_ID,
      code: "MAT-001",
      description: "Old description",
      category: "MATERIAL",
      unit: "UND",
      unitPrice: 50,
      currency: "PEN",
    });

    const updated = await updateResource("res-pre-exist-001", USER_ID, {
      companyId: COMPANY_ID,
      category: "MATERIAL", // same
      description: "  Description trimmed OK  ",
      unit: "M2",
      unitPrice: 75,
      currency: "PEN",
    });

    expect(updated.description).toBe("Description trimmed OK");
    expect(updated.unit).toBe("M2");
    expect(updated.unitPrice).toBe(75);
    expect(updated.code).toBe("MAT-001"); // no regen
    // Persisted in mockDb
    expect(mockDb.resources.get("res-pre-exist-001")?.unitPrice).toBe(75);
    // Workspace check called (input has companyId)
    expect(assertWorkspaceMembership).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, companyId: COMPANY_ID }),
    );
  });

  it("updateResource \u2192 cambio CATEGORY regenera codigo (MATERIAL \u2192 LABOR = MO-001)", async () => {
    const { addMockResource } = requireBundle();
    addMockResource({
      id: "res-pre-exist-002",
      companyId: COMPANY_ID,
      code: "MAT-001",
      description: "Recurso que migra de category",
      category: "MATERIAL",
      unit: "UND",
      unitPrice: 50,
      currency: "PEN",
    });

    const updated = await updateResource("res-pre-exist-002", USER_ID, {
      companyId: COMPANY_ID,
      category: "LABOR", // change
      description: "Ahora como labor",
      unit: "HH",
      unitPrice: 25,
      currency: "PEN",
    });

    expect(updated.category).toBe("LABOR");
    expect(updated.code).toBe("MO-001"); // regenerated with LABOR prefix, excludes self.id in count
  });

  it("updateResource sin companyId en input \u2192 no invoca workspace check directamente", async () => {
    const { addMockResource } = requireBundle();
    addMockResource({
      id: "res-pre-exist-003",
      companyId: COMPANY_ID,
      code: "MAT-001",
      description: "Resource sin cambio de company",
      category: "MATERIAL",
      unit: "UND",
      unitPrice: 50,
      currency: "PEN",
    });

    await updateResource("res-pre-exist-003", USER_ID, {
      // sin companyId en input \u2192 normalizeOptionalString(\u00fandefined) = null \u2192
      // branch if(normalized.companyId) skip. Workspace check NOT invoked.
      // Note: el findFirst WHERE tambien modela membership pero el mock resuelve
      // por where.id \u2192 resource accesible. La mock devuelve el resource.
      category: "MATERIAL",
      description: "Mantenido en global",
      unit: "UND",
      unitPrice: 60,
      currency: "PEN",
    });

    expect(assertWorkspaceMembership).not.toHaveBeenCalled();
  });

  it("updateResource \u2192 resource no existe en mock \u2192 throw 'permisos'", async () => {
    await expect(
      updateResource("non-existent-id", USER_ID, {
        companyId: COMPANY_ID,
        category: "MATERIAL",
        description: "Intento update de fantasma",
        unit: "UND",
        unitPrice: 50,
        currency: "PEN",
      }),
    ).rejects.toThrow(/No tienes permisos para editar este insumo/);
  });

  // ---------------------------------------------------------------------------
  // deleteResource \u2014 apuResources safety check
  // ---------------------------------------------------------------------------

  it("deleteResource \u2192 elimina resource sin apuResources (happy path)", async () => {
    const { addMockResource, mockDb } = requireBundle();
    addMockResource({
      id: "res-delete-001",
      companyId: COMPANY_ID,
      code: "LAB-001",
      description: "Para borrar",
      category: "LABOR",
      unit: "HH",
      unitPrice: 25,
      currency: "PEN",
    });

    await deleteResource("res-delete-001", USER_ID);
    expect(mockDb.resources.has("res-delete-001")).toBe(false);
  });

  it("deleteResource \u2192 si resource esta en mockDb.apuResources \u2192 throw safety check", async () => {
    const { addMockResource, mockDb } = requireBundle();
    addMockResource({
      id: "res-delete-002",
      companyId: COMPANY_ID,
      code: "LAB-002",
      description: "Resource usado en APU",
      category: "LABOR",
      unit: "HH",
      unitPrice: 25,
      currency: "PEN",
    });
    // Register apuResources entry for the resource (used by mockDb.apuResources
    // to model the include path that deleteResource uses for safety check).
    mockDb.apuResources.set("res-delete-002", [{ id: "apu-resource-linkage-1" }]);

    await expect(deleteResource("res-delete-002", USER_ID)).rejects.toThrow(
      /No puedes eliminar un insumo que ya esta usado en un APU/,
    );
    // Resource still in mockDb (delete rejected)
    expect(mockDb.resources.has("res-delete-002")).toBe(true);
  });

  it("deleteResource \u2192 resource no existe en mock \u2192 throw 'permisos'", async () => {
    await expect(deleteResource("non-existent-id", USER_ID)).rejects.toThrow(
      /No tienes permisos para eliminar este insumo/,
    );
  });

  // ---------------------------------------------------------------------------
  // saveResourcesPatch \u2014 via $transaction, combined create + update + delete
  // ---------------------------------------------------------------------------

  it("saveResourcesPatch \u2192 ejecuta create + update + delete v\u00eda $transaction", async () => {
    const { addMockResource, mockDb, prismaMock } = requireBundle();
    addMockResource({
      id: "res-patch-update-001",
      companyId: COMPANY_ID,
      code: "MAT-001",
      description: "Resource a actualizar via patch",
      category: "MATERIAL",
      unit: "UND",
      unitPrice: 50,
      currency: "PEN",
    });
    addMockResource({
      id: "res-patch-delete-001",
      companyId: COMPANY_ID,
      code: "MAT-002",
      description: "Resource a borrar via patch",
      category: "MATERIAL",
      unit: "UND",
      unitPrice: 60,
      currency: "PEN",
    });

    const result = await saveResourcesPatch(USER_ID, {
      create: [
        {
          clientId: "client-c1",
          // ResourcePatchFields requires `code` (Pick<ResourceRecord, ...>).
          // saveResourcesPatch auto-generates via generateNextResourceCode(tx, ...) AFTER
          // normalizeResourceFields y BEFORE tx.resource.create, which sobreescribe este valor.
          // Por eso usamos un placeholder tipo-comentario — production lo ignora.
          data: {
            code: "AUTO-GENERATED-PLACEHOLDER",
            companyId: COMPANY_ID,
            category: "TOOLS",
            description: "Nuevo herramienta via patch",
            unit: "UND",
            unitPrice: 30,
            currency: "PEN",
          },
        },
      ],
      update: [
        {
          id: "res-patch-update-001",
          changes: {
            companyId: COMPANY_ID,
            description: "  Descripcion editada via patch  ",
            unitPrice: 99,
          },
        },
      ],
      delete: ["res-patch-delete-001"],
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0]?.clientId).toBe("client-c1");
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0]?.description).toBe("Descripcion editada via patch");
    expect(result.deleted).toEqual(["res-patch-delete-001"]);

    // Persistencia verificada
    const updatePersisted = mockDb.resources.get("res-patch-update-001");
    expect(updatePersisted?.description).toBe("Descripcion editada via patch");
    expect(updatePersisted?.unitPrice).toBe(99);
    expect(mockDb.resources.has("res-patch-delete-001")).toBe(false);

    const allResources = Array.from(mockDb.resources.values());
    const newResource = allResources.find((r) => r.code === "HER-001");
    expect(newResource).toBeDefined();
    expect(newResource?.description).toBe("Nuevo herramienta via patch");

    // $transaction fue invocado una sola vez
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("saveResourcesPatch \u2192 patch vacio (create/update/delete []) \u2192 resultado consistente", async () => {
    const { prismaMock } = requireBundle();
    const result = await saveResourcesPatch(USER_ID, {
      create: [],
      update: [],
      delete: [],
    });
    expect(result.created).toEqual([]);
    expect(result.updated).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});
