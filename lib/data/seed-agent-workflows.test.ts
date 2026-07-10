import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedAgentWorkflows } from "./seed-agent-workflows";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUpsert = vi.fn();

const mockPrisma = {
  agentWorkflow: {
    upsert: mockUpsert,
  },
} as unknown as Parameters<typeof seedAgentWorkflows>[0];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("seedAgentWorkflows", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("upserts all 7 workflow templates", async () => {
    mockUpsert.mockResolvedValue({});

    const result = await seedAgentWorkflows(mockPrisma);

    expect(result.upserted).toBe(7);
    expect(mockUpsert).toHaveBeenCalledTimes(7);
  });

  it("upserts with correct slug and bundle toolNames", async () => {
    mockUpsert.mockResolvedValue({});

    await seedAgentWorkflows(mockPrisma);

    // Check that the first upsert call contains the expected fields
    const firstCall = mockUpsert.mock.calls[0][0];
    expect(firstCall.where).toHaveProperty("slug");
    expect(firstCall.create).toHaveProperty("allowedToolsJson");
    expect(firstCall.create).toHaveProperty("initialGoalTemplate");
    expect(firstCall.create).toHaveProperty("defaultMode");
    expect(firstCall.create).toHaveProperty("isActive", true);
  });

  it("uses khipu-agent bundle tools for asistente-general template", async () => {
    mockUpsert.mockResolvedValue({});

    await seedAgentWorkflows(mockPrisma);

    // Find the asistente-general upsert call
    const asisGenCall = mockUpsert.mock.calls.find(
      ([args]: [{ where: { slug: string } }]) => args.where.slug === "asistente-general",
    );

    expect(asisGenCall).toBeDefined();
    const args = asisGenCall[0];
    expect(args.create.allowedToolsJson).toContain("searchBudgets");
    expect(args.create.allowedToolsJson).toContain("calculateBudget");
    expect(args.create.allowedToolsJson).toContain("exportReport");
    expect(args.create.allowedToolsJson).toContain("dashboard");
  });

  it("uses budget-agent bundle tools for crear-presupuesto-base template", async () => {
    mockUpsert.mockResolvedValue({});

    await seedAgentWorkflows(mockPrisma);

    const crearCall = mockUpsert.mock.calls.find(
      ([args]: [{ where: { slug: string } }]) => args.where.slug === "crear-presupuesto-base",
    );

    expect(crearCall).toBeDefined();
    const args = crearCall[0];
    // budget-agent should have budget-related tools
    expect(args.create.allowedToolsJson).toContain("createBudget");
    expect(args.create.allowedToolsJson).toContain("searchPartidas");
  });    it("handles upsert failures gracefully", async () => {
      mockUpsert.mockRejectedValue(new Error("DB error"));

    const result = await seedAgentWorkflows(mockPrisma);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.upserted).toBeLessThan(7);
  });

  it("returns correct upserted count when some fail", async () => {
    // Make first call succeed, rest fail
    mockUpsert
      .mockResolvedValueOnce({})
      .mockRejectedValue(new Error("fail"));

    const result = await seedAgentWorkflows(mockPrisma);

    expect(result.upserted).toBe(1);
    expect(result.errors.length).toBe(6);
  });
});
