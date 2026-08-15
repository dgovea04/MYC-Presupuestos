/**
 * Test de integración para `seedAgentWorkflows`.
 *
 * Verifica el flujo completo desde WORKFLOW_TEMPLATES + SPECIALIST_BUNDLES
 * hasta las llamadas `upsert` a la base de datos, asegurando que cada
 * registro tenga los datos correctos según las definiciones en
 * `lib/ai/agent/workflows.ts`.
 *
 * La función acepta un PrismaClient como parámetro, por lo que se le pasa
 * un mock directo (sin vi.mock de módulo).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  WORKFLOW_TEMPLATES,
  SPECIALIST_BUNDLES,
  getBundleBySlug,
} from "@/lib/ai/agent/workflows";
import { seedAgentWorkflows } from "@/lib/data/seed-agent-workflows";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type UpsertCreateData = {
  slug: string;
  name: string;
  description: string;
  initialGoalTemplate: string;
  allowedToolsJson: string[];
  defaultMode: string;
  isActive: boolean;
};

type UpsertArgs = {
  where: { slug: string };
  create: UpsertCreateData;
  update: Omit<UpsertCreateData, "slug">;
};

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUpsert = vi.fn();

const mockPrisma = {
  agentWorkflow: {
    upsert: mockUpsert,
  },
} as unknown as PrismaClient;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findUpsertBySlug(slug: string): UpsertArgs | undefined {
  const call = mockUpsert.mock.calls.find(
    ([args]: [UpsertArgs]) => args.where.slug === slug,
  );
  return call?.[0] as UpsertArgs | undefined;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("seedAgentWorkflows integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockResolvedValue({});
  });

  // ─── Contrato: conteo de registros ─────────────────────────────────

  describe("record count", () => {
    it("upserts exactly one record per WORKFLOW_TEMPLATE (7 total)", async () => {
      const result = await seedAgentWorkflows(mockPrisma);

      expect(result.upserted).toBe(WORKFLOW_TEMPLATES.length);
      expect(mockUpsert).toHaveBeenCalledTimes(WORKFLOW_TEMPLATES.length);
      expect(result.errors).toEqual([]);
    });

    it("calls upsert for each workflow template slug exactly once", async () => {
      await seedAgentWorkflows(mockPrisma);

      const calledSlugs = mockUpsert.mock.calls.map(
        ([args]: [UpsertArgs]) => args.where.slug,
      );
      const uniqueSlugs = new Set(calledSlugs);

      expect(uniqueSlugs.size).toBe(WORKFLOW_TEMPLATES.length);
    });
  });

  // ─── Contrato de datos para cada template ───────────────────────────

  describe("data contract for each workflow template", () => {
    it.each(WORKFLOW_TEMPLATES.map((t) => [t.slug, t] as const))(
      "workflow '%s' upserts with correct data from WORKFLOW_TEMPLATES + bundle",
      async (_slug, template) => {
        await seedAgentWorkflows(mockPrisma);

        const args = findUpsertBySlug(template.slug);
        expect(args).toBeDefined();

        const bundle = getBundleBySlug(template.bundleSlug);
        expect(bundle).toBeDefined();

        // ── where ──────────────────────────────────────────────
        expect(args!.where.slug).toBe(template.slug);

        // ── create ─────────────────────────────────────────────
        expect(args!.create.slug).toBe(template.slug);
        expect(args!.create.name).toBe(template.name);
        expect(args!.create.description).toBe(template.description);
        expect(args!.create.initialGoalTemplate).toBe(template.initialGoal);
        expect(args!.create.defaultMode).toBe(template.defaultMode);
        expect(args!.create.isActive).toBe(true);
        expect(args!.create.allowedToolsJson).toEqual(bundle!.toolNames);

        // ── update ─────────────────────────────────────────────
        // update debe contener los mismos campos que create (excepto slug)
        expect(args!.update.name).toBe(template.name);
        expect(args!.update.description).toBe(template.description);
        expect(args!.update.initialGoalTemplate).toBe(template.initialGoal);
        expect(args!.update.defaultMode).toBe(template.defaultMode);
        expect(args!.update.isActive).toBe(true);
        expect(args!.update.allowedToolsJson).toEqual(bundle!.toolNames);
      },
    );
  });

  // ─── Verificación: create y update son idempotentes ────────────────

  describe("idempotency", () => {
    it("create and update objects are identical (same data for insert vs update)", async () => {
      await seedAgentWorkflows(mockPrisma);

      for (let i = 0; i < WORKFLOW_TEMPLATES.length; i++) {
        const args = mockUpsert.mock.calls[i][0] as UpsertArgs;
        // Exclude slug from comparison (slug only in create, not in update)
        expect(args.create.name).toBe(args.update.name);
        expect(args.create.description).toBe(args.update.description);
        expect(args.create.initialGoalTemplate).toBe(
          args.update.initialGoalTemplate,
        );
        expect(args.create.defaultMode).toBe(args.update.defaultMode);
        expect(args.create.isActive).toBe(args.update.isActive);
        expect(args.create.allowedToolsJson).toEqual(
          args.update.allowedToolsJson,
        );
      }
    });

    it("is idempotent when called twice", async () => {
      await seedAgentWorkflows(mockPrisma);
      await seedAgentWorkflows(mockPrisma);

      expect(mockUpsert).toHaveBeenCalledTimes(
        WORKFLOW_TEMPLATES.length * 2,
      );
    });
  });

  // ─── Verificación: allowedToolsJson hereda del bundle ──────────────

  describe("allowedToolsJson inheritance from bundles", () => {
    it.each(SPECIALIST_BUNDLES.map((b) => [b.slug, b] as const))(
      "bundle '%s' toolNames match across all workflows that reference it",
      async (_slug, bundle) => {
        await seedAgentWorkflows(mockPrisma);

        const relatedTemplates = WORKFLOW_TEMPLATES.filter(
          (t) => t.bundleSlug === bundle.slug,
        );

        for (const template of relatedTemplates) {
          const args = findUpsertBySlug(template.slug);
          expect(args).toBeDefined();
          expect(args!.create.allowedToolsJson).toEqual(bundle.toolNames);
        }
      },
    );
  });

  // ─── Compatibilidad con el CLI script ──────────────────────────────

  describe("CLI script compatibility", () => {
    it("produces a result object that scripts/migrate-agent-workflows.ts can consume", async () => {
      const result = await seedAgentWorkflows(mockPrisma);

      // The CLI script expects: result.upserted (number), result.errors (string[])
      expect(typeof result.upserted).toBe("number");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.every((e) => typeof e === "string")).toBe(true);
    });

    it("handles all workflow templates without errors (happy path for the CLI)", async () => {
      const result = await seedAgentWorkflows(mockPrisma);

      expect(result.upserted).toBe(WORKFLOW_TEMPLATES.length);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ─── Manejo de errores ─────────────────────────────────────────────

  describe("error handling", () => {
    it("continues upserting remaining workflows when one fails", async () => {
      mockUpsert
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValue({});

      const result = await seedAgentWorkflows(mockPrisma);

      expect(result.upserted).toBe(WORKFLOW_TEMPLATES.length - 1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain("Timeout");
    });

    it("reports non-Error thrown values as strings", async () => {
      mockUpsert.mockRejectedValue("string error");

      const result = await seedAgentWorkflows(mockPrisma);

      expect(result.errors.length).toBe(WORKFLOW_TEMPLATES.length);
      expect(result.errors[0]).toContain("string error");
    });
  });
});
