import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { buildChatMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { streamChatAiResponse } from "@/lib/ai/service";
import { aiChatRequestSchema } from "@/lib/ai/validation";
import { getDecryptedOpenaiApiKey, getDecryptedGeminiApiKey, getDecryptedOpenrouterApiKey, getAiProviderSettings } from "@/lib/data/settings";
import { getSystemSettings } from "@/lib/data/system-settings";

const encoder = new TextEncoder();
const STREAM_PREAMBLE = `: ${" ".repeat(2048)}\n\n`;

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiChatRequestSchema.parse(await request.json());
    const messages = buildChatMessages(data);

    // Inject user API keys for cloud provider streaming
    const streamInput: Parameters<typeof streamChatAiResponse>[0] = {
      messages,
      userId: session.user.id,
      provider: data.provider,
    };

    if (data.provider === "openai") {
      const [apiKey, settings, systemSettings] = await Promise.all([
        getDecryptedOpenaiApiKey(session.user.id),
        getAiProviderSettings(session.user.id),
        getSystemSettings(),
      ]);
      streamInput.apiKey = apiKey || systemSettings.openaiApiKey || undefined;
      streamInput.modelPreference = settings.openaiModel || systemSettings.openaiModel || undefined;
    } else if (data.provider === "gemini") {
      const [apiKey, settings, systemSettings] = await Promise.all([
        getDecryptedGeminiApiKey(session.user.id),
        getAiProviderSettings(session.user.id),
        getSystemSettings(),
      ]);
      streamInput.apiKey = apiKey || systemSettings.geminiApiKey || undefined;
      streamInput.modelPreference = settings.geminiModel || systemSettings.geminiModel || undefined;
    } else if (data.provider === "openrouter") {
      const [apiKey, settings, systemSettings] = await Promise.all([
        getDecryptedOpenrouterApiKey(session.user.id),
        getAiProviderSettings(session.user.id),
        getSystemSettings(),
      ]);
      streamInput.apiKey = apiKey || systemSettings.openrouterApiKey || undefined;
      streamInput.modelPreference = settings.openrouterModel || systemSettings.openrouterModel || undefined;
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          writePreamble(controller);

          for await (const event of streamChatAiResponse(streamInput)) {
            if (event.type === "delta") {
              writeEvent(controller, "delta", { text: event.text });
              continue;
            }

            const finalResult = await attachProjectHistoryEntry({
              action: "chat",
              context: data.context,
              projectId: data.projectId,
              result: event.result,
              summary: data.message,
              userId: session.user.id,
            });
            writeEvent(controller, "final", finalResult);
          }
        } catch (error) {
          writeEvent(controller, "error", {
            error: error instanceof Error ? error.message : "No se pudo completar la solicitud de IA.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}

function writePreamble(controller: ReadableStreamDefaultController<Uint8Array>) {
  controller.enqueue(encoder.encode(STREAM_PREAMBLE));
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}
