import type { YieldObservationInput } from "./observations";
import { buildReviewApuCorrection, type ApuSnapshotInput } from "./apu";

type Comparison = { documentValue?: string; unit?: string; currency?: string };
type ReviewObservationInput = { findingId: string; decisionId: string; companyId: string; projectId: string; sourceId: string; evidenceId: string; observedAt: Date; confidence: YieldObservationInput["confidence"]; resolution: string; findingType: string; canonicalItemId?: string; resourceId?: string; comparison: Comparison; correctionVersionId?: string; apuBefore?: ApuSnapshotInput; apuAfter?: ApuSnapshotInput };
type BuiltObservation = Omit<YieldObservationInput, "idempotencyKey"> & { idempotencyKey: string } | { resourceId: string; value: string; unit: string; currency: string; scope: "PROJECT"; companyId: string; projectId: string; sourceId: string; evidenceId: string; observedAt: Date; confidence: YieldObservationInput["confidence"]; idempotencyKey: string };
type BuiltApuCorrection = ReturnType<typeof buildReviewApuCorrection>;

export function buildReviewObservations(input: ReviewObservationInput): { observations: BuiltObservation[]; apuCorrections: BuiltApuCorrection[]; skipReasons: string[] } {
  if (input.resolution !== "CONFIRMED_ISSUE" && input.resolution !== "CORRECTED") return { observations: [], apuCorrections: [], skipReasons: ["RESOLUTION_NOT_ELIGIBLE"] };
  if (input.findingType === "INCOMPLETE_APU") {
    if (input.resolution !== "CORRECTED") return { observations: [], apuCorrections: [], skipReasons: ["APU_CORRECTION_REQUIRED"] };
    if (!input.correctionVersionId || !input.apuBefore || !input.apuAfter) return { observations: [], apuCorrections: [], skipReasons: ["MISSING_APU_SNAPSHOT"] };
    try {
      return { observations: [], apuCorrections: [buildReviewApuCorrection({ findingId: input.findingId, decisionId: input.decisionId, correctionVersionId: input.correctionVersionId, sourceId: input.sourceId, evidenceId: input.evidenceId, before: input.apuBefore, after: input.apuAfter })], skipReasons: [] };
    } catch {
      return { observations: [], apuCorrections: [], skipReasons: ["APU_SNAPSHOT_UNCHANGED"] };
    }
  }
  if (!input.comparison.documentValue) return { observations: [], apuCorrections: [], skipReasons: ["MISSING_DOCUMENT_VALUE"] };
  if (!input.comparison.unit) return { observations: [], apuCorrections: [], skipReasons: ["MISSING_UNIT"] };
  if (input.findingType === "YIELD_MISMATCH") {
    if (!input.canonicalItemId) return { observations: [], apuCorrections: [], skipReasons: ["MISSING_CANONICAL_ITEM"] };
    return { observations: [{ canonicalItemId: input.canonicalItemId, value: input.comparison.documentValue, unit: input.comparison.unit, scope: "PROJECT", companyId: input.companyId, projectId: input.projectId, sourceId: input.sourceId, evidenceId: input.evidenceId, observedAt: input.observedAt, confidence: input.confidence, idempotencyKey: `review-yield:${input.decisionId}` }], apuCorrections: [], skipReasons: [] };
  }
  if (input.findingType === "PRICE_MISMATCH") {
    if (!input.resourceId) return { observations: [], apuCorrections: [], skipReasons: ["MISSING_CANONICAL_RESOURCE"] };
    return { observations: [{ resourceId: input.resourceId, value: input.comparison.documentValue, unit: input.comparison.unit, currency: input.comparison.currency ?? "PEN", scope: "PROJECT", companyId: input.companyId, projectId: input.projectId, sourceId: input.sourceId, evidenceId: input.evidenceId, observedAt: input.observedAt, confidence: input.confidence, idempotencyKey: `review-price:${input.decisionId}` }], apuCorrections: [], skipReasons: [] };
  }
  return { observations: [], apuCorrections: [], skipReasons: ["FINDING_TYPE_NOT_OBSERVABLE"] };
}
