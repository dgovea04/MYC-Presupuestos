import { describe, expect, it } from "vitest";
import { runMonteCarloSimulation } from "@/lib/risk/monte-carlo-engine";
import { buildRiskPdfTables } from "@/lib/risk/pdf-report";
import { suggestRiskVariables } from "@/lib/risk/suggestions";
import type {
  RiskAnalysisPayload,
  RiskCorrelationRecord,
  RiskSimulationSummary,
  RiskVariableRecord,
  RiskVariableSuggestion,
  RiskWorkScheduleSummary,
} from "@/types/risk";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seededRandom(): () => number {
  let state = 12345678;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createPayload(overrides: Partial<RiskAnalysisPayload> = {}): RiskAnalysisPayload {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Obra Demo",
      kind: "GENERAL",
      currency: "PEN",
      baseTotal: 5000,
    },
    items: [
      {
        itemId: "item-1",
        budgetId: "child-1",
        sourceBudgetName: "Estructuras",
        code: "01.01",
        description: "Excavacion masiva",
        unit: "m3",
        baseQuantity: 50,
        unitPrice: 40,
        baseTotal: 2000,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
      {
        itemId: "item-2",
        budgetId: "child-1",
        sourceBudgetName: "Estructuras",
        code: "01.02",
        description: "Concreto f'c=210 kg/cm2",
        unit: "m3",
        baseQuantity: 10,
        unitPrice: 300,
        baseTotal: 3000,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    variables: [],
    correlations: [],
    latestRun: null,
    ...overrides,
  };
}

function createWorkScheduleSummary(): RiskWorkScheduleSummary {
  return {
    budgetId: "budget-1",
    budgetName: "Obra Demo",
    currency: "PEN",
    timeline: { startDate: "2026-08-01", endDate: "2026-12-31" },
    criticalPath: {
      status: "calculated",
      projectDurationDays: 120,
      scheduledItemCount: 2,
      criticalItemCount: 2,
      issues: [],
    },
    generationSummary: { generatedCount: 2, pendingCount: 0 },
    criticalItems: [
      {
        budgetItemId: "item-1",
        itemCode: "01.01",
        description: "Excavacion masiva",
        subBudgetName: "Estructuras",
        partial: 2000,
        durationDays: 15,
        startDate: "2026-08-01",
        endDate: "2026-08-15",
      },
      {
        budgetItemId: "item-2",
        itemCode: "01.02",
        description: "Concreto f'c=210 kg/cm2",
        subBudgetName: "Estructuras",
        partial: 3000,
        durationDays: 30,
        startDate: "2026-08-16",
        endDate: "2026-09-14",
      },
    ],
    simulationLines: [
      {
        budgetItemId: "item-1",
        itemCode: "01.01",
        description: "Excavacion masiva",
        durationDays: 15,
        predecessor: null,
        subBudgetName: "Estructuras",
      },
      {
        budgetItemId: "item-2",
        itemCode: "01.02",
        description: "Concreto f'c=210 kg/cm2",
        durationDays: 30,
        predecessor: "01.01",
        subBudgetName: "Estructuras",
      },
    ],
  };
}

function suggestionToVariable(suggestion: RiskVariableSuggestion): RiskVariableRecord {
  return {
    id: suggestion.id,
    budgetId: suggestion.budgetId,
    budgetItemId: suggestion.budgetItemId,
    variableType: suggestion.variableType,
    distributionType: suggestion.distributionType,
    minimum: suggestion.minimum,
    mostLikely: suggestion.mostLikely,
    maximum: suggestion.maximum,
    enabled: true,
    source: suggestion.source,
    confidence: suggestion.confidence,
    rationale: suggestion.reason,
  };
}

// ─── E2E Flow ────────────────────────────────────────────────────────────────

describe("risk analysis end-to-end flow", () => {
  it("payload → suggestions → scenario → simulation → PDF tables", () => {
    // ── 1. Payload ──────────────────────────────────────────────────────
    const payload = createPayload();
    const workScheduleSummary = createWorkScheduleSummary();

    expect(payload.budget.kind).toBe("GENERAL");
    expect(payload.items).toHaveLength(2);
    expect(payload.variables).toHaveLength(0);

    // ── 2. Sugerencias ──────────────────────────────────────────────────
    const suggestions = suggestRiskVariables({
      payload,
      workScheduleSummary,
      strategy: "conservative",
      maxSuggestions: 12,
    });

    // Deben generarse sugerencias para ambas partidas
    expect(suggestions.length).toBeGreaterThanOrEqual(2);

    // Al menos una sugerencia de DURATION para partidas de ruta crítica
    const durationSuggestions = suggestions.filter(
      (suggestion) => suggestion.variableType === "DURATION",
    );
    expect(durationSuggestions.length).toBeGreaterThanOrEqual(1);

    // Cada sugerencia tiene datos consistentes
    for (const suggestion of suggestions) {
      expect(suggestion.minimum).toBeLessThanOrEqual(suggestion.mostLikely);
      expect(suggestion.mostLikely).toBeLessThanOrEqual(suggestion.maximum);
      expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
      expect(suggestion.impactScore).toBeGreaterThanOrEqual(0);
    }

    // ── 3. Escenario ────────────────────────────────────────────────────
    // Convertir sugerencias a variables (mismo flujo que el dashboard)
    const scenarioVariables = suggestions.map(suggestionToVariable);

    expect(scenarioVariables).toHaveLength(suggestions.length);
    for (const variable of scenarioVariables) {
      expect(variable.enabled).toBe(true);
      expect(variable.id).toBeTruthy();
      expect(variable.budgetItemId).toBeTruthy();
    }

    // ── 4. Simulación ───────────────────────────────────────────────────
    const summary = runMonteCarloSimulation(
      {
        budgetId: payload.budget.id,
        baseTotal: payload.budget.baseTotal,
        iterations: 1000,
        items: payload.items,
        variables: scenarioVariables,
        correlations: [],
        workSchedule: {
          lines: workScheduleSummary.simulationLines,
        },
      },
      {
        random: seededRandom(),
        histogramBinCount: 12,
        sCurvePointCount: 15,
      },
    );

    // Estructura del summary
    expect(summary.budgetId).toBe("budget-1");
    expect(summary.iterations).toBe(1000);
    expect(summary.baseTotal).toBe(5000);

    // Todos los campos numéricos son finitos
    const numericKeys = [
      "mean",
      "median",
      "variance",
      "standardDeviation",
      "skewness",
      "kurtosis",
      "p10",
      "p50",
      "p80",
      "p90",
      "p95",
    ] as const;
    for (const key of numericKeys) {
      expect(Number.isFinite(summary[key]), `${key} must be finite`).toBe(true);
    }

    // Orden de percentiles
    expect(summary.p10).toBeLessThanOrEqual(summary.p50);
    expect(summary.p50).toBeLessThanOrEqual(summary.p80);
    expect(summary.p80).toBeLessThanOrEqual(summary.p90);
    expect(summary.p90).toBeLessThanOrEqual(summary.p95);

    // Histograma y curva S tienen la estructura esperada
    expect(summary.histogramBins.length).toBe(12);
    expect(summary.sCurvePoints.length).toBe(15);

    // Las frecuencias del histograma suman al total de iteraciones
    const totalFrequency = summary.histogramBins.reduce(
      (sum, bin) => sum + bin.frequency,
      0,
    );
    expect(totalFrequency).toBe(1000);

    // Las probabilidades del histograma suman ~1
    const totalProbability = summary.histogramBins.reduce(
      (sum, bin) => sum + bin.probability,
      0,
    );
    expect(totalProbability).toBeCloseTo(1, 8);

    // La curva S termina con probabilidad 1
    expect(
      summary.sCurvePoints.at(-1)?.cumulativeProbability,
    ).toBe(1);

    // scheduleDuration existe porque pasamos workSchedule con líneas
    expect(summary.scheduleDuration).not.toBeNull();
    if (summary.scheduleDuration) {
      expect(
        Number.isFinite(summary.scheduleDuration.meanDurationDays),
      ).toBe(true);
      expect(
        summary.scheduleDuration.iterations,
      ).toBe(1000);
    }

    // ── 5. PDF ──────────────────────────────────────────────────────────
    const payloadWithRun = createPayload({
      variables: scenarioVariables,
      latestRun: summary,
    });

    const tables = buildRiskPdfTables(payloadWithRun, 2);

    // Tablas esperadas en el reporte
    const tableTitles = tables.map((table) => table.title);
    expect(tableTitles).toContain("Resumen ejecutivo");
    expect(tableTitles).toContain("Curva S acumulada");
    expect(tableTitles).toContain("Percentiles y contingencia");
    expect(tableTitles).toContain("Variables activas");
    expect(tableTitles).toContain("Histograma resumido");

    // Tabla de resumen ejecutivo tiene métricas clave
    const executiveTable = tables.find(
      (table) => table.title === "Resumen ejecutivo",
    );
    expect(executiveTable).toBeDefined();
    const metricLabels = executiveTable!.rows.map((row) => row[0]);
    expect(metricLabels).toContain("Base presupuestada");
    expect(metricLabels).toContain("Promedio simulado");
    expect(metricLabels).toContain("Mediana");
    expect(metricLabels).toContain("Desviacion estandar");

    // Tabla de percentiles tiene filas P10-P95
    const percentilesTable = tables.find(
      (table) => table.title === "Percentiles y contingencia",
    );
    expect(percentilesTable).toBeDefined();
    expect(percentilesTable!.rows.length).toBeGreaterThanOrEqual(4);

    // Tabla de variables activas incluye las del escenario
    const variablesTable = tables.find(
      (table) => table.title === "Variables activas",
    );
    expect(variablesTable).toBeDefined();
    // Solo variables no-DURATION aparecen en la tabla (las DURATION no tienen código/detalle tradicional)
    const nonDurationCount = scenarioVariables.filter(
      (variable) => variable.variableType !== "DURATION",
    ).length;
    expect(variablesTable!.rows.length).toBeGreaterThanOrEqual(
      nonDurationCount,
    );

    // La curva S tiene un chart
    const curveTable = tables.find(
      (table) => table.title === "Curva S acumulada",
    );
    expect(curveTable).toBeDefined();
    expect(curveTable!.chart).toMatchObject({ kind: "curve" });

    // Tabla de contingencia de plazo (schedule duration presente)
    const scheduleTable = tables.find(
      (table) => table.title === "Contingencia de plazo",
    );
    expect(scheduleTable).toBeDefined();
    expect(scheduleTable!.rows.length).toBeGreaterThanOrEqual(1);

    // Buffer de plazo
    const bufferTable = tables.find(
      (table) => table.title === "Buffer recomendado de plazo",
    );
    expect(bufferTable).toBeDefined();
    expect(bufferTable!.rows.length).toBe(2);
  });

  it("maintiene consistencia de datos en todo el flujo con correlaciones", () => {
    const payload = createPayload({
      variables: [
        {
          id: "risk-qty",
          budgetId: "budget-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 45,
          mostLikely: 50,
          maximum: 58,
          enabled: true,
        },
        {
          id: "risk-price",
          budgetId: "budget-1",
          budgetItemId: "item-2",
          variableType: "UNIT_PRICE",
          distributionType: "PERT",
          minimum: 275,
          mostLikely: 300,
          maximum: 335,
          enabled: true,
        },
      ],
    });

    const correlations: RiskCorrelationRecord[] = [
      {
        id: "corr-1",
        budgetId: "budget-1",
        sourceVariableId: "risk-qty",
        targetVariableId: "risk-price",
        coefficient: 0.8,
      },
    ];

    // Simulación con correlaciones
    const summary = runMonteCarloSimulation(
      {
        budgetId: payload.budget.id,
        baseTotal: payload.budget.baseTotal,
        iterations: 1000,
        items: payload.items,
        variables: payload.variables,
        correlations,
      },
      {
        random: seededRandom(),
        histogramBinCount: 10,
        sCurvePointCount: 10,
      },
    );

    expect(Number.isFinite(summary.mean)).toBe(true);
    expect(summary.histogramBins.reduce((sum, bin) => sum + bin.frequency, 0)).toBe(1000);

    // PDF tables con correlaciones y snapshot
    const payloadWithRun = createPayload({
      variables: payload.variables,
      correlations,
      latestRun: {
        ...summary,
        scenarioId: "scenario-1",
        seed: "seed-e2e",
        engineVersion: "risk-engine-v2",
        modelSnapshot: {
          budgetId: payload.budget.id,
          scenarioId: "scenario-1",
          baseTotal: payload.budget.baseTotal,
          iterations: 1000,
          seed: "seed-e2e",
          engineVersion: "risk-engine-v2",
          itemIds: payload.items.map((item) => item.itemId),
          variableIds: payload.variables.map((variable) => variable.id),
          correlationIds: correlations.map((correlation) => correlation.id),
          createdAt: "2026-07-18T00:00:00.000Z",
        },
        createdAt: "2026-07-18T00:00:00.000Z",
      } satisfies RiskSimulationSummary,
    });

    const tables = buildRiskPdfTables(payloadWithRun, 2);

    // El resumen ejecutivo incluye metadata de auditoría
    const executiveTable = tables.find(
      (table) => table.title === "Resumen ejecutivo",
    );
    expect(executiveTable).toBeDefined();
    const metricLabels = executiveTable!.rows.map((row) => row[0]);
    expect(metricLabels).toContain("Escenario");
    expect(metricLabels).toContain("Semilla");
    expect(metricLabels).toContain("Motor");
    expect(metricLabels).toContain("Snapshot modelo");
  });

  it("funciona correctamente sin workSchedule (SUB_BUDGET sin cronograma)", () => {
    const payload = createPayload({
      budget: {
        id: "budget-2",
        projectId: "project-1",
        name: "Estructuras",
        kind: "SUB_BUDGET",
        currency: "PEN",
        baseTotal: 3000,
      },
    });

    // Sin workSchedule, las sugerencias no incluyen DURATION
    const suggestions = suggestRiskVariables({
      payload,
      workScheduleSummary: null,
      strategy: "balanced",
      maxSuggestions: 6,
    });

    const durationSuggestions = suggestions.filter(
      (suggestion) => suggestion.variableType === "DURATION",
    );
    expect(durationSuggestions).toHaveLength(0);

    // Las sugerencias son válidas
    for (const suggestion of suggestions) {
      expect(suggestion.minimum).toBeLessThanOrEqual(suggestion.mostLikely);
      expect(suggestion.mostLikely).toBeLessThanOrEqual(suggestion.maximum);
    }

    // Simulación sin schedule
    const variables = suggestions.map(suggestionToVariable);
    const summary = runMonteCarloSimulation(
      {
        budgetId: payload.budget.id,
        baseTotal: payload.budget.baseTotal,
        iterations: 500,
        items: payload.items,
        variables,
        correlations: [],
      },
      { random: seededRandom() },
    );

    expect(summary.scheduleDuration).toBeNull();

    // PDF sin tablas de plazo
    const payloadWithRun = createPayload({
      ...payload,
      variables,
      latestRun: summary,
    });

    const tables = buildRiskPdfTables(payloadWithRun, 2);
    const tableTitles = tables.map((table) => table.title);
    expect(tableTitles).not.toContain("Contingencia de plazo");
    expect(tableTitles).not.toContain("Buffer recomendado de plazo");
  });

  it("genera PDF con datos de auditoria completos cuando hay scenarioId, seed y modelSnapshot", () => {
    const payload = createPayload({
      variables: [
        {
          id: "risk-1",
          budgetId: "budget-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 40,
          mostLikely: 50,
          maximum: 60,
          enabled: true,
        },
      ],
    });

    const summary = runMonteCarloSimulation(
      {
        budgetId: payload.budget.id,
        baseTotal: payload.budget.baseTotal,
        iterations: 500,
        items: payload.items,
        variables: payload.variables,
        correlations: [],
      },
      { random: seededRandom() },
    );

    const payloadWithAudit = createPayload({
      variables: payload.variables,
      latestRun: {
        ...summary,
        scenarioId: "scenario-audit-1",
        seed: "fixed-seed-42",
        engineVersion: "risk-engine-v3-test",
        modelSnapshot: {
          budgetId: payload.budget.id,
          scenarioId: "scenario-audit-1",
          baseTotal: payload.budget.baseTotal,
          iterations: 500,
          seed: "fixed-seed-42",
          engineVersion: "risk-engine-v3-test",
          itemIds: payload.items.map((item) => item.itemId),
          variableIds: payload.variables.map((variable) => variable.id),
          correlationIds: [],
          createdAt: "2026-07-18T12:00:00.000Z",
        },
        createdAt: "2026-07-18T12:00:00.000Z",
      } satisfies RiskSimulationSummary,
    });

    const tables = buildRiskPdfTables(payloadWithAudit, 2);

    const executiveTable = tables.find(
      (table) => table.title === "Resumen ejecutivo",
    );
    expect(executiveTable).toBeDefined();

    const rows = executiveTable!.rows;
    const scenarioRow = rows.find((row) => row[0] === "Escenario");
    expect(scenarioRow).toBeDefined();
    expect(scenarioRow![1]).toBe("scenario-audit-1");

    const seedRow = rows.find((row) => row[0] === "Semilla");
    expect(seedRow).toBeDefined();
    expect(seedRow![1]).toBe("fixed-seed-42");

    const engineRow = rows.find((row) => row[0] === "Motor");
    expect(engineRow).toBeDefined();
    expect(engineRow![1]).toBe("risk-engine-v3-test");

    const snapshotRow = rows.find((row) => row[0] === "Snapshot modelo");
    expect(snapshotRow).toBeDefined();
    expect(snapshotRow![1]).toContain("2 partidas");
    expect(snapshotRow![1]).toContain("1 variables");
    expect(snapshotRow![1]).toContain("0 correlaciones");
  });
});
