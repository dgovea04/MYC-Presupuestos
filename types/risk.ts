export const MONTE_CARLO_ITERATIONS = 10000 as const;

export type RiskVariableType = "QUANTITY" | "UNIT_PRICE" | "DURATION";
export type RiskDistributionType = "TRIANGULAR" | "PERT" | "NORMAL" | "UNIFORM";
export type RiskScenarioSource = "MANUAL" | "AGENT";
export type RiskScenarioStatus = "DRAFT" | "APPROVED" | "ARCHIVED";
export type RiskInputSource = "MANUAL" | "AGENT" | "HEURISTIC";
export type RiskSuggestionStrategy = "balanced" | "conservative" | "aggressive";

export type RiskBudgetKind = "GENERAL" | "SUB_BUDGET";

export type RiskBudgetContext = {
  id: string;
  projectId: string;
  name: string;
  kind: RiskBudgetKind;
  currency: string;
  baseTotal: number;
};

export type RiskBudgetItem = {
  itemId: string;
  budgetId: string;
  sourceBudgetName: string;
  code: string;
  description: string;
  unit: string;
  baseQuantity: number;
  unitPrice: number;
  baseTotal: number;
  updatedAt: string;
};

export type RiskVariableRecord = {
  id: string;
  budgetId: string;
  scenarioId?: string | null;
  budgetItemId: string;
  variableType: RiskVariableType;
  distributionType: RiskDistributionType;
  minimum: number;
  mostLikely: number;
  maximum: number;
  enabled: boolean;
  source?: RiskInputSource;
  confidence?: number | null;
  rationale?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RiskVariableDraftKey = `${string}:${RiskVariableType}`;

export type RiskCorrelationRecord = {
  id: string;
  budgetId: string;
  scenarioId?: string | null;
  sourceVariableId: string;
  targetVariableId: string;
  coefficient: number;
  source?: RiskInputSource;
  confidence?: number | null;
  rationale?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type RiskScenarioRecord = {
  id: string;
  budgetId: string;
  name: string;
  description: string | null;
  source: RiskScenarioSource;
  status: RiskScenarioStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type RiskVariableSuggestion = {
  id: string;
  budgetId: string;
  budgetItemId: string;
  itemCode: string;
  itemDescription: string;
  sourceBudgetName: string;
  variableType: RiskVariableType;
  distributionType: RiskDistributionType;
  minimum: number;
  mostLikely: number;
  maximum: number;
  confidence: number;
  reason: string;
  source: "HEURISTIC" | "AGENT";
  impactScore: number;
};

export type RiskSimulationModelSnapshot = {
  budgetId: string;
  scenarioId: string | null;
  baseTotal: number;
  iterations: number;
  seed: string;
  engineVersion: string;
  itemIds: string[];
  variableIds: string[];
  correlationIds: string[];
  createdAt: string;
};

export type RiskSimulationRunRequest = {
  budgetId: string;
  scenarioId?: string;
  seed?: string;
};

export type RiskWorkScheduleCriticalItem = {
  budgetItemId: string;
  itemCode: string;
  description: string;
  subBudgetName: string;
  partial: number;
  durationDays: number | null;
  startDate: string | null;
  endDate: string | null;
};

export type RiskWorkScheduleSimulationLine = {
  budgetItemId: string;
  itemCode: string;
  description: string;
  durationDays: number;
  predecessor: string | null;
  subBudgetName: string;
};

export type RiskWorkScheduleSummary = {
  budgetId: string;
  budgetName: string;
  currency: string;
  timeline: {
    startDate: string | null;
    endDate: string | null;
  };
  criticalPath: {
    status: "calculated" | "cycle";
    projectDurationDays: number;
    scheduledItemCount: number;
    criticalItemCount: number;
    issues: string[];
  } | null;
  generationSummary: {
    generatedCount: number;
    pendingCount: number;
  } | null;
  criticalItems: RiskWorkScheduleCriticalItem[];
  simulationLines: RiskWorkScheduleSimulationLine[];
};

export type RiskHistogramBin = {
  min: number;
  max: number;
  midpoint: number;
  frequency: number;
  probability: number;
};

export type RiskSCurvePoint = {
  cost: number;
  cumulativeProbability: number;
};

export type RiskBoxPlotStats = {
  minimum: number;
  lowerQuartile: number;
  median: number;
  upperQuartile: number;
  maximum: number;
};

export type RiskTornadoRow = {
  itemId: string;
  label: string;
  lowDelta: number;
  highDelta: number;
  impact: number;
};

export type RiskPercentileKey = "p10" | "p50" | "p80" | "p90" | "p95";

export type RiskSimulationSummary = {
  id?: string;
  budgetId: string;
  scenarioId?: string | null;
  iterations: number;
  baseTotal: number;
  mean: number;
  median: number;
  variance: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
  p10: number;
  p50: number;
  p80: number;
  p90: number;
  p95: number;
  histogramBins: RiskHistogramBin[];
  sCurvePoints: RiskSCurvePoint[];
  scheduleDuration: RiskScheduleDurationSummary | null;
  seed?: string | null;
  engineVersion?: string | null;
  modelSnapshot?: RiskSimulationModelSnapshot | null;
  createdAt?: string;
};

export type RiskScheduleDurationSummary = {
  iterations: number;
  baseProjectDurationDays: number;
  meanDurationDays: number;
  medianDurationDays: number;
  p80DurationDays: number;
  p90DurationDays: number;
  p95DurationDays: number;
  minimumDurationDays: number;
  maximumDurationDays: number;
  criticalItemCount: number;
  histogramBins: RiskHistogramBin[];
  sCurvePoints: RiskSCurvePoint[];
};

export type RiskAnalysisPayload = {
  budget: RiskBudgetContext;
  items: RiskBudgetItem[];
  variables: RiskVariableRecord[];
  correlations: RiskCorrelationRecord[];
  latestRun: RiskSimulationSummary | null;
};

export type RiskSimulationInput = {
  budgetId: string;
  baseTotal: number;
  iterations: number;
  items: RiskBudgetItem[];
  variables: RiskVariableRecord[];
  correlations: RiskCorrelationRecord[];
  workSchedule?: {
    lines: RiskWorkScheduleSimulationLine[];
  } | null;
};

export type RiskWorkerRunMessage = {
  type: "run";
  input: RiskSimulationInput;
};

export type RiskWorkerProgressMessage = {
  type: "progress";
  completedIterations: number;
  totalIterations: number;
};

export type RiskWorkerResultMessage = {
  type: "result";
  summary: RiskSimulationSummary;
};

export type RiskWorkerErrorMessage = {
  type: "error";
  message: string;
};

export type RiskWorkerRequestMessage = RiskWorkerRunMessage;
export type RiskWorkerMessage = RiskWorkerProgressMessage | RiskWorkerResultMessage | RiskWorkerErrorMessage;
