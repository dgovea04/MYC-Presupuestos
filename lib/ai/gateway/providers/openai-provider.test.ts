import { describe, expect, it, vi } from "vitest";
import { executeOpenAIProvider, parseOpenAIResponseText } from "@/lib/ai/gateway/providers/openai-provider";

describe("OpenAI gateway provider", () => {
  it("maps Responses API output_text into the shared provider result", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: "Respuesta tecnica",
          model: "gpt-5-mini",
          usage: {
            total_tokens: 42,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await executeOpenAIProvider({
      task: "review_budget",
      messages: [{ role: "user", content: "Revisa presupuesto" }],
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
    expect(result).toMatchObject({
      answer: "Respuesta tecnica",
      provider: "openai",
      model: "gpt-5-mini",
      requestedModel: "gpt-5-mini",
      fallbackUsed: false,
      warnings: [],
    });
  });

  it("does not expose API keys when OpenAI returns an error", async () => {
    vi.stubEnv("OPENAI_API_KEY", "secret-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Bad request" } }), { status: 400 }));

    await expect(
      executeOpenAIProvider({
        task: "chat",
        messages: [{ role: "user", content: "Hola" }],
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("OpenAI respondio con estado 400");
  });

  it("parses nested Responses API text content", () => {
    expect(
      parseOpenAIResponseText({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: "Texto anidado",
              },
            ],
          },
        ],
      }),
    ).toBe("Texto anidado");
  });
});
