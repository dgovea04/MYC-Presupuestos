import Decimal from "decimal.js";

const TOKENS_PER_MILLION = new Decimal(1_000_000);

type CostDirection = "input" | "output";

/**
 * Costos en unidades menores de la moneda configurada (por defecto céntimos).
 * Los valores se leen del entorno para evitar codificar precios cambiantes.
 */
export function estimateAiCostMinor(input: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens?: number;
}): number {
  const inputRate = readRate(input.provider, input.model, "input");
  const outputRate = readRate(input.provider, input.model, "output");
  const inputCost = new Decimal(normalizeTokens(input.inputTokens))
    .mul(inputRate)
    .div(TOKENS_PER_MILLION);
  const outputCost = new Decimal(normalizeTokens(input.outputTokens ?? 0))
    .mul(outputRate)
    .div(TOKENS_PER_MILLION);

  return Math.max(0, inputCost.plus(outputCost).ceil().toNumber());
}

/**
 * Reserva de forma conservadora el coste de entrada y una salida de tamaño
 * equivalente. El coste real se liquida al terminar la solicitud.
 */
export function estimateAiReservationCostMinor(input: {
  provider: string;
  model: string;
  estimatedTokens: number;
}): number {
  const tokens = normalizeTokens(input.estimatedTokens);
  return estimateAiCostMinor({
    provider: input.provider,
    model: input.model,
    inputTokens: tokens,
    outputTokens: tokens,
  });
}

function readRate(provider: string, model: string, direction: CostDirection): Decimal {
  const providerKey = provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const modelKey = model.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const specific = process.env[`AI_${providerKey}_${modelKey}_${direction.toUpperCase()}_COST_MINOR_PER_MILLION`];
  const providerRate = process.env[`AI_${providerKey}_${direction.toUpperCase()}_COST_MINOR_PER_MILLION`];
  const defaultRate = process.env[`AI_DEFAULT_${direction.toUpperCase()}_COST_MINOR_PER_MILLION`];

  return new Decimal(specific ?? providerRate ?? defaultRate ?? "0");
}

function normalizeTokens(value: number) {
  if (!Number.isFinite(value)) throw new Error("Token count must be finite.");
  return Math.max(0, Math.ceil(value));
}
