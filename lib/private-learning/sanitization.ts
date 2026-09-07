import { createHash } from "node:crypto";
import type { JsonObject } from "./types";

const SECRET_KEYS = /token|secret|password|credential|authorization|api[_-]?key|file|binary/i;
export function sanitizePrivateLearningPayload(input: JsonObject): JsonObject {
  const clean: JsonObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEYS.test(key)) continue;
    if (typeof value === "string" && value.length > 10_000) continue;
    clean[key] = typeof value === "object" && value !== null && !Array.isArray(value) ? sanitizePrivateLearningPayload(value as JsonObject) : value;
  }
  return clean;
}
export function privateLearningContentHash(input: { companyId: string; signalType: string; inputJson: JsonObject; resultJson: JsonObject; schemaVersion: string }): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
