export type AiMessageRole = "system" | "user" | "assistant";

export type AiAction = "chat" | "apu" | "review" | "autocomplete" | "json";

export type { AiProviderId, ExecuteAiTaskInput, KhipuAiTask } from "@/lib/ai/gateway/types";
import type { AiProviderId, KhipuAiTask } from "@/lib/ai/gateway/types";

export type AiMessage = {
  role: AiMessageRole;
  content: string;
};

export type AiContext = {
  project?: string;
  module?: string;
  selectedItem?: string;
  unit?: string;
  currentCost?: number;
  activeTable?: string;
};

export type AiEndpointResult = {
  answer: string;
  model: string;
  requestedModel: string;
  fallbackUsed: boolean;
  warnings: string[];
  latencyMs?: number;
  structuredData?: unknown;
  provider?: Exclude<AiProviderId, "auto">;
  task?: KhipuAiTask;
  promptHash?: string;
  responseHash?: string;
  debug?: AiEndpointDebug;
};

export type AiEndpointDebug = {
  structuredParseStatus: "not_requested" | "parsed" | "repaired" | "failed";
  rawAnswer?: string;
  repairedRawAnswer?: string;
  /** Contexto del backend (budget summary, project info, etc.) */
  context?: unknown;
  /** Mensajes enviados al modelo */
  messages?: AiMessage[];
  /** Datos de la respuesta IA */
  ai?: {
    answer: string;
    rawAnswer?: string;
    repairedRawAnswer?: string;
    structuredParseStatus: AiEndpointDebug["structuredParseStatus"];
  };
  /** Información de fallback de modelo */
  fallback?: {
    used: boolean;
    reason?: string;
  };
  /** Advertencias de validación */
  validationWarnings?: string[];
  /** Request body crudo enviado a la API del proveedor */
  requestBody?: Record<string, unknown>;
};

export type AiStructuredLineItem = {
  description: string;
  unit: string;
  quantity: string;
  notes?: string;
};

export type AiApuCatalogResourceType = "MATERIAL" | "LABOR" | "EQUIPMENT" | "TOOLS" | "SUBCONTRACT";

export type AiApuCatalogProposalItem = {
  resource_id: string;
  name: string;
  type: AiApuCatalogResourceType;
  unit: string;
  quantity: number;
  source: "catalog";
  requires_review: boolean;
};

export type AiApuSuggestedNewResource = {
  type: "suggested_new_resource";
  reason: string;
  based_on: string;
};

export type AiApuCatalogProposal = {
  partida_name: string;
  unit: string;
  based_on_partida_id?: string;
  confidence: number;
  items: AiApuCatalogProposalItem[];
  suggested_new_resources: AiApuSuggestedNewResource[];
  warnings: string[];
  requires_human_review: boolean;
};

export type AiApuCatalogGenerationResult = {
  proposal: AiApuCatalogProposal;
  similar_partidas: Array<{
    id: string;
    description: string;
    unit: string;
    similarity: number;
    items: AiApuCatalogProposalItem[];
  }>;
  matching_resources: Array<{
    id: string;
    code: string;
    description: string;
    unit: string;
    category: AiApuCatalogResourceType;
  }>;
  warnings: string[];
  confidence: number;
  validation: {
    isValid: boolean;
    warnings: string[];
  };
  model: string;
  requestedModel: string;
  fallbackUsed: boolean;
  latencyMs?: number;
  debug?: AiApuCatalogDebug;
};

export type AiApuCatalogDebug = {
  enabled: true;
  context: unknown;
  messages: AiMessage[];
  ai: {
    answer: string;
    structuredData?: unknown;
    rawAnswer?: string;
    repairedRawAnswer?: string;
    structuredParseStatus: AiEndpointDebug["structuredParseStatus"];
  };
  fallback: {
    used: boolean;
    reason?: string;
    basePartidaId?: string;
    generatedItems: AiApuCatalogProposalItem[];
    similarPartidaSuggestions: Array<{
      id: string;
      description: string;
      unit: string;
      similarity: number;
      items: AiApuCatalogProposalItem[];
    }>;
  };
  validationWarnings: string[];
};

export type AiApuStructuredData = {
  answer: string;
  unit: string;
  performance: string;
  crew: string;
  materials: AiStructuredLineItem[];
  labor: AiStructuredLineItem[];
  equipment: AiStructuredLineItem[];
  observations: string[];
  assumptions: string[];
};

export type AiReviewFinding = {
  severity: "low" | "medium" | "high";
  type: "duplicate" | "unit" | "cost" | "quantity" | "consistency" | "other";
  description: string;
  impact: string;
  recommendedAction: string;
};

export type AiReviewStructuredData = {
  answer: string;
  findings: AiReviewFinding[];
  assumptions: string[];
};
