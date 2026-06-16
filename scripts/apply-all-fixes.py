with open("components/budget/budget-editor.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Export isRecord and fix to exclude arrays
content = content.replace(
    "function isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === \"object\" && value !== null;\n}\n\nfunction readBridgeAiResult",
    "export function isRecord(value: unknown): value is Record<string, unknown> {\n  return typeof value === \"object\" && value !== null && !Array.isArray(value);\n}\n\nfunction normalizeBridgeReviewData(data: Record<string, unknown>): Record<string, unknown> {\n  const normalized: Record<string, unknown> = { ...data };\n\n  // Mapear critical_findings -> findings para el formato AiReviewStructuredData\n  if (!Array.isArray(normalized.findings) && Array.isArray(data.critical_findings)) {\n    normalized.findings = data.critical_findings\n      .filter((f: unknown): f is Record<string, unknown> => isRecord(f))\n      .map((finding) => ({\n        severity: resolveFindingSeverity(finding),\n        type: resolveFindingType(finding),\n        description: typeof finding.description === \"string\" ? finding.description : \"\",\n        impact: buildFindingImpact(finding),\n        recommendedAction: typeof finding.recommended_review === \"string\" ? finding.recommended_review : \"\",\n      }));\n  }\n\n  // Extraer assumptions desde technical_observations o recommendations\n  if (!Array.isArray(normalized.assumptions)) {\n    const sources = [\n      ...(Array.isArray(data.technical_observations) ? data.technical_observations : []),\n      ...(Array.isArray(data.recommendations) ? data.recommendations : []),\n    ];\n    normalized.assumptions = sources.filter((s: unknown): s is string => typeof s === \"string\");\n  }\n\n  return normalized;\n}\n\nfunction resolveFindingSeverity(finding: Record<string, unknown>): \"low\" | \"medium\" | \"high\" {\n  if (typeof finding.severity === \"string\") {\n    const s = finding.severity.toLowerCase();\n    if (s === \"low\" || s === \"medium\" || s === \"high\") return s;\n  }\n  return \"medium\";\n}\n\nfunction resolveFindingType(finding: Record<string, unknown>): string {\n  if (typeof finding.type === \"string\") return finding.type;\n  return \"other\";\n}\n\nfunction buildFindingImpact(finding: Record<string, unknown>): string {\n  const parts: string[] = [];\n  if (typeof finding.impact === \"string\") parts.push(finding.impact);\n  if (Array.isArray(finding.items) && finding.items.length > 0) {\n    const itemStr = finding.items.length === 1\n      ? \"1 partida afectada\"\n      : `${finding.items.length} partidas afectadas`;\n    parts.push(itemStr);\n  }\n  return parts.length > 0 ? parts.join(\" | \") : \"Requiere revision\";\n}\n\nfunction readBridgeAiResult",
    1
)

# 2. Modify readBridgeAiResult to normalize data before final answer check
content = content.replace(
    "  // Si hay structuredData con answer, usarlo como fuente principal\n  if (isRecord(structuredData) && typeof structuredData.answer === \"string\") {\n    answer = structuredData.answer;\n  }",
    "  // Normalizar structuredData al formato AiReviewStructuredData si viene de ChatGPT\n  if (isRecord(structuredData)) {\n    structuredData = normalizeBridgeReviewData(structuredData);\n  }\n\n  // Si hay structuredData con answer, usarlo como fuente principal\n  if (isRecord(structuredData) && typeof structuredData.answer === \"string\") {\n    answer = structuredData.answer;\n  }",
    1
)

# 3. Add export { tryParseJsonFromRawText } before the last line (which is the closing brace of MYCBridgeResponse type)
# Find the end of the file - it ends with `};` for the MYCBridgeResponse type
content = content.rstrip() + "\n\nexport { tryParseJsonFromRawText };\n"

with open("components/budget/budget-editor.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
