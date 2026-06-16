#!/usr/bin/env python3
"""Replace readBridgeAiResult with an improved version that parses raw text as JSON."""

target_file = "components/budget/budget-editor.tsx"

with open(target_file, "r", encoding="utf-8") as f:
    content = f.read()

old_func = """function readBridgeAiResult(response: MYCBridgeResponse): AiEndpointResult {
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
}"""

new_func = """function readBridgeAiResult(response: MYCBridgeResponse): AiEndpointResult {
  const warnings: string[] = [];
  let structuredData = response.jsonValid ? response.json : undefined;
  let answer = response.raw ?? "ChatGPT Bridge devolvi\u00f3 una respuesta sin contenido legible.";

  // Si la extensi\u00f3n no marc\u00f3 el JSON como v\u00e1lido, intentamos parsear el texto crudo
  if (!response.jsonValid && response.raw) {
    const parsed = tryParseJsonFromRawText(response.raw);
    if (parsed) {
      structuredData = parsed;
      if (typeof parsed.answer === "string") {
        answer = parsed.answer;
      }
      warnings.push("JSON estructurado extra\u00eddo desde la respuesta de ChatGPT.");
    }
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
}"""

if old_func in content:
    content = content.replace(old_func, new_func)
    with open(target_file, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: readBridgeAiResult updated with fallback JSON parsing")
else:
    print("ERROR: Could not find old function text")
    # Debug: show the function definition area
    import re
    matches = list(re.finditer(r'function readBridgeAiResult', content))
    print(f"Found {len(matches)} occurrences of 'function readBridgeAiResult'")
    for m in matches:
        start = m.start()
        end = content.find("function tryParseJsonFromRawText", start)
        if end == -1:
            end = content.find("type MYCBridgeResponse", start)
        if end == -1:
            end = start + 2000
        print(f"  at position {start}:")
        print(content[start:end][:500])
