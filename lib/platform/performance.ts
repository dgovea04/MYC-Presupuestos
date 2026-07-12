import { performance } from "node:perf_hooks";

type PerformanceContextValue = string | number | boolean | null | undefined;

export type PerformanceContext = Record<string, PerformanceContextValue>;

const truthyEnvValues = new Set(["1", "true", "yes", "on"]);

export function shouldLogPerformance(): boolean {
  return truthyEnvValues.has((process.env.MYC_PERF_LOGS ?? "").trim().toLowerCase());
}

export async function measureAsync<T>(
  label: string,
  operation: () => Promise<T>,
  context?: PerformanceContext,
): Promise<T> {
  if (!shouldLogPerformance()) {
    return operation();
  }

  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    const elapsedMs = Math.round((performance.now() - startedAt) * 10) / 10;
    const contextText = formatPerformanceContext(context);
    console.info(`[perf] ${label} ${elapsedMs}ms${contextText}`);
  }
}

function formatPerformanceContext(context?: PerformanceContext): string {
  if (!context) {
    return "";
  }

  const entries = Object.entries(context).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return "";
  }

  return ` ${JSON.stringify(Object.fromEntries(entries))}`;
}
