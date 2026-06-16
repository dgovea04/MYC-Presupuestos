import sys

target_file = "components/budget/budget-editor.tsx"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

# Check if already appended
if "function clearPendingBridgeTimeout" in content:
    print("Helpers already present, skipping.")
    sys.exit(0)

helpers = """

function clearPendingBridgeTimeout() {
  if (pendingBridgeTimeoutRef.current !== null) {
    window.clearTimeout(pendingBridgeTimeoutRef.current);
    pendingBridgeTimeoutRef.current = null;
  }
}

function readBridgeAiResult(response: MYCBridgeResponse): AiEndpointResult {
  const structuredData = response.jsonValid ? response.json : undefined;
  const answerFromJson = isRecord(response.json) && typeof response.json.answer === "string" ? response.json.answer : null;
  const answer = answerFromJson ?? response.raw ?? "ChatGPT Bridge devolvi\u00f3 una respuesta sin contenido legible.";
  const warnings = response.jsonValid === false ? ["La respuesta de ChatGPT Bridge no parece JSON v\u00e1lido."] : [];

  return {
    answer,
    model: "ChatGPT Bridge",
    requestedModel: "ChatGPT web",
    fallbackUsed: false,
    warnings,
    structuredData,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type MYCBridgeResponse = {
  requestId?: string;
  raw?: string;
  jsonValid?: boolean;
  json?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
};
"""

with open(target_file, "a", encoding="utf-8") as f:
    f.write(helpers)

print("Helpers appended successfully.")
