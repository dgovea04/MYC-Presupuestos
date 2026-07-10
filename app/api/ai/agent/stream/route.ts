import { withAiRoute } from "@/lib/ai/route-handler";
import { aiAgentRequestSchema } from "@/lib/ai/agent/validation";
import { streamAgentChat } from "@/lib/ai/gateway/providers/agent-provider";
import { getDecryptedOpenrouterApiKey, getAiProviderSettings } from "@/lib/data/settings";

const encoder = new TextEncoder();
const STREAM_PREAMBLE = `: ${" ".repeat(2048)}\n\n`;

/** Tipos de eventos SSE que emite este endpoint. */
type AgentStreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_result"; toolName: string; success: boolean; summary: string; latencyMs: number }
  | { type: "approval_required"; toolName: string; reason: string }
  | { type: "final"; answer: string; warnings: string[]; latencyMs: number }
  | { type: "error"; message: string };

/**
 * POST /api/ai/agent/stream
 *
 * Streaming SSE del agente Khipu. Emite eventos en tiempo real
 * para que el frontend actualice los 3 paneles del AgentWorkspace
 * (Chat, Plan de Ejecución, Herramientas/Aprobaciones/Actividad).
 *
 * Eventos emitidos:
 *   delta           — texto incremental para el chat
 *   tool_start      — una herramienta empezó a ejecutarse
 *   tool_result     — resultado de una herramienta (éxito/fallo)
 *   approval_required — se requiere aprobación humana
 *   final           — ejecución completada
 *   error           — error durante la ejecución
 */
export async function POST(request: Request) {
  return withAiRoute(async (session) => {
    const data = aiAgentRequestSchema.parse(await request.json());

    const systemPrompt = [
      "Eres Khipu, un asistente técnico de construcción y presupuestos de obra en Perú.",
      "Ayudas a ingenieros y contratistas con presupuestos, APU, cronogramas, metrados y reportes.",
      "Siempre usa herramientas cuando necesites datos concretos del proyecto.",
      "Responde en español, con tono profesional y técnico.",
    ].join("\n");

    // Resolver API key y modelo desde la configuración del usuario
    const settings = await getAiProviderSettings(session.user.id);
    const apiKey = await getDecryptedOpenrouterApiKey(session.user.id);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          writePreamble(controller);

          const toolLatencies = new Map<string, number>();

          for await (const event of streamAgentChat({
            task: "review_budget",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: data.message },
            ],
            userId: session.user.id,
            projectId: data.projectId,
            apiKey,
            modelPreference: settings.openrouterModel || undefined,
          })) {
            if (event.type === "delta") {
              const text = event.text;

              // Detectar inicio de herramienta: "🔧 Ejecutando <name>..."
              const toolStartMatch = text.match(/🔧\s*Ejecutando\s+(\w+)/);
              if (toolStartMatch) {
                const toolName = toolStartMatch[1];
                toolLatencies.set(toolName, Date.now());
                writeEvent(controller, "tool_start", { toolName });
              }

              // Detectar resultado: "  ✓ <summary>" o "  ✗ <summary>"
              const toolResultMatch = text.match(/^\s{2}([✓✗])\s+(.+)/m);
              if (toolResultMatch) {
                const success = toolResultMatch[1] === "✓";
                const summary = toolResultMatch[2].trim();
                // Buscar la última herramienta iniciada sin resultado
                const lastTool = [...toolLatencies.keys()].pop();
                if (lastTool) {
                  const startTime = toolLatencies.get(lastTool) ?? Date.now();
                  toolLatencies.delete(lastTool);
                  writeEvent(controller, "tool_result", {
                    toolName: lastTool,
                    success,
                    summary,
                    latencyMs: Date.now() - startTime,
                  });
                }
              }

              // Detectar aprobación: "⚠️ **Se requiere tu aprobación**"
              if (text.includes("Se requiere tu aprobación")) {
                const approvalMatch = text.match(/"(\w+)":\s*\n>\s*(.+)/);
                if (approvalMatch) {
                  writeEvent(controller, "approval_required", {
                    toolName: approvalMatch[1],
                    reason: approvalMatch[2].trim(),
                  });
                }
              }

              // Siempre emitir el delta de texto para el chat
              writeEvent(controller, "delta", { text });
            }

            if (event.type === "final") {
              writeEvent(controller, "final", {
                answer: event.result.answer,
                warnings: event.result.warnings ?? [],
                latencyMs: event.result.latencyMs,
              });
            }
          }
        } catch (error) {
          writeEvent(controller, "error", {
            message: error instanceof Error ? error.message : "Error inesperado del agente.",
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

function writeEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: string,
  data: unknown,
) {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}
