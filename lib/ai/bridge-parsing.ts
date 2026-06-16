import type { AiEndpointResult } from "@/lib/ai/types";

export type MYCBridgeResponse = {
  requestId?: string;
  raw?: string;
  jsonValid?: boolean;
  json?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function tryParseJsonFromRawText(text: string): Record<string, unknown> | null {
  // Intento 1: parsear directamente
  try {
    const parsed = JSON.parse(text);
    if (isRecord(parsed)) return parsed;
  } catch {
    // No es JSON directo
  }

  // Intento 2: extraer desde bloque markdown ```json ... ```
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (isRecord(parsed)) return parsed;
    } catch {
      // No es JSON dentro del bloque
    }
  }

  // Intento 3: buscar el primer objeto JSON {} en el texto
  const objectMatch = text.match(/\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (isRecord(parsed)) return parsed;
    } catch {
      // No se pudo extraer JSON
    }
  }

  return null;
}

export function normalizeBridgeReviewData(data: Record<string, unknown>): Record<string, unknown> {
  // Mapear critical_findings -> findings para el formato AiReviewStructuredData
  const normalized: Record<string, unknown> = { ...data };

  if (!Array.isArray(normalized.findings) && Array.isArray(data.critical_findings)) {
    normalized.findings = data.critical_findings
      .filter((f: unknown): f is Record<string, unknown> => isRecord(f))
      .map((finding) => ({
        severity: resolveFindingSeverity(finding),
        type: resolveFindingType(finding),
        description: typeof finding.description === "string" ? finding.description : "",
        impact: buildFindingImpact(finding),
        recommendedAction: typeof finding.recommended_review === "string" ? finding.recommended_review : "",
      }));
  }

  // Extraer assumptions desde technical_observations o recommendations
  if (!Array.isArray(normalized.assumptions)) {
    const sources = [
      ...(Array.isArray(data.technical_observations) ? data.technical_observations : []),
      ...(Array.isArray(data.recommendations) ? data.recommendations : []),
    ];
    normalized.assumptions = sources.filter((s: unknown): s is string => typeof s === "string");
  }

  return normalized;
}

function resolveFindingSeverity(finding: Record<string, unknown>): "low" | "medium" | "high" {
  if (typeof finding.severity === "string") {
    const s = finding.severity.toLowerCase();
    if (s === "low" || s === "medium" || s === "high") return s;
  }
  return "medium";
}

function resolveFindingType(finding: Record<string, unknown>): string {
  if (typeof finding.type === "string") return finding.type;
  return "other";
}

function buildFindingImpact(finding: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof finding.impact === "string") parts.push(finding.impact);
  if (Array.isArray(finding.items) && finding.items.length > 0) {
    parts.push(
      finding.items.length === 1 ? "1 partida afectada" : `${finding.items.length} partidas afectadas`,
    );
  }
  return parts.length > 0 ? parts.join(" | ") : "Requiere revision";
}

export function readBridgeAiResult(response: MYCBridgeResponse): AiEndpointResult {
  const warnings: string[] = [];
  let structuredData = response.jsonValid ? response.json : undefined;
  let answer = response.raw ?? "ChatGPT Bridge devolvió una respuesta sin contenido legible.";

  // Si la extensión no marcó el JSON como válido, intentamos parsear el texto crudo
  if (!response.jsonValid && response.raw) {
    const parsed = tryParseJsonFromRawText(response.raw);
    if (parsed) {
      structuredData = parsed;
      if (typeof parsed.answer === "string") {
        answer = parsed.answer;
      }
      warnings.push("JSON estructurado extraído desde la respuesta de ChatGPT.");
    }
  }

  // Normalizar structuredData al formato AiReviewStructuredData (ChatGPT usa critical_findings en vez de findings)
  if (isRecord(structuredData)) {
    structuredData = normalizeBridgeReviewData(structuredData);
  }

  // Si hay structuredData con answer, usarlo como fuente principal
  if (isRecord(structuredData) && typeof structuredData.answer === "string") {
    answer = structuredData.answer;
  }

  return {
    answer,
    model: "ChatGPT Bridge",
    requestedModel: "ChatGPT web",
    fallbackUsed: false,
    warnings,
    structuredData,
  };
}
