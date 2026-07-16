import { describe, expect, it } from "vitest";
import { buildIntelligentWorkScheduleBase } from "@/lib/work-schedule/intelligent-schedule";
import type { WorkScheduleGenerationOptions, WorkScheduleLineRecord } from "@/types/work-schedule";

function createOptions(overrides: Partial<WorkScheduleGenerationOptions> = {}): WorkScheduleGenerationOptions {
  return {
    strategy: "sequential",
    maxDurationDays: null,
    similarityLagDays: 0,
    interSubBudgetParallelism: "independent",
    interSubBudgetStaggerDays: 15,
    ...overrides,
  };
}

function buildLevelMap(levels: Array<{ id: string; parentId: string | null; type: string }>): Map<string, { parentId: string | null; type: string }> {
  const map = new Map<string, { parentId: string | null; type: string }>();
  for (const level of levels) {
    map.set(level.id, { parentId: level.parentId, type: level.type });
  }
  return map;
}

function createLine(overrides: Partial<WorkScheduleLineRecord>): WorkScheduleLineRecord {
  return {
    budgetItemId: "item-1",
    itemCode: "01.01",
    description: "Trazo y replanteo",
    unit: "M2",
    quantity: 100,
    unitPrice: 10,
    partial: 1000,
    subBudgetId: "sub-1",
    subBudgetName: "Estructuras",
    startDate: null,
    endDate: null,
    durationDays: null,
    predecessor: null,
    crew: 2,
    performance: 10,
    performanceLabel: "10 M2/DIA",
    monthlyDistributions: [],
    ...overrides,
  };
}

describe("buildIntelligentWorkScheduleBase", () => {
  it("builds a sequential gantt base inside each sub budget using quantity, performance and default cronograma crew", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          quantity: 100,
          performance: 10,
          crew: 2,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          quantity: 60,
          performance: 10,
          crew: 2,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([
      expect.objectContaining({
        budgetItemId: "item-1",
        itemCode: "01.01",
        startDate: "2026-06-01",
        endDate: "2026-06-10",
        durationDays: 10,
        crew: 1,
        predecessor: null,
      }),
      expect.objectContaining({
        budgetItemId: "item-2",
        itemCode: "01.02",
        startDate: "2026-06-11",
        endDate: "2026-06-16",
        durationDays: 6,
        crew: 1,
        predecessor: "01.01FS",
      }),
    ]);
  });

  it("starts each sub budget sequence from the same base date", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          quantity: 20,
          performance: 10,
          crew: 1,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          subBudgetId: "sub-2",
          subBudgetName: "Arquitectura",
          quantity: 30,
          performance: 10,
          crew: 1,
        }),
      ],
    });

    expect(result.generatedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ budgetItemId: "item-2", startDate: "2026-06-01", durationDays: 3 }),
      expect.objectContaining({ budgetItemId: "item-1", startDate: "2026-06-01", durationDays: 2 }),
    ]));
  });

  it("marks lines without enough data as pending instead of forcing a duration", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          performance: null,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([]);
    expect(result.summary).toEqual({
      generatedCount: 0,
      pendingCount: 1,
      issues: [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          reason: "La partida no tiene rendimiento o cuadrilla suficiente para calcular duracion",
        },
      ],
      appliedOptions: {
        interSubBudgetParallelism: "independent",
        interSubBudgetStaggerDays: 15,
        levelLinkage: null,
        maxDurationDays: null,
        similarityLagDays: 0,
        strategy: "sequential",
      },
      highlights: [],
    });
  });

  it("resets persisted cronograma crew values to 1 when regenerating the intelligent base", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          quantity: 100,
          performance: 10,
          crew: 5,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([
      expect.objectContaining({
        budgetItemId: "item-1",
        durationDays: 10,
        crew: 1,
      }),
    ]);
  });

  it("skips lines whose calculated duration is absurdly large", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "UND",
          quantity: 400000,
          performance: 0.5,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([]);
    expect(result.summary).toEqual({
      generatedCount: 0,
      pendingCount: 1,
      issues: [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          reason: "La duracion calculada supera el limite permitido de 36,525 dias",
        },
      ],
      appliedOptions: {
        interSubBudgetParallelism: "independent",
        interSubBudgetStaggerDays: 15,
        levelLinkage: null,
        maxDurationDays: null,
        similarityLagDays: 0,
        strategy: "sequential",
      },
      highlights: [],
    });
  });

  it("marks metric-style partidas with the default technical performance as pending", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([]);
    expect(result.summary).toEqual({
      generatedCount: 0,
      pendingCount: 1,
      issues: [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          reason: "La partida mantiene el rendimiento tecnico por defecto (1 m2/DIA) para su metrado actual. Define un rendimiento real antes de programarla",
        },
      ],
      appliedOptions: {
        interSubBudgetParallelism: "independent",
        interSubBudgetStaggerDays: 15,
        levelLinkage: null,
        maxDurationDays: null,
        similarityLagDays: 0,
        strategy: "sequential",
      },
      highlights: [],
    });
  });

  it("marks large non-metric partidas with default technical performance as pending too", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "pto",
          quantity: 900,
          performance: 1,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([]);
    expect(result.summary).toEqual({
      generatedCount: 0,
      pendingCount: 1,
      issues: [
        {
          budgetItemId: "item-1",
          itemCode: "01.01",
          reason: "La partida mantiene el rendimiento tecnico por defecto (1 pto/DIA) para su metrado actual. Define un rendimiento real antes de programarla",
        },
      ],
      appliedOptions: {
        interSubBudgetParallelism: "independent",
        interSubBudgetStaggerDays: 15,
        levelLinkage: null,
        maxDurationDays: null,
        similarityLagDays: 0,
        strategy: "sequential",
      },
      highlights: [],
    });
  });
});

// ─── by_level strategy ──────────────────────────────────────────────────────

describe("buildIntelligentWorkScheduleBase (by_level strategy)", () => {
  it("schedules lines within the same top-level group sequentially with FS", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_level" }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          levelId: "title-1",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    expect(result.generatedItems).toEqual([
      expect.objectContaining({
        budgetItemId: "item-1",
        startDate: "2026-06-01",
        predecessor: null,
      }),
      expect.objectContaining({
        budgetItemId: "item-2",
        startDate: "2026-06-11",
        predecessor: "01.01FS",
      }),
    ]);
  });

  it("starts different top-level groups in parallel within the same sub-budget", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_level" }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          levelId: "title-2",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // Both items should start on the same day since they belong to different top-level groups
    expect(result.generatedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ budgetItemId: "item-1", startDate: "2026-06-01" }),
      expect.objectContaining({ budgetItemId: "item-2", startDate: "2026-06-01" }),
    ]));
  });

  it("walks up the level hierarchy to find the root TITLE or SUBTITLE", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "subtitle-1a", parentId: "title-1", type: "SUBTITLE" },
      { id: "group-1a1", parentId: "subtitle-1a", type: "ITEM_GROUP" },
      { id: "title-2", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_level" }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01.01",
          levelId: "group-1a1",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          levelId: "title-2",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // item-1 in group-1a1 under subtitle-1a under title-1 starts parallel to item-2 in title-2
    expect(result.generatedItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ budgetItemId: "item-1", startDate: "2026-06-01" }),
      expect.objectContaining({ budgetItemId: "item-2", startDate: "2026-06-01" }),
    ]));
  });

  it("handles lines without levelId by placing them in a default group", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_level" }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: null,
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          levelId: null,
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // Without level info, both lines fall into the same default group and schedule sequentially
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-11",
      predecessor: "01.01FS",
    }));
  });

  it("chains top-level groups with FS predecessors when levelLinkage is set to chain", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "by_level",
        levelLinkage: { "title-2": "chain" },
      }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          levelId: "title-2",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // title-1 starts from base date. title-2 chains after title-1 ends (day 11).
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-11",
      predecessor: "01.01FS",
    }));
  });

  it("starts top-level groups in parallel when levelLinkage is parallel (default)", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "by_level",
        levelLinkage: { "title-2": "parallel" },
      }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          levelId: "title-2",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // Both groups start from the same base date since levelLinkage is parallel.
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-01",
      predecessor: null,
    }));
  });

  it("chains level D to immediately preceding level C (not A) when B and C are parallel in between", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
      { id: "title-3", parentId: null, type: "TITLE" },
      { id: "title-4", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "by_level",
        levelLinkage: {
          "title-1": "chain",
          "title-2": "parallel",
          "title-3": "parallel",
          "title-4": "chain",
        },
      }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-a",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 20,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-b",
          itemCode: "02.01",
          levelId: "title-2",
          quantity: 30,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-c",
          itemCode: "03.01",
          levelId: "title-3",
          quantity: 20,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-d",
          itemCode: "04.01",
          levelId: "title-4",
          quantity: 25,
          performance: 10,
        }),
      ],
    });

    // A (title-1, chain): starts 2026-06-01, 2 days (20/10) → ends 2026-06-02
    // B (title-2, parallel): starts 2026-06-01 (parallel), 3 days → ends 2026-06-03
    // C (title-3, parallel): starts 2026-06-01 (parallel), 2 days → ends 2026-06-02
    // D (title-4, chain): should chain to C (immediately preceding), not A
    //    C ends 2026-06-02, so D starts 2026-06-03
    expect(result.generatedItems).toHaveLength(4);
    expect(result.generatedItems[3]).toEqual(expect.objectContaining({
      budgetItemId: "item-d",
      startDate: "2026-06-03",
      predecessor: "03.01FS",
    }));
  });

  it("chains level D to immediately preceding level C even when B and C have no generated items (unreviewed default performance)", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
      { id: "title-3", parentId: null, type: "TITLE" },
      { id: "title-4", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "by_level",
        levelLinkage: {
          "title-1": "chain",
          "title-2": "parallel",
          "title-3": "parallel",
          "title-4": "chain",
        },
      }),
      levelById,
      lines: [
        // A: valid performance, generates
        createLine({
          budgetItemId: "item-a",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 20,
          performance: 10,
        }),
        // B: unreviewed suspicious default performance → skipped
        createLine({
          budgetItemId: "item-b",
          itemCode: "02.01",
          levelId: "title-2",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
        // C: unreviewed suspicious default performance → skipped
        createLine({
          budgetItemId: "item-c",
          itemCode: "03.01",
          levelId: "title-3",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
        // D: valid performance, should chain to C (immediately preceding) not A
        createLine({
          budgetItemId: "item-d",
          itemCode: "04.01",
          levelId: "title-4",
          quantity: 25,
          performance: 10,
        }),
      ],
    });

    // A (title-1, chain): starts 2026-06-01, 2 days → ends 2026-06-02
    // B (title-2, parallel): no items → occupies 2026-06-01
    // C (title-3, parallel): no items → occupies 2026-06-01
    // D (title-4, chain): chains to C's position (2026-06-01) → starts 2026-06-02
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-a",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      predecessor: null,
    }));
    // D should NOT chain to A (would be 2026-06-03 with predecessor 01.01FS)
    // D chains to C's position (immediately preceding level, no items → base date + 1)
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-d",
      startDate: "2026-06-02",
      predecessor: null,
    }));
  });
});

// ─── by_similarity strategy ─────────────────────────────────────────────────

describe("buildIntelligentWorkScheduleBase (by_similarity strategy)", () => {
  it("clusters similar items together with SS predecessors", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_similarity", similarityLagDays: 0 }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          unit: "m2",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // Same unit and performance → similar → parallel with SS
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-01",
      predecessor: "01.01SS",
    }));
  });

  it("applies lag days between similar items when configured", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_similarity", similarityLagDays: 3 }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          unit: "m2",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      startDate: "2026-06-01",
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      startDate: "2026-06-04",
      predecessor: "01.01SS",
    }));
  });

  it("does not cluster items with different units", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_similarity" }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          unit: "m3",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // Different units → no clustering → sequential
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-11",
      predecessor: null,
    }));
  });

  it("does not cluster items with very different performance", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_similarity" }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          unit: "m2",
          quantity: 60,
          performance: 2,
        }),
      ],
    });

    // Performance diff: |10-2|/6 = 1.33 > 0.2 tolerance → sequential
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      predecessor: null,
    }));
  });
});

// ─── by_similarity strategy with levelLinkage ────────────────────────────────────────────────

describe("buildIntelligentWorkScheduleBase (by_similarity strategy with levelLinkage)", () => {
  it("chains top-level groups sequentially when levelLinkage specifies chain in by_similarity mode", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "by_similarity",
        levelLinkage: { "title-2": "chain" },
      }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: "title-1",
          unit: "m2",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          levelId: "title-2",
          unit: "m3",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // title-1 starts from base date (day 1). title-2 chains after title-1 ends (day 11).
    // In by_similarity, chaining is cursor-based (dates) without explicit FS predecessors between levels.
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-11",
      predecessor: null,
    }));
  });

  it("starts top-level groups in parallel from same base date in by_similarity mode", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "by_similarity",
        levelLinkage: { "title-2": "parallel" },
      }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: "title-1",
          unit: "m2",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          levelId: "title-2",
          unit: "m3",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // Both groups start from the same base date since levelLinkage is parallel.
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-01",
    }));
  });
});

// ─── Crew optimization ───────────────────────────────────────────────────────

describe("buildIntelligentWorkScheduleBase (crew optimization)", () => {
  it("increases crew when duration exceeds maxDurationDays", () => {
    // 100m2 at 10 m2/day with 1 crew = 10 days. maxDurationDays=3 → crew should increase.
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ maxDurationDays: 3 }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 100,
          performance: 10,
        }),
      ],
    });

    expect(result.generatedItems).toHaveLength(1);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      crew: 4,
      durationDays: 3,
    }));
  });

  it("keeps default crew when duration is within maxDurationDays", () => {
    // 20m2 at 10 m2/day = 2 days < 5 max → no change
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ maxDurationDays: 5 }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 20,
          performance: 10,
        }),
      ],
    });

    expect(result.generatedItems).toHaveLength(1);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      crew: 1,
      durationDays: 2,
    }));
  });

  it("applies maxDurationDays constraint alongside sequential strategy", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "sequential", maxDurationDays: 2 }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          unit: "m2",
          quantity: 50,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          unit: "m2",
          quantity: 40,
          performance: 10,
        }),
      ],
    });

    // Both would be 5 and 4 days with crew=1, but maxDurationDays=2 forces higher crews
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      crew: 3,
      durationDays: 2,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      crew: 2,
      durationDays: 2,
    }));
  });
});

// ─── Sub-budget parallelism ─────────────────────────────────────────────────

describe("buildIntelligentWorkScheduleBase (sub-budget parallelism)", () => {
  it("starts each sub-budget independently from baseStartDate by default", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ interSubBudgetParallelism: "independent" }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          subBudgetId: "sub-1",
          quantity: 30,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          subBudgetId: "sub-2",
          quantity: 20,
          performance: 10,
        }),
      ],
    });

    // Both sub-budgets start from the same base date
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-01",
    }));
  });

  it("starts sub-budgets with staggered offset when configured", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        interSubBudgetParallelism: "staggered",
        interSubBudgetStaggerDays: 10,
      }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          subBudgetId: "sub-1",
          quantity: 30,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          subBudgetId: "sub-2",
          quantity: 20,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-3",
          itemCode: "03.01",
          subBudgetId: "sub-3",
          quantity: 20,
          performance: 10,
        }),
      ],
    });

    expect(result.generatedItems).toHaveLength(3);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-11",
      predecessor: null,
    }));
    expect(result.generatedItems[2]).toEqual(expect.objectContaining({
      budgetItemId: "item-3",
      startDate: "2026-06-21",
    }));
  });

  it("parallel mode starts all sub-budgets from the same date", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ interSubBudgetParallelism: "parallel" }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          subBudgetId: "sub-1",
          quantity: 30,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          subBudgetId: "sub-2",
          quantity: 20,
          performance: 10,
        }),
      ],
    });

    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      startDate: "2026-06-01",
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      startDate: "2026-06-01",
    }));
  });
});

// ─── reviewedBudgetItemIds with new strategies ──────────────────────────────

describe("buildIntelligentWorkScheduleBase (reviewedBudgetItemIds)", () => {
  it("generates reviewed items with suspicious default performance instead of blocking them", () => {
    // A line with performance=1, unit=m2, quantity=250 is normally flagged as suspicious.
    // When its id is in the reviewed set, it should be generated normally.
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_level" }),
      reviewedBudgetItemIds: new Set(["item-reviewed"]),
      lines: [
        createLine({
          budgetItemId: "item-reviewed",
          itemCode: "01.01",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
      ],
    });

    expect(result.generatedItems).toHaveLength(1);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-reviewed",
      durationDays: 250,
      crew: 1,
    }));
    expect(result.summary.pendingCount).toBe(0);
    expect(result.summary.issues).toHaveLength(0);
  });

  it("still blocks unreviewed items with suspicious default performance alongside the new strategies", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "by_similarity" }),
      reviewedBudgetItemIds: new Set(["item-reviewed"]),
      lines: [
        createLine({
          budgetItemId: "item-reviewed",
          itemCode: "01.01",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
        createLine({
          budgetItemId: "item-blocked",
          itemCode: "01.02",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
      ],
    });

    // Only the reviewed item should be generated
    expect(result.generatedItems).toHaveLength(1);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-reviewed",
    }));
    expect(result.summary.pendingCount).toBe(1);
    expect(result.summary.issues).toHaveLength(1);
    expect(result.summary.issues[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-blocked",
    }));
  });
});

// ─── sequential strategy with levelLinkage ────────────────────────────────────────────────

describe("buildIntelligentWorkScheduleBase (sequential strategy with levelLinkage)", () => {
  it("chains top-level groups with FS when levelLinkage specifies chain in sequential mode", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "sequential",
        levelLinkage: { "title-2": "chain" },
      }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          levelId: "title-2",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // title-1 starts from base date. title-2 chains after title-1 ends (day 11).
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
      endDate: "2026-06-10",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-11",
      predecessor: "01.01FS",
    }));
  });

  it("starts top-level groups in parallel when levelLinkage is parallel in sequential mode", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "sequential",
        levelLinkage: { "title-2": "parallel" },
      }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "02.01",
          levelId: "title-2",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // Both groups start from the same base date.
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-01",
      predecessor: null,
    }));
  });

  it("chains level D to immediately preceding level C (not A) when B and C are parallel in between", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
      { id: "title-3", parentId: null, type: "TITLE" },
      { id: "title-4", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "sequential",
        levelLinkage: {
          "title-1": "chain",
          "title-2": "parallel",
          "title-3": "parallel",
          "title-4": "chain",
        },
      }),
      levelById,
      lines: [
        createLine({
          budgetItemId: "item-a",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 20,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-b",
          itemCode: "02.01",
          levelId: "title-2",
          quantity: 30,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-c",
          itemCode: "03.01",
          levelId: "title-3",
          quantity: 20,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-d",
          itemCode: "04.01",
          levelId: "title-4",
          quantity: 25,
          performance: 10,
        }),
      ],
    });

    // A (title-1, chain): starts 2026-06-01, 2 days (20/10) → ends 2026-06-02
    // B (title-2, parallel): starts 2026-06-01 (parallel), 3 days → ends 2026-06-03
    // C (title-3, parallel): starts 2026-06-01 (parallel), 2 days → ends 2026-06-02
    // D (title-4, chain): should chain to C (immediately preceding), not A
    //    C ends 2026-06-02, so D starts 2026-06-03
    expect(result.generatedItems).toHaveLength(4);
    // Level D should chain to level C's last item (03.01)
    expect(result.generatedItems[3]).toEqual(expect.objectContaining({
      budgetItemId: "item-d",
      startDate: "2026-06-03",
      predecessor: "03.01FS",
    }));
  });

  it("chains level D to immediately preceding level C even when B and C have no generated items (unreviewed default performance)", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
      { id: "title-3", parentId: null, type: "TITLE" },
      { id: "title-4", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "sequential",
        levelLinkage: {
          "title-1": "chain",
          "title-2": "parallel",
          "title-3": "parallel",
          "title-4": "chain",
        },
      }),
      levelById,
      lines: [
        // A: valid performance, generates
        createLine({
          budgetItemId: "item-a",
          itemCode: "01.01",
          levelId: "title-1",
          quantity: 20,
          performance: 10,
        }),
        // B: unreviewed suspicious default performance → skipped
        createLine({
          budgetItemId: "item-b",
          itemCode: "02.01",
          levelId: "title-2",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
        // C: unreviewed suspicious default performance → skipped
        createLine({
          budgetItemId: "item-c",
          itemCode: "03.01",
          levelId: "title-3",
          unit: "m2",
          quantity: 250,
          performance: 1,
        }),
        // D: valid performance, should chain to C (immediately preceding) not A
        createLine({
          budgetItemId: "item-d",
          itemCode: "04.01",
          levelId: "title-4",
          quantity: 25,
          performance: 10,
        }),
      ],
    });

    // A (title-1, chain): starts 2026-06-01, 2 days → ends 2026-06-02
    // B (title-2, parallel): no items → occupies 2026-06-01
    // C (title-3, parallel): no items → occupies 2026-06-01
    // D (title-4, chain): chains to C's position (2026-06-01) → starts 2026-06-02
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-a",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      predecessor: null,
    }));
    // D should NOT chain to A (would be 2026-06-03 with predecessor 01.01FS)
    // D chains to C's position (immediately preceding level, no items → base date + 1)
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-d",
      startDate: "2026-06-02",
      predecessor: null,
    }));
  });

  it("chains the last level to the immediately preceding level when all prior levels are parallel (user scenario: 3 parallel + 1 chain)", () => {
    const levelById = buildLevelMap([
      { id: "title-1", parentId: null, type: "TITLE" },
      { id: "title-2", parentId: null, type: "TITLE" },
      { id: "title-3", parentId: null, type: "TITLE" },
      { id: "title-4", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "sequential",
        levelLinkage: {
          "title-1": "parallel",
          "title-2": "parallel",
          "title-3": "parallel",
          "title-4": "chain",
        },
      }),
      levelById,
      lines: [
        // OBRAS PRELIMINARES (parallel) — multiple items, last code is "06"
        createLine({
          budgetItemId: "item-1a",
          itemCode: "01",
          levelId: "title-1",
          quantity: 10,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-1b",
          itemCode: "06",
          levelId: "title-1",
          quantity: 20,
          performance: 10,
        }),
        // DEMOLICIONES (parallel)
        createLine({
          budgetItemId: "item-2a",
          itemCode: "08",
          levelId: "title-2",
          quantity: 30,
          performance: 10,
        }),
        // MOVIMIENTO DE TIERRA (parallel) — last code is "14"
        createLine({
          budgetItemId: "item-3a",
          itemCode: "10",
          levelId: "title-3",
          quantity: 10,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-3b",
          itemCode: "14",
          levelId: "title-3",
          quantity: 30,
          performance: 10,
        }),
        // OBRAS DE CONCRETO SIMPLE (chain) — should chain to MOVIMIENTO DE TIERRA (title-3), NOT OBRAS PRELIMINARES (title-1)
        createLine({
          budgetItemId: "item-4a",
          itemCode: "20",
          levelId: "title-4",
          quantity: 25,
          performance: 10,
        }),
      ],
    });

    expect(result.generatedItems).toHaveLength(6);
    // Level 4 (item-4a, chain) must chain to level 3's last item (14), NOT level 1's last item (06)
    expect(result.generatedItems[5]).toEqual(expect.objectContaining({
      budgetItemId: "item-4a",
      predecessor: "14FS",
    }));
  });

  it("preserves budget order when levelIds sort alphabetically out of budget order (all chain)", () => {
    // Simulate real database UUIDs: the budget order is z→a→b→c, but alphabetical sort would be a→b→c→z.
    // Budget: lvl-z (OBRAS PRELIMINARES, first), lvl-a (DEMOLICIONES, second), lvl-b (MOV. TIERRA, third), lvl-c (CONCRETO, fourth)
    const levelById = buildLevelMap([
      { id: "lvl-z", parentId: null, type: "TITLE" },
      { id: "lvl-a", parentId: null, type: "TITLE" },
      { id: "lvl-b", parentId: null, type: "TITLE" },
      { id: "lvl-c", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({
        strategy: "sequential",
        levelLinkage: {
          "lvl-z": "chain",
          "lvl-a": "chain",
          "lvl-b": "chain",
          "lvl-c": "chain",
        },
      }),
      levelById,
      // Lines in budget order: lvl-z first (OBRAS PRELIMINARES), lvl-c last (CONCRETO)
      lines: [
        createLine({
          budgetItemId: "item-z",
          itemCode: "01",
          levelId: "lvl-z",
          quantity: 10,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-a",
          itemCode: "08",
          levelId: "lvl-a",
          quantity: 30,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-b-1",
          itemCode: "14",
          levelId: "lvl-b",
          quantity: 20,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-b-2",
          itemCode: "46",
          levelId: "lvl-b",
          quantity: 10,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-c",
          itemCode: "50",
          levelId: "lvl-c",
          quantity: 25,
          performance: 10,
        }),
      ],
    });

    // Budget order (insertion): lvl-z → lvl-a → lvl-b → lvl-c
    // Alphabetical sort (bug):     lvl-a → lvl-b → lvl-c → lvl-z
    // With the bug, lvl-a would be processed first (chaining to nothing, predecessor null),
    // and lvl-z (OBRAS PRELIMINARES) would chain to lvl-c's last item (46FS).
    // With the fix (insertion order), lvl-z is first (predecessor null) and lvl-c chains to lvl-b's 46FS.
    expect(result.generatedItems).toHaveLength(5);
    // lvl-z (OBRAS PRELIMINARES, first in budget): predecessor null
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-z",
      predecessor: null,
    }));
    // lvl-c (CONCRETO, last): chains to lvl-b's last item (46FS)
    expect(result.generatedItems[4]).toEqual(expect.objectContaining({
      budgetItemId: "item-c",
      predecessor: "46FS",
    }));
  });

  it("falls back to flat sequential when levelLinkage is empty in sequential mode", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-06-01",
      options: createOptions({ strategy: "sequential" }),
      lines: [
        createLine({
          budgetItemId: "item-1",
          itemCode: "01.01",
          quantity: 100,
          performance: 10,
        }),
        createLine({
          budgetItemId: "item-2",
          itemCode: "01.02",
          quantity: 60,
          performance: 10,
        }),
      ],
    });

    // Sequential: each item chains after the previous one
    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "item-1",
      startDate: "2026-06-01",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "item-2",
      startDate: "2026-06-11",
      predecessor: "01.01FS",
    }));
  });
});

// ─── by_front strategy ───────────────────────────────────────────────────────

describe("buildIntelligentWorkScheduleBase (by_front strategy)", () => {
  it("starts independent top-level fronts in parallel", () => {
    const levelById = buildLevelMap([
      { id: "front-a", parentId: null, type: "TITLE" },
      { id: "front-b", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-08-03",
      lines: [
        createLine({ budgetItemId: "a1", itemCode: "1", description: "Limpieza de terreno frente A", levelId: "front-a", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "a2", itemCode: "2", description: "Excavacion de zapatas frente A", levelId: "front-a", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "b1", itemCode: "3", description: "Limpieza de terreno frente B", levelId: "front-b", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "b2", itemCode: "4", description: "Excavacion de zapatas frente B", levelId: "front-b", quantity: 10, performance: 10 }),
      ],
      options: createOptions({ strategy: "by_front" }),
      levelById,
    });

    expect(result.generatedItems).toHaveLength(4);
    expect(result.generatedItems.find((item) => item.itemCode === "1")?.startDate).toBe("2026-08-03");
    expect(result.generatedItems.find((item) => item.itemCode === "3")?.startDate).toBe("2026-08-03");
    expect(result.generatedItems.find((item) => item.itemCode === "2")?.predecessor).toBe("1FS");
    expect(result.generatedItems.find((item) => item.itemCode === "4")?.predecessor).toBe("3FS");
  });

  it("orders technical phases inside the same front before generating FS links", () => {
    const levelById = buildLevelMap([
      { id: "front-a", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-08-03",
      lines: [
        createLine({ budgetItemId: "finish", itemCode: "30", description: "Pintura latex en muros", levelId: "front-a", quantity: 5, performance: 5 }),
        createLine({ budgetItemId: "earth", itemCode: "10", description: "Excavacion masiva", levelId: "front-a", quantity: 5, performance: 5 }),
        createLine({ budgetItemId: "structure", itemCode: "20", description: "Concreto f'c=210 kg/cm2 en zapatas", levelId: "front-a", quantity: 5, performance: 5 }),
      ],
      options: createOptions({ strategy: "by_front" }),
      levelById,
    });

    expect(result.generatedItems.map((item) => item.itemCode)).toEqual(["10", "20", "30"]);
    expect(result.generatedItems[0]?.predecessor).toBeNull();
    expect(result.generatedItems[1]?.predecessor).toBe("10FS");
    expect(result.generatedItems[2]?.predecessor).toBe("20FS");
  });

  it("keeps original relative order for unclassified work inside a front", () => {
    const levelById = buildLevelMap([
      { id: "front-a", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-08-03",
      lines: [
        createLine({ budgetItemId: "x1", itemCode: "1", description: "Servicio especial alfa", levelId: "front-a", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "x2", itemCode: "2", description: "Servicio especial beta", levelId: "front-a", quantity: 10, performance: 10 }),
      ],
      options: createOptions({ strategy: "by_front" }),
      levelById,
    });

    expect(result.generatedItems.map((item) => item.itemCode)).toEqual(["1", "2"]);
    expect(result.generatedItems[1]?.predecessor).toBe("1FS");
  });

  it("describes front strategy in generation highlights", () => {
    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-08-03",
      lines: [
        createLine({ budgetItemId: "a1", itemCode: "1", description: "Limpieza de terreno", quantity: 1, performance: 1 }),
      ],
      options: createOptions({ strategy: "by_front" }),
    });

    expect(result.summary.highlights).toContain("Estrategia por frentes de obra");
    expect(result.summary.highlights).toContain("Secuencia constructiva aplicada por fase tecnica");
  });

  it("chains fronts sequentially when levelLinkage specifies chain", () => {
    const levelById = buildLevelMap([
      { id: "front-a", parentId: null, type: "TITLE" },
      { id: "front-b", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-08-03",
      lines: [
        createLine({ budgetItemId: "a1", itemCode: "1", description: "Limpieza de terreno frente A", levelId: "front-a", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "b1", itemCode: "3", description: "Limpieza de terreno frente B", levelId: "front-b", quantity: 10, performance: 10 }),
      ],
      options: createOptions({ strategy: "by_front", levelLinkage: { "front-b": "chain" } }),
      levelById,
    });

    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "a1",
      startDate: "2026-08-03",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "b1",
      startDate: "2026-08-04",
      predecessor: "1FS",
    }));
  });

  it("respects interSubBudgetParallelism staggered across multiple sub budgets", () => {
    const levelById = buildLevelMap([
      { id: "front-a", parentId: null, type: "TITLE" },
      { id: "front-b", parentId: null, type: "TITLE" },
    ]);

    const result = buildIntelligentWorkScheduleBase({
      baseStartDate: "2026-08-03",
      lines: [
        createLine({ budgetItemId: "a1", itemCode: "1", description: "Limpieza de terreno frente A", levelId: "front-a", subBudgetId: "sub-1", subBudgetName: "Estructuras", quantity: 10, performance: 10 }),
        createLine({ budgetItemId: "b1", itemCode: "3", description: "Limpieza de terreno frente B", levelId: "front-b", subBudgetId: "sub-2", subBudgetName: "Arquitectura", quantity: 10, performance: 10 }),
      ],
      options: createOptions({
        strategy: "by_front",
        interSubBudgetParallelism: "staggered",
        interSubBudgetStaggerDays: 10,
      }),
      levelById,
    });

    expect(result.generatedItems).toHaveLength(2);
    expect(result.generatedItems[0]).toEqual(expect.objectContaining({
      budgetItemId: "a1",
      startDate: "2026-08-03",
      predecessor: null,
    }));
    expect(result.generatedItems[1]).toEqual(expect.objectContaining({
      budgetItemId: "b1",
      startDate: "2026-08-13",
      predecessor: null,
    }));
  });
});
