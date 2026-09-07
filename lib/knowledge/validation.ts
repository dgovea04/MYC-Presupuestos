import Decimal from "decimal.js";
import type { KnowledgeScopeContext } from "./types";

export function validateKnowledgeScope(input: KnowledgeScopeContext): void {
  if (input.scope === "COMPANY" && !input.companyId) throw new Error("companyId is required for company scope");
  if (input.scope === "PROJECT" && (!input.companyId || !input.projectId)) throw new Error("companyId and projectId are required for project scope");
  if (input.scope === "USER" && !input.userId) throw new Error("userId is required for user scope");
}

export function validateObservationValue(value: Decimal.Value): Decimal {
  let decimal: Decimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new Error("Value must be a valid Decimal");
  }
  if (!decimal.isFinite()) throw new Error("Value must be a valid Decimal");
  if (!decimal.gt(0)) throw new Error("Value must be positive");
  return decimal;
}
