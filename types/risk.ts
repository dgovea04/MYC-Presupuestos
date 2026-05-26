export const MONTE_CARLO_ITERATIONS = 10000;

export type RiskVariableType = "QUANTITY";
export type RiskDistributionType = "TRIANGULAR";

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
};

export type RiskVariableRecord = {
  id: string;
  budgetId: string;
  budgetItemId: string;
  variableType: RiskVariableType;
  distributionType: RiskDistributionType;
  minimum: number;
  mostLikely: number;
  maximum: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export type RiskPercentileKey = "p10" | "p50" | "p80" | "p90" | "p95";

export type RiskSimulationSummary = {
  id?: string;
  budgetId: string;
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
  createdAt?: string;
};

export type RiskAnalysisPayload = {
  budget: RiskBudgetContext;
  items: RiskBudgetItem[];
  variables: RiskVariableRecord[];
  latestRun: RiskSimulationSummary | null;
};

export type RiskSimulationInput = {
  budgetId: string;
  baseTotal: number;
  iterations: number;
  items: RiskBudgetItem[];
  variables: RiskVariableRecord[];
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
