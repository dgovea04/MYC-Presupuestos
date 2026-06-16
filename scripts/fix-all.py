with open("components/budget/budget-editor.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Export isRecord and fix to exclude arrays  
# Also inject normalizeBridgeReviewData + helpers before readBridgeAiResult
old1 = """function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBridgeAiResult"""

new1 = """export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeBridgeReviewData(data: Record<string, unknown>): Record<string, unknown> {
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
    parts.push(finding.items.length === 1 ? "1 partida afectada" : `${finding.items.length} partidas afectadas`);
  }
  return parts.length > 0 ? parts.join(" | ") : "Requiere revision";
}

function readBridgeAiResult"""

content = content.replace(old1, new1, 1)

# 2. Add normalization call in readBridgeAiResult before the final answer check
old2 = """  // Si hay structuredData con answer, usarlo como fuente principal
  if (isRecord(structuredData) && typeof structuredData.answer === "string") {
    answer = structuredData.answer;
  }"""

new2 = """  // Normalizar structuredData al formato AiReviewStructuredData (ChatGPT usa critical_findings en vez de findings)
  if (isRecord(structuredData)) {
    structuredData = normalizeBridgeReviewData(structuredData);
  }

  // Si hay structuredData con answer, usarlo como fuente principal
  if (isRecord(structuredData) && typeof structuredData.answer === "string") {
    answer = structuredData.answer;
  }"""

content = content.replace(old2, new2, 1)

# 3. Add tryParseJsonFromRawText function if missing, and export at end
has_fn = "function tryParseJsonFromRawText" in content

if not has_fn:
    # Add the function before the MYCBridgeResponse type at the end
    tryparse_fn = """
function tryParseJsonFromRawText(text: string): Record<string, unknown> | null {
  // Intento 1: parsear directamente
  try {
    const parsed = JSON.parse(text);
    if (isRecord(parsed)) return parsed;
  } catch {
    // No es JSON directo
  }

  // Intento 2: extraer desde bloque markdown ```json ... ```
  const jsonBlockMatch = text.match(/```(?:json)?\\s*\\n?([\\s\\S]*?)\\n?\\s*```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (isRecord(parsed)) return parsed;
    } catch {
      // No es JSON dentro del bloque
    }
  }

  // Intento 3: buscar el primer objeto JSON {} en el texto
  const objectMatch = text.match(/\\{(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*\\}/);
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

export { tryParseJsonFromRawText };
"""
    # Find the last type definition (MYCBridgeResponse) and add the function after it
    # The file ends with the MYCBridgeResponse type definition
    content = content.rstrip() + tryparse_fn
else:
    # Add export at end if not already there
    if "export { tryParseJsonFromRawText }" not in content:
        content = content.rstrip() + "\n\nexport { tryParseJsonFromRawText };\n"

with open("components/budget/budget-editor.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
