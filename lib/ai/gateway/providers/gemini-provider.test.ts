import { describe, expect, it, vi } from "vitest";
import { executeGeminiProvider, parseGeminiResponseText } from "@/lib/ai/gateway/providers/gemini-provider";

describe("Gemini gateway provider", () => {
  it("maps generateContent candidates into the shared provider result", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Analisis largo" }],
              },
            },
          ],
          usageMetadata: {
            totalTokenCount: 33,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await executeGeminiProvider({
      task: "montecarlo_risk_analysis",
      messages: [{ role: "user", content: "Analiza riesgo" }],
      fetchImpl: fetchMock,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("key=test-key");
    expect(result).toMatchObject({
      answer: "Analisis largo",
      provider: "gemini",
      model: "gemini-2.5-flash",
      requestedModel: "gemini-2.5-flash",
      fallbackUsed: false,
      warnings: [],
    });
  });

  it("does not expose API keys when Gemini returns an error", async () => {
    vi.stubEnv("GEMINI_API_KEY", "secret-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Bad request" } }), { status: 400 }));

    await expect(
      executeGeminiProvider({
        task: "chat",
        messages: [{ role: "user", content: "Hola" }],
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("Gemini respondio con estado 400");
  });

  it("parses Gemini text parts", () => {
    expect(
      parseGeminiResponseText({
        candidates: [
          {
            content: {
              parts: [{ text: "Texto Gemini" }],
            },
          },
        ],
      }),
    ).toBe("Texto Gemini");
  });
});
