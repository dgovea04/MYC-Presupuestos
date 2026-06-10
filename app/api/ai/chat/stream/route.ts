import { attachProjectHistoryEntry } from "@/lib/ai/project-history-route";
import { buildChatMessages } from "@/lib/ai/prompts";
import { withAiRoute } from "@/lib/ai/route-handler";
import { streamChatAiResponse } from "@/lib/ai/service";
import { aiChatRequestSchema } from "@/lib/ai/validation";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiChatRequestSchema.parse(await request.json());
    const messages = buildChatMessages(data);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of streamChatAiResponse({
            messages,
            userId: session.user.id,
          })) {
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
      },
    });
  });
}

function writeEvent(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}
