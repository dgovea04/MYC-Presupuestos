import Decimal from "decimal.js";

export type AiModelCatalogEntry = {
  provider: "OPENAI" | "GEMINI" | "OPENROUTER";
  model: string;
  currency: string;
  inputMinorPerMillion: number;
  outputMinorPerMillion: number;
  active: boolean;
};

const catalog: readonly AiModelCatalogEntry[] = [
  { provider: "OPENAI", model: "gpt-4o-mini", currency: "USD", inputMinorPerMillion: 15, outputMinorPerMillion: 60, active: true },
  { provider: "OPENAI", model: "gpt-4o", currency: "USD", inputMinorPerMillion: 250, outputMinorPerMillion: 1000, active: true },
  { provider: "GEMINI", model: "gemini-1.5-flash", currency: "USD", inputMinorPerMillion: 8, outputMinorPerMillion: 30, active: true },
  { provider: "OPENROUTER", model: "openai/gpt-4o-mini", currency: "USD", inputMinorPerMillion: 15, outputMinorPerMillion: 60, active: true },
];

export function listAiModelCatalog() {
  return catalog;
}

export function findAiModelCatalogEntry(provider: string, model: string) {
  return catalog.find((entry) => entry.active && entry.provider === provider.toUpperCase() && entry.model === model) ?? null;
}

export function calculateCatalogCostMinor(input: { entry: AiModelCatalogEntry; inputTokens: number; outputTokens: number }) {
  const inputCost = new Decimal(Math.max(0, Math.ceil(input.inputTokens))).mul(input.entry.inputMinorPerMillion).div(1_000_000);
  const outputCost = new Decimal(Math.max(0, Math.ceil(input.outputTokens))).mul(input.entry.outputMinorPerMillion).div(1_000_000);
  return inputCost.plus(outputCost).ceil().toNumber();
}
