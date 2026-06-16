with open("components/budget/budget-editor.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Insert normalizeBridgeReviewData before readBridgeAiResult
old = """function readBridgeAiResult(response: MYCBridgeResponse): AiEndpointResult {"""

new = """function normalizeBridgeReviewData(data: Record<string, unknown>): Record<string, unknown> {
  // ChatGPT devuelve critical_findings en lugar de findings
  // Normalizamos al formato AiReviewStructuredData esperado por el dialogo
  const normalized: Record<string, unknown> = { ...data };

  // Mapear critical_findings -> findings
  if (!Array.isArray(normalized.findings) && Array.isArray(data.critical_findings)) {
    normalized.findings = data.critical_findings.map((finding: unknown) => {
      if (!isRecord(finding)) return finding;
      return {
        severity: resolveFindingSeverity(finding),
        type: resolveFindingType(finding),
        description: typeof finding.description === "string" ? finding.description : "",
        impact: buildFindingImpact(finding),
        recommendedAction: typeof finding.recommended_review === "string" ? finding.recommended_review : "",
      };
    });
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
  // Inferir severidad desde otros campos
  if (typeof finding.risk_level === "string") {
    const r = finding.risk_level.toLowerCase();
    if (r === "low" || r === "medium" || r === "high") return r;
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
    const itemStr = finding.items.length === 1
      ? "1 partida afectada"
      : `${finding.items.length} partidas afectadas`;
    parts.push(itemStr);
  }
  return parts.length > 0 ? parts.join(" | ") : "Requiere revision";
}

function readBridgeAiResult(response: MYCBridgeResponse): AiEndpointResult {"""

content = content.replace(old, new, 1)

# Modify readBridgeAiResult to normalize data BEFORE the final structuredData check
old2 = """  // Si hay structuredData con answer, usarlo como fuente principal
  if (isRecord(structuredData) && typeof structuredData.answer === "string") {
    answer = structuredData.answer;
  }"""

new2 = """  // Normalizar structuredData al formato AiReviewStructuredData si viene de ChatGPT
  if (isRecord(structuredData)) {
    structuredData = normalizeBridgeReviewData(structuredData);
  }

  // Si hay structuredData con answer, usarlo como fuente principal
  if (isRecord(structuredData) && typeof structuredData.answer === "string") {
    answer = structuredData.answer;
  }"""

content = content.replace(old2, new2, 1)

with open("components/budget/budget-editor.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
