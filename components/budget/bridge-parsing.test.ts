import { describe, it, expect } from "vitest";
import { tryParseJsonFromRawText } from "@/lib/ai/bridge-parsing";

describe("tryParseJsonFromRawText", () => {
  // --- Camino 1: JSON directo ---
  it("parsea JSON directo correctamente", () => {
    const input = `{"findings":[{"type":"observation","description":"Test"}],"summary":"OK"}`;
    const result = tryParseJsonFromRawText(input);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("findings");
    expect(result).toHaveProperty("summary");
    expect(result!.summary).toBe("OK");
  });

  it("parsea JSON directo con anidamiento simple", () => {
    const input = `{"name":"Test","value":42,"active":true}`;
    const result = tryParseJsonFromRawText(input);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Test");
    expect(result!.value).toBe(42);
    expect(result!.active).toBe(true);
  });

  it("retorna null para texto sin JSON", () => {
    const input = "Esto es solo texto sin estructura JSON";
    const result = tryParseJsonFromRawText(input);
    expect(result).toBeNull();
  });

  it("retorna null para string vacio", () => {
    const result = tryParseJsonFromRawText("");
    expect(result).toBeNull();
  });

  // --- Camino 2: JSON dentro de bloque markdown ```json ---
  it("extrae JSON desde bloque markdown etiquetado", () => {
    const input = `Texto explicativo previo...

\`\`\`json
{"findings":[{"type":"advertencia","description":"Revisar rendimiento"}],"summary":"Completo"}
\`\`\`

Texto posterior.`;
    const result = tryParseJsonFromRawText(input);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("findings");
    expect(result).toHaveProperty("summary");
    expect(result!.summary).toBe("Completo");
  });

  it("extrae JSON desde bloque markdown sin etiqueta de lenguaje", () => {
    const input = `Algo de contexto...

\`\`\`
{"data":{"key":"value"},"count":3}
\`\`\`

Fin.`;
    const result = tryParseJsonFromRawText(input);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(3);
    expect((result!.data as Record<string, unknown>).key).toBe("value");
  });

  it("extrae JSON desde bloque markdown con salto de linea inmediato", () => {
    const input = "```json\n{\"a\":1}\n```";
    const result = tryParseJsonFromRawText(input);
    expect(result).not.toBeNull();
    expect(result!.a).toBe(1);
  });

  // --- Camino 3: JSON incrustado en texto (sin markdown, sin parse directo) ---
  it("encuentra primer objeto JSON en texto plano", () => {
    // El texto no es JSON directo (tiene prefijo), y no tiene bloque markdown
    const input = "Respuesta de ChatGPT: {\"findings\":[],\"summary\":\"Sin observaciones\"} Fin del analisis.";
    const result = tryParseJsonFromRawText(input);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("findings");
    expect(result).toHaveProperty("summary");
    expect(result!.summary).toBe("Sin observaciones");
  });

  it("encuentra JSON anidado en texto plano (2 niveles)", () => {
    const input = `Output: {"status":"ok","details":{"count":5,"items":["a","b"]}} Done.`;
    const result = tryParseJsonFromRawText(input);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("ok");
    expect((result!.details as Record<string, unknown>).count).toBe(5);
  });

  it("retorna null si solo hay JSON array en texto", () => {
    // Los arrays no son records, deben retornar null
    const input = 'La respuesta es: ["a", "b", "c"]';
    const result = tryParseJsonFromRawText(input);
    expect(result).toBeNull();
  });

  it("retorna null si hay JSON array en bloque markdown", () => {
    const input = '```json\n["a", "b"]\n```';
    const result = tryParseJsonFromRawText(input);
    expect(result).toBeNull();
  });

  // --- Esquina: JSON valido pero con texto alrededor (camino 3 directamente) ---
  it("encuentra JSON con texto antes y despues sin markdown ni parse directo", () => {
    const input = "Paso 1: Cargar datos.\nPaso 2: {\"result\":\"exitoso\",\"score\":98}\nPaso 3: Finalizar.";
    const result = tryParseJsonFromRawText(input);
    expect(result).not.toBeNull();
    expect(result!.result).toBe("exitoso");
    expect(result!.score).toBe(98);
  });
});
