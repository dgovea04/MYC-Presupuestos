export type PrivateLearningExampleStatus = "ACTIVE" | "REVOKED" | "EXPIRED";
export type PrivateLearningSignalType = "EVIDENCE_LINK" | "FINDING_RESOLVED" | "INTEGRATION_MAPPING" | "EXPLICIT_CORRECTION";
export interface JsonObject { [key: string]: string | number | boolean | null | JsonObject | JsonObject[]; }
export type PrivateLearningExampleView = { id: string; companyId: string; sourceType: string; sourceId: string; signalType: string; contentHash: string; schemaVersion: string; status: PrivateLearningExampleStatus; expiresAt: string; createdAt: string };
export type PrivateLearningSuggestion = PrivateLearningExampleView & { confidence: number; provenance: { sourceType: string; sourceId: string; createdAt: string }; exampleApplied: boolean };
