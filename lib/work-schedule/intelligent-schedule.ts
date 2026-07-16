import { buildWorkScheduleMonthlyDistributionsFromRange, calculateWorkScheduleDurationDays, hasSuspiciousDefaultWorkSchedulePerformance } from "@/lib/calculations/work-schedule";
import { addWorkDays, type CalendarExceptionMap } from "@/lib/work-schedule/calendar";
import { formatGeneratedPredecessor } from "@/lib/work-schedule/predecessors";
import type {
  InterSubBudgetParallelism,
  LevelLinkageMode,
  WorkScheduleGenerationIssueRecord,
  WorkScheduleGenerationOptions,
  WorkScheduleGenerationSummaryRecord,
  WorkScheduleGenerationStrategy,
  WorkScheduleLineRecord,
  WorkScheduleMonthlyDistributionRecord,
} from "@/types/work-schedule";

type GeneratedScheduleLine = {
  budgetItemId: string;
  itemCode: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  predecessor: string | null;
  crew: number | null;
  monthlyDistributions: WorkScheduleMonthlyDistributionRecord[];
};

type LevelInfo = {
  parentId: string | null;
  type: string;
};

type WorkFrontPhase =
  | "preliminaries"
  | "earthwork"
  | "structure"
  | "masonry"
  | "installations"
  | "finishes"
  | "testing"
  | "other";

type WorkFrontLine = {
  line: WorkScheduleLineRecord;
  phase: WorkFrontPhase;
  originalIndex: number;
};

const DEFAULT_GENERATED_WORK_SCHEDULE_CREW = 1;
const MAX_GENERATED_WORK_SCHEDULE_DURATION_DAYS = 36525;
const SIMILARITY_PERFORMANCE_TOLERANCE = 0.2;
const DEFAULT_STAGGER_DAYS = 15;

const WORK_FRONT_PHASE_ORDER: Record<WorkFrontPhase, number> = {
  preliminaries: 10,
  earthwork: 20,
  structure: 30,
  masonry: 40,
  installations: 50,
  finishes: 60,
  testing: 70,
  other: 80,
};

const WORK_FRONT_PHASE_KEYWORDS: Record<WorkFrontPhase, readonly string[]> = {
  preliminaries: ["preliminar", "limpieza", "trazo", "replanteo", "cartel", "movilizacion", "campamento", "seguridad"],
  earthwork: ["excavacion", "corte", "relleno", "eliminacion", "movimiento de tierras", "nivelacion", "compactacion"],
  structure: ["concreto", "hormigon", "acero", "fierro", "encofrado", "desencofrado", "columna", "viga", "losa", "zapata", "cimentacion"],
  masonry: ["muro", "ladrillo", "albanileria", "tabique", "asentado"],
  installations: ["electrica", "sanitario", "sanitaria", "tuberia", "desague", "agua", "cable", "conduit", "tablero", "instalacion"],
  finishes: ["pintura", "ceramico", "porcelanato", "enchape", "piso", "acabado", "cielo raso", "carpinteria", "puerta", "ventana"],
  testing: ["prueba", "ensayo", "puesta en marcha", "limpieza final", "entrega", "recepcion"],
  other: [],
};

export function buildIntelligentWorkScheduleBase({
  baseStartDate,
  lines,
  reviewedBudgetItemIds,
  options,
  levelById,
  workDaysBitmask,
  exceptionMap,
}: {
  baseStartDate: string;
  lines: WorkScheduleLineRecord[];
  reviewedBudgetItemIds?: Set<string>;
  options?: WorkScheduleGenerationOptions;
  levelById?: Map<string, LevelInfo>;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  const appliedOptions = normalizeGenerationOptions(options);
  const issues: WorkScheduleGenerationIssueRecord[] = [];
  let generatedItems: GeneratedScheduleLine[] = [];

  switch (appliedOptions.strategy) {
    case "by_level":
      generatedItems = buildByLevelBase({ baseStartDate, lines, reviewedBudgetItemIds, issues, options: appliedOptions, levelById, workDaysBitmask, exceptionMap });
      break;
    case "by_similarity":
      generatedItems = buildBySimilarityBase({ baseStartDate, lines, reviewedBudgetItemIds, issues, options: appliedOptions, levelById, workDaysBitmask, exceptionMap });
      break;
    case "by_front":
      generatedItems = buildByFrontBase({ baseStartDate, lines, reviewedBudgetItemIds, issues, options: appliedOptions, levelById, workDaysBitmask, exceptionMap });
      break;
    case "sequential":
    default:
      generatedItems = buildSequentialBase({ baseStartDate, lines, reviewedBudgetItemIds, issues, options: appliedOptions, levelById, workDaysBitmask, exceptionMap });
      break;
  }

  const highlights = buildGenerationHighlights(generatedItems, appliedOptions);

  const summary: WorkScheduleGenerationSummaryRecord = {
    generatedCount: generatedItems.length,
    pendingCount: issues.length,
    issues,
    appliedOptions,
    highlights,
  };

  return {
    generatedItems,
    summary,
  };
}

// ─── Sequential strategy (current default) ───────────────────────────────────

function buildSequentialBase({
  baseStartDate,
  lines,
  reviewedBudgetItemIds,
  issues,
  options,
  levelById,
  workDaysBitmask,
  exceptionMap,
}: {
  baseStartDate: string;
  lines: WorkScheduleLineRecord[];
  reviewedBudgetItemIds?: Set<string>;
  issues: WorkScheduleGenerationIssueRecord[];
  options: WorkScheduleGenerationOptions;
  levelById?: Map<string, LevelInfo>;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  const generatedItems: GeneratedScheduleLine[] = [];
  const linesBySubBudget = groupLinesBySubBudget(lines);
  const levelLinkage = options.levelLinkage ?? null;
  const hasLevelLinkage = levelLinkage != null && Object.keys(levelLinkage).length > 0;

  const orderedSubBudgetIds = [...linesBySubBudget.keys()];
  let subBudgetStaggerOffset = 0;

  for (const subBudgetId of orderedSubBudgetIds) {
    const groupLines = linesBySubBudget.get(subBudgetId) ?? [];
    const subBudgetStartDate = addDaysInclusive(baseStartDate, subBudgetStaggerOffset, workDaysBitmask, exceptionMap);

    if (hasLevelLinkage) {
      buildGroupedLevelSchedule({
        groupLines,
        subBudgetStartDate,
        levelLinkage,
        levelById,
        reviewedBudgetItemIds,
        issues,
        options,
        generatedItems,
        workDaysBitmask,
        exceptionMap,
      });
    } else {
      // Original flat sequential behavior within each sub-budget
      const orderedGroupLines = sortLines(groupLines);

      let groupCursor = subBudgetStartDate;
      let previousGeneratedLine: GeneratedScheduleLine | null = null;

      for (const line of orderedGroupLines) {
        const result = tryGenerateLine({ line, cursor: groupCursor, previousLine: previousGeneratedLine?.itemCode ?? null, reviewedBudgetItemIds, issues, options, workDaysBitmask, exceptionMap });
        if (!result) {
          continue;
        }

        generatedItems.push(result.generatedLine);
        previousGeneratedLine = result.generatedLine;
        groupCursor = addDaysInclusive(result.generatedLine.endDate, 1, workDaysBitmask, exceptionMap);
      }
    }

    subBudgetStaggerOffset = getNextSubBudgetStaggerOffset(subBudgetStaggerOffset, options);
  }

  return generatedItems;
}

// ─── By-level strategy ───────────────────────────────────────────────────────

function buildByLevelBase({
  baseStartDate,
  lines,
  reviewedBudgetItemIds,
  issues,
  options,
  levelById,
  workDaysBitmask,
  exceptionMap,
}: {
  baseStartDate: string;
  lines: WorkScheduleLineRecord[];
  reviewedBudgetItemIds?: Set<string>;
  issues: WorkScheduleGenerationIssueRecord[];
  options: WorkScheduleGenerationOptions;
  levelById?: Map<string, LevelInfo>;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  const generatedItems: GeneratedScheduleLine[] = [];
  const linesBySubBudget = groupLinesBySubBudget(lines);
  const levelLinkage = options.levelLinkage ?? null;

  const orderedSubBudgetIds = [...linesBySubBudget.keys()];
  let subBudgetStaggerOffset = 0;

  for (const subBudgetId of orderedSubBudgetIds) {
    const groupLines = linesBySubBudget.get(subBudgetId) ?? [];
    const subBudgetStartDate = addDaysInclusive(baseStartDate, subBudgetStaggerOffset, workDaysBitmask, exceptionMap);

    // Group lines by top-level ancestor and schedule with chain/parallel linkage
    buildGroupedLevelSchedule({
      groupLines,
      subBudgetStartDate,
      levelLinkage,
      levelById,
      reviewedBudgetItemIds,
      issues,
      options,
      generatedItems,
      workDaysBitmask,
      exceptionMap,
    });

    subBudgetStaggerOffset = getNextSubBudgetStaggerOffset(subBudgetStaggerOffset, options);
  }

  return generatedItems;
}



// ─── Level-grouped iteration helper (chain/parallel) ─────────────────────────

function forEachLevelGroup({
  groupLines,
  subBudgetStartDate,
  levelLinkage,
  levelById,
  scheduleLevel,
  workDaysBitmask,
  exceptionMap,
}: {
  groupLines: WorkScheduleLineRecord[];
  subBudgetStartDate: string;
  levelLinkage: Record<string, LevelLinkageMode> | null;
  levelById?: Map<string, LevelInfo>;
  scheduleLevel: (ctx: {
    levelKey: string;
    levelLines: WorkScheduleLineRecord[];
    levelCursor: string;
    shouldChain: boolean;
  }) => string | null;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  const linesByTopLevel = groupLinesByTopLevel(groupLines, levelById);
  // Preserve insertion order — Map keys follow the order items appear in the
  // budget, which is the same order the user sees in the tree preview.
  const topLevelKeys = [...linesByTopLevel.keys()];
  let previousLevelEndDate: string | null = null;

  for (const topLevelKey of topLevelKeys) {
    const levelLines = linesByTopLevel.get(topLevelKey) ?? [];

    const linkageMode = resolveLevelLinkage(topLevelKey, levelLinkage);
    const shouldChain: boolean = linkageMode === "chain" && previousLevelEndDate != null;

    const levelCursor: string = shouldChain
      ? addDaysInclusive(previousLevelEndDate!, 1, workDaysBitmask, exceptionMap)
      : subBudgetStartDate;

    const endDate = scheduleLevel({ levelKey: topLevelKey, levelLines, levelCursor, shouldChain });

    // Always track the level's position for chain purposes, even when it produces no items.
    // A non-producing level effectively occupies its levelCursor (parallel → base date, chain → after previous).
    previousLevelEndDate = endDate ?? levelCursor;
  }
}

// ─── Shared level-grouped schedule builder ───────────────────────────────────

function buildGroupedLevelSchedule({
  groupLines,
  subBudgetStartDate,
  levelLinkage,
  levelById,
  reviewedBudgetItemIds,
  issues,
  options,
  generatedItems,
  workDaysBitmask,
  exceptionMap,
}: {
  groupLines: WorkScheduleLineRecord[];
  subBudgetStartDate: string;
  levelLinkage: Record<string, LevelLinkageMode> | null;
  levelById?: Map<string, LevelInfo>;
  reviewedBudgetItemIds?: Set<string>;
  issues: WorkScheduleGenerationIssueRecord[];
  options: WorkScheduleGenerationOptions;
  generatedItems: GeneratedScheduleLine[];
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  let lastPreviousGroupItem: GeneratedScheduleLine | null = null;

  forEachLevelGroup({
    groupLines,
    subBudgetStartDate,
    levelLinkage,
    levelById,
    workDaysBitmask,
    exceptionMap,
    scheduleLevel: ({ levelLines, levelCursor, shouldChain }) => {
      const orderedLevelLines = sortLines(levelLines);
      let previousInLevel: GeneratedScheduleLine | null = null;
      let cursor = levelCursor;

      for (const line of orderedLevelLines) {
        const result = tryGenerateLine({
          line,
          cursor,
          previousLine: previousInLevel?.itemCode ?? (shouldChain ? lastPreviousGroupItem?.itemCode ?? null : null),
          reviewedBudgetItemIds,
          issues,
          options,
          workDaysBitmask,
          exceptionMap,
        });
        if (!result) {
          continue;
        }

        generatedItems.push(result.generatedLine);
        previousInLevel = result.generatedLine;
        cursor = addDaysInclusive(result.generatedLine.endDate, 1, workDaysBitmask, exceptionMap);
      }

      // Always update so the next chain level gets the correct predecessor —
      // reset to null when this level produced no items.
      lastPreviousGroupItem = previousInLevel;
      return previousInLevel?.endDate ?? null;
    },
  });
}

// ─── By-front strategy ───────────────────────────────────────────────────────

function buildByFrontBase({
  baseStartDate,
  lines,
  reviewedBudgetItemIds,
  issues,
  options,
  levelById,
  workDaysBitmask,
  exceptionMap,
}: {
  baseStartDate: string;
  lines: WorkScheduleLineRecord[];
  reviewedBudgetItemIds?: Set<string>;
  issues: WorkScheduleGenerationIssueRecord[];
  options: WorkScheduleGenerationOptions;
  levelById?: Map<string, LevelInfo>;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  const generatedItems: GeneratedScheduleLine[] = [];
  const linesBySubBudget = groupLinesBySubBudget(lines);
  const levelLinkage = options.levelLinkage ?? null;

  const orderedSubBudgetIds = [...linesBySubBudget.keys()];
  let subBudgetStaggerOffset = 0;

  for (const subBudgetId of orderedSubBudgetIds) {
    const groupLines = linesBySubBudget.get(subBudgetId) ?? [];
    const subBudgetStartDate = addDaysInclusive(baseStartDate, subBudgetStaggerOffset, workDaysBitmask, exceptionMap);

    let lastPreviousGroupItem: GeneratedScheduleLine | null = null;

    forEachLevelGroup({
      groupLines,
      subBudgetStartDate,
      levelLinkage,
      levelById,
      workDaysBitmask,
      exceptionMap,
      scheduleLevel: ({ levelLines, levelCursor, shouldChain }) => {
        const frontLines: WorkFrontLine[] = levelLines.map((line, originalIndex) => ({
          line,
          phase: classifyWorkFrontPhase(line),
          originalIndex,
        }));

        const orderedFrontLines = sortWorkFrontLines(frontLines);
        let cursor = levelCursor;
        let previousInLevel: GeneratedScheduleLine | null = null;

        for (const frontLine of orderedFrontLines) {
          const previousLine = previousInLevel?.itemCode ?? (shouldChain ? lastPreviousGroupItem?.itemCode ?? null : null);
          const result = tryGenerateLine({
            line: frontLine.line,
            cursor,
            previousLine,
            reviewedBudgetItemIds,
            issues,
            options,
            workDaysBitmask,
            exceptionMap,
          });

          if (!result) {
            continue;
          }

          generatedItems.push(result.generatedLine);
          previousInLevel = result.generatedLine;
          cursor = addDaysInclusive(result.generatedLine.endDate, 1, workDaysBitmask, exceptionMap);
        }

        lastPreviousGroupItem = previousInLevel;
        return previousInLevel?.endDate ?? null;
      },
    });

    subBudgetStaggerOffset = getNextSubBudgetStaggerOffset(subBudgetStaggerOffset, options);
  }

  return generatedItems;
}

// ─── By-similarity strategy ──────────────────────────────────────────────────

function buildBySimilarityBase({
  baseStartDate,
  lines,
  reviewedBudgetItemIds,
  issues,
  options,
  levelById,
  workDaysBitmask,
  exceptionMap,
}: {
  baseStartDate: string;
  lines: WorkScheduleLineRecord[];
  reviewedBudgetItemIds?: Set<string>;
  issues: WorkScheduleGenerationIssueRecord[];
  options: WorkScheduleGenerationOptions;
  levelById?: Map<string, LevelInfo>;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  const generatedItems: GeneratedScheduleLine[] = [];
  const linesBySubBudget = groupLinesBySubBudget(lines);
  const levelLinkage = options.levelLinkage ?? null;

  const orderedSubBudgetIds = [...linesBySubBudget.keys()];
  let subBudgetStaggerOffset = 0;

  for (const subBudgetId of orderedSubBudgetIds) {
    const groupLines = linesBySubBudget.get(subBudgetId) ?? [];
    const subBudgetStartDate = addDaysInclusive(baseStartDate, subBudgetStaggerOffset, workDaysBitmask, exceptionMap);

    // Group by top-level with chain/parallel linkage, then detect similar clusters within each level
    forEachLevelGroup({
      groupLines,
      subBudgetStartDate,
      levelLinkage,
      levelById,
      workDaysBitmask,
      exceptionMap,
      scheduleLevel: ({ levelLines, levelCursor }) => {
        const clusters = buildSimilarityClusters(levelLines);
        let previousClusterEndDate = levelCursor;
        let cursor = levelCursor;

        for (const cluster of clusters) {
          if (cluster.length === 1) {
            // Single item: schedule sequentially
            const line = cluster[0];
            const result = tryGenerateLine({
              line,
              cursor,
              previousLine: null,
              reviewedBudgetItemIds,
              issues,
              options,
              workDaysBitmask,
              exceptionMap,
            });
            if (result) {
              generatedItems.push(result.generatedLine);
              cursor = addDaysInclusive(result.generatedLine.endDate, 1, workDaysBitmask, exceptionMap);
              previousClusterEndDate = result.generatedLine.endDate;
            }
          } else {
            // Similar items: schedule in parallel with SS + lag
            const sortedCluster = sortLines(cluster);
            const lagDays = options.similarityLagDays ?? 0;
            const clusterCursor = cursor;
            let clusterMaxEndDate = cursor;

            for (let i = 0; i < sortedCluster.length; i++) {
              const line = sortedCluster[i];
              const staggeredCursor = i === 0 ? clusterCursor : addDaysInclusive(clusterCursor, lagDays, workDaysBitmask, exceptionMap);

              const result = tryGenerateLine({
                line,
                cursor: staggeredCursor,
                previousLine: i === 0 ? null : sortedCluster[i - 1].itemCode,
                reviewedBudgetItemIds,
                issues,
                options,
                useSSPredecessor: i > 0,
                workDaysBitmask,
                exceptionMap,
              });
              if (!result) {
                continue;
              }

              generatedItems.push(result.generatedLine);
              if (result.generatedLine.endDate > clusterMaxEndDate) {
                clusterMaxEndDate = result.generatedLine.endDate;
              }
            }

            cursor = addDaysInclusive(clusterMaxEndDate, 1, workDaysBitmask, exceptionMap);
            previousClusterEndDate = clusterMaxEndDate;
          }
        }

        return previousClusterEndDate;
      },
    });

    subBudgetStaggerOffset = getNextSubBudgetStaggerOffset(subBudgetStaggerOffset, options);
  }

  return generatedItems;
}

// ─── Line generation helper ──────────────────────────────────────────────────

function tryGenerateLine({
  line,
  cursor,
  previousLine,
  reviewedBudgetItemIds,
  issues,
  options,
  useSSPredecessor = false,
  workDaysBitmask,
  exceptionMap,
}: {
  line: WorkScheduleLineRecord;
  cursor: string;
  previousLine: string | null;
  reviewedBudgetItemIds?: Set<string>;
  issues: WorkScheduleGenerationIssueRecord[];
  options: WorkScheduleGenerationOptions;
  useSSPredecessor?: boolean;
  workDaysBitmask?: number;
  exceptionMap?: CalendarExceptionMap;
}) {
  // Check suspicious default performance
  if (
    !reviewedBudgetItemIds?.has(line.budgetItemId) &&
    hasSuspiciousDefaultWorkSchedulePerformance({ performance: line.performance, unit: line.unit, quantity: line.quantity })
  ) {
    issues.push({
      budgetItemId: line.budgetItemId,
      itemCode: line.itemCode,
      reason: `La partida mantiene el rendimiento tecnico por defecto (1 ${line.unit}/DIA) para su metrado actual. Define un rendimiento real antes de programarla`,
    });
    return null;
  }

  // Calculate crew (with optimization if maxDurationDays is set)
  const { crew, durationDays } = calculateOptimalCrewAndDuration(line, options);

  if (durationDays == null) {
    issues.push({
      budgetItemId: line.budgetItemId,
      itemCode: line.itemCode,
      reason: "La partida no tiene rendimiento o cuadrilla suficiente para calcular duracion",
    });
    return null;
  }

  if (durationDays > MAX_GENERATED_WORK_SCHEDULE_DURATION_DAYS) {
    issues.push({
      budgetItemId: line.budgetItemId,
      itemCode: line.itemCode,
      reason: `La duracion calculada supera el limite permitido de ${MAX_GENERATED_WORK_SCHEDULE_DURATION_DAYS.toLocaleString("en-US")} dias`,
    });
    return null;
  }

  const startDate = cursor;    const endDate = addDaysInclusive(startDate, durationDays - 1, workDaysBitmask, exceptionMap);

  let predecessor: string | null = null;
  if (previousLine) {
    if (useSSPredecessor) {
      predecessor = `${previousLine}SS`;
    } else {
      predecessor = formatGeneratedPredecessor(previousLine);
    }
  }

  const generatedLine: GeneratedScheduleLine = {
    budgetItemId: line.budgetItemId,
    itemCode: line.itemCode,
    startDate,
    endDate,
    durationDays,
    predecessor,
    crew,
    monthlyDistributions: buildWorkScheduleMonthlyDistributionsFromRange(startDate, endDate),
  };

  return { generatedLine };
}

// ─── Crew optimization ───────────────────────────────────────────────────────

function calculateOptimalCrewAndDuration(
  line: WorkScheduleLineRecord,
  options: WorkScheduleGenerationOptions,
): { crew: number; durationDays: number | null } {
  const defaultDuration = calculateWorkScheduleDurationDays({
    quantity: line.quantity,
    performance: line.performance,
    crew: DEFAULT_GENERATED_WORK_SCHEDULE_CREW,
  });

  if (defaultDuration == null) {
    return { crew: DEFAULT_GENERATED_WORK_SCHEDULE_CREW, durationDays: null };
  }

  const maxDurationDays = options.maxDurationDays;
  if (maxDurationDays == null || defaultDuration <= maxDurationDays) {
    return { crew: DEFAULT_GENERATED_WORK_SCHEDULE_CREW, durationDays: defaultDuration };
  }

  // Calculate minimum crew needed to fit within maxDurationDays
  if (line.performance == null || line.performance <= 0 || line.quantity <= 0) {
    return { crew: DEFAULT_GENERATED_WORK_SCHEDULE_CREW, durationDays: defaultDuration };
  }

  const optimalCrew = Math.ceil(line.quantity / (line.performance * maxDurationDays));
  const optimizedDuration = calculateWorkScheduleDurationDays({
    quantity: line.quantity,
    performance: line.performance,
    crew: optimalCrew,
  });

  if (optimizedDuration == null) {
    return { crew: DEFAULT_GENERATED_WORK_SCHEDULE_CREW, durationDays: defaultDuration };
  }

  return { crew: optimalCrew, durationDays: optimizedDuration };
}

// ─── Similarity clustering ───────────────────────────────────────────────────

function buildSimilarityClusters(lines: WorkScheduleLineRecord[]): WorkScheduleLineRecord[][] {
  const clusters: WorkScheduleLineRecord[][] = [];
  const remaining = new Set(lines.map((line) => line.budgetItemId));
  const lineById = new Map(lines.map((line) => [line.budgetItemId, line]));

  for (const line of lines) {
    if (!remaining.has(line.budgetItemId)) {
      continue;
    }

    const cluster: WorkScheduleLineRecord[] = [line];
    remaining.delete(line.budgetItemId);

    // Find similar items
    for (const candidate of lines) {
      if (!remaining.has(candidate.budgetItemId)) {
        continue;
      }

      if (areLinesSimilar(line, candidate)) {
        cluster.push(candidate);
        remaining.delete(candidate.budgetItemId);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function areLinesSimilar(left: WorkScheduleLineRecord, right: WorkScheduleLineRecord): boolean {
  // Same unit is required
  if (normalizeUnit(left.unit) !== normalizeUnit(right.unit)) {
    return false;
  }

  // Same level parent is required (if both have levelId)
  if (left.levelId && right.levelId && left.levelId !== right.levelId) {
    return false;
  }

  // Performance must be within tolerance
  if (left.performance != null && right.performance != null) {
    const avgPerformance = (left.performance + right.performance) / 2;
    if (avgPerformance > 0) {
      const diff = Math.abs(left.performance - right.performance) / avgPerformance;
      if (diff > SIMILARITY_PERFORMANCE_TOLERANCE) {
        return false;
      }
    }
  }

  return true;
}

// ─── Level grouping helpers ──────────────────────────────────────────────────

function groupLinesByTopLevel(
  lines: WorkScheduleLineRecord[],
  levelById?: Map<string, LevelInfo>,
): Map<string, WorkScheduleLineRecord[]> {
  const result = new Map<string, WorkScheduleLineRecord[]>();

  for (const line of lines) {
    const topLevelId = findTopLevelId(line.levelId, levelById);
    const bucket = result.get(topLevelId) ?? [];
    bucket.push(line);
    result.set(topLevelId, bucket);
  }

  return result;
}

function findTopLevelId(levelId: string | null | undefined, levelById?: Map<string, LevelInfo>): string {
  if (!levelId || !levelById) {
    return levelId ?? "__no_level__";
  }

  let currentId: string | null = levelId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const info = levelById.get(currentId);
    if (!info) {
      return currentId;
    }

    // TITLE and SUBTITLE are top-level grouping points
    if (info.type === "TITLE" || info.type === "SUBTITLE") {
      // Walk up to find the root-most TITLE/SUBTITLE
      if (!info.parentId) {
        return currentId;
      }

      const parentInfo = levelById.get(info.parentId);
      if (!parentInfo || (parentInfo.type !== "TITLE" && parentInfo.type !== "SUBTITLE")) {
        return currentId;
      }

      currentId = info.parentId;
      continue;
    }

    // For ITEM_GROUP and SUBITEM, walk up to parent
    if (!info.parentId) {
      return currentId;
    }

    currentId = info.parentId;
  }

  return levelId ?? "__no_level__";
}

// ─── Sub-budget parallelism ──────────────────────────────────────────────────

function getNextSubBudgetStaggerOffset(
  currentOffset: number,
  options: WorkScheduleGenerationOptions,
): number {
  const parallelism = options.interSubBudgetParallelism ?? "independent";

  switch (parallelism) {
    case "staggered":
      return currentOffset + (options.interSubBudgetStaggerDays ?? DEFAULT_STAGGER_DAYS);
    case "parallel":
      return 0;
    case "independent":
    default:
      return 0;
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function normalizeGenerationOptions(options?: WorkScheduleGenerationOptions): WorkScheduleGenerationOptions {
  return {
    strategy: options?.strategy ?? "sequential",
    maxDurationDays: options?.maxDurationDays ?? null,
    similarityLagDays: options?.similarityLagDays ?? 0,
    interSubBudgetParallelism: options?.interSubBudgetParallelism ?? "independent",
    interSubBudgetStaggerDays: options?.interSubBudgetStaggerDays ?? DEFAULT_STAGGER_DAYS,
    levelLinkage: options?.levelLinkage ?? null,
  };
}

function resolveLevelLinkage(
  topLevelKey: string,
  levelLinkage: Record<string, LevelLinkageMode> | null,
): LevelLinkageMode {
  if (!levelLinkage) {
    return "parallel";
  }

  return levelLinkage[topLevelKey] ?? "parallel";
}

function groupLinesBySubBudget(lines: WorkScheduleLineRecord[]): Map<string, WorkScheduleLineRecord[]> {
  const map = new Map<string, WorkScheduleLineRecord[]>();

  for (const line of lines) {
    const bucket = map.get(line.subBudgetId) ?? [];
    bucket.push(line);
    map.set(line.subBudgetId, bucket);
  }

  return map;
}

function sortLines(lines: WorkScheduleLineRecord[]): WorkScheduleLineRecord[] {
  return [...lines].sort((left, right) => {
    const leftSortOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightSortOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    return left.itemCode.localeCompare(right.itemCode, "es", { numeric: true });
  });
}

function normalizeScheduleText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAnyKeyword(value: string, keywords: readonly string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

// Classifies a line into a construction phase used by the `by_front` strategy.
// The order of checks matters: `testing` is evaluated first because words like
// "limpieza final", "entrega" or "recepcion" should be treated as final
// acceptance/testing even if they share words with earlier phases (e.g.
// "limpieza" also appears in `preliminaries`). After that, phases are checked
// in their natural construction sequence so that a line is assigned to the
// earliest matching phase.
function classifyWorkFrontPhase(line: WorkScheduleLineRecord): WorkFrontPhase {
  const text = normalizeScheduleText(`${line.itemCode} ${line.description} ${line.unit}`);

  // Testing must win over preliminaries/finishes when explicit final words are present.
  if (includesAnyKeyword(text, WORK_FRONT_PHASE_KEYWORDS.testing)) {
    return "testing";
  }

  if (includesAnyKeyword(text, WORK_FRONT_PHASE_KEYWORDS.preliminaries)) {
    return "preliminaries";
  }

  if (includesAnyKeyword(text, WORK_FRONT_PHASE_KEYWORDS.earthwork)) {
    return "earthwork";
  }

  if (includesAnyKeyword(text, WORK_FRONT_PHASE_KEYWORDS.structure)) {
    return "structure";
  }

  if (includesAnyKeyword(text, WORK_FRONT_PHASE_KEYWORDS.masonry)) {
    return "masonry";
  }

  if (includesAnyKeyword(text, WORK_FRONT_PHASE_KEYWORDS.installations)) {
    return "installations";
  }

  if (includesAnyKeyword(text, WORK_FRONT_PHASE_KEYWORDS.finishes)) {
    return "finishes";
  }

  return "other";
}

function getWorkFrontPhaseOrder(phase: WorkFrontPhase) {
  return WORK_FRONT_PHASE_ORDER[phase];
}

function sortWorkFrontLines(lines: WorkFrontLine[]) {
  return [...lines].sort((left, right) => {
    const phaseDifference = getWorkFrontPhaseOrder(left.phase) - getWorkFrontPhaseOrder(right.phase);
    if (phaseDifference !== 0) {
      return phaseDifference;
    }

    return left.originalIndex - right.originalIndex;
  });
}

function normalizeUnit(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function buildGenerationHighlights(
  items: GeneratedScheduleLine[],
  options: WorkScheduleGenerationOptions,
): string[] {
  const highlights: string[] = [];

  // Strategy (only mention if non-default)
  if (options.strategy !== "sequential") {
    const strategyLabels: Record<Exclude<WorkScheduleGenerationStrategy, "sequential">, string> = {
      by_level: "Estrategia por niveles (titulos en paralelo)",
      by_similarity: "Estrategia por similitud",
      by_front: "Estrategia por frentes de obra",
    };
    highlights.push(strategyLabels[options.strategy]);
  }

  if (options.strategy === "by_front") {
    highlights.push("Secuencia constructiva aplicada por fase tecnica");
  }

  // Crew optimization
  const crewAdjustedItems = items.filter((item) => item.crew != null && item.crew > 1);
  if (crewAdjustedItems.length > 0) {
    const maxCrew = Math.max(...crewAdjustedItems.map((item) => item.crew ?? 1));
    highlights.push(
      `${crewAdjustedItems.length} partida${crewAdjustedItems.length === 1 ? "" : "s"} con cuadrilla ajustada (maximo ${maxCrew})`,
    );

    // Max duration constraint — only mention if crew was actually adjusted
    if (options.maxDurationDays != null) {
      highlights.push(`Duracion maxima limite: ${options.maxDurationDays} dias`);
    }
  }

  // Similarity clustering (count SS predecessors)
  if (options.strategy === "by_similarity") {
    const ssCount = items.filter((item) => item.predecessor?.endsWith("SS")).length;
    if (ssCount > 0) {
      highlights.push(`${ssCount} partida${ssCount === 1 ? "" : "s"} paralelizada${ssCount === 1 ? "" : "s"} (SS)`);
    }
  }

  // Sub-budget parallelism
  if (options.interSubBudgetParallelism === "staggered") {
    highlights.push(`Especialidades escalonadas cada ${options.interSubBudgetStaggerDays ?? DEFAULT_STAGGER_DAYS} dias`);
  } else if (options.interSubBudgetParallelism === "parallel") {
    highlights.push("Especialidades en paralelo");
  }

  return highlights;
}

function addDaysInclusive(isoDate: string, daysToAdd: number, workDaysBitmask?: number, exceptionMap?: CalendarExceptionMap) {
  if (workDaysBitmask != null) {
    return addWorkDays(isoDate, daysToAdd, workDaysBitmask, exceptionMap);
  }

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date.toISOString().slice(0, 10);
}
