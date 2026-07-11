import { withAiRoute } from "@/lib/ai/route-handler";
import type { AiMessage } from "@/lib/ai/types";
import { aiAgentRequestSchema } from "@/lib/ai/agent/validation";
import { streamAgentChat } from "@/lib/ai/gateway/providers/agent-provider";
import { getDecryptedOpenrouterApiKey, getDecryptedGeminiApiKey, getAiProviderSettings } from "@/lib/data/settings";
import {
  getWorkflowTemplate,
  getBundleBySlug,
  getBundleSystemPrompt,
} from "@/lib/ai/agent/workflows";
import { getAgentModelProvider } from "@/lib/ai/agent/models";
import { prisma } from "@/lib/db/prisma";
import { createOllama } from "ollama-ai-provider-v2";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

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

    // ── Resolver contexto del workspace ────────────────────────────────────
    let workspaceName: string | null = null;
    if (data.workspaceId) {
      try {
        const company = await prisma.company.findUnique({
          where: { id: data.workspaceId },
          select: { name: true },
        });
        workspaceName = company?.name ?? null;
      } catch {
        // non-blocking
      }
    }

    // ── Resolver proyectos recientes del usuario ─────────────────────────
    let recentProjectsList = "";
    if (data.workspaceId) {
      try {
        const projects = await prisma.project.findMany({
          where: {
            companyId: data.workspaceId,
            company: {
              memberships: {
                some: {
                  userId: session.user.id,
                  status: "ACTIVE",
                },
              },
            },
          },
          select: {
            id: true,
            name: true,
            clientName: true,
            location: true,
            status: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 8,
        });

        if (projects.length > 0) {
          const projectLines = projects.map(
            (p) =>
              `  - "${p.name}" (ID: ${p.id})` +
              (p.clientName ? `, Cliente: ${p.clientName}` : "") +
              (p.location ? `, Ubicación: ${p.location}` : ""),
          );
          recentProjectsList = [
            "",
            "--- PROYECTOS DISPONIBLES ---",
            "Estos son los proyectos más recientes del usuario. USA SUS IDs directamente cuando necesites trabajar en un proyecto existente.",
            ...projectLines,
            "",
            `Total: ${projects.length} proyectos listados. Si el proyecto que busca el usuario no está aquí, indícale que no se encontró.`,
          ].join("\n");
        }
      } catch {
        // non-blocking
      }
    }

    // ── Resolver bundle y workflow prompts ─────────────────────────────────
    let workflowGuidance = "";
    if (data.workflowId) {
      const template = getWorkflowTemplate(data.workflowId);
      if (template) {
        const bundle = getBundleBySlug(template.bundleSlug);
        if (bundle) {
          workflowGuidance = [
            "",
            "--- ESPECIALIDAD ACTIVA ---",
            `Rol: ${bundle.name} — ${bundle.description}`,
            bundle.systemPrompt,
            "",
            "--- OBJETIVO DEL WORKFLOW ---",
            template.initialGoal,
          ].join("\n");
        }
      }
    }

    const systemPromptLines = [
      "Eres Khipu, un asistente técnico de construcción y presupuestos de obra en Perú.",
      "Ayudas a ingenieros y contratistas con presupuestos, APU, cronogramas, metrados y reportes.",
      "Siempre usa herramientas cuando necesites datos concretos del proyecto.",
    ];

    // Inyectar contexto del workspace activo si está disponible
    if (workspaceName && data.workspaceId) {
      systemPromptLines.push(
        "",
        "--- WORKSPACE ACTUAL ---",
        `Estás trabajando en la empresa "${workspaceName}" (ID: ${data.workspaceId}).`,
        "NO uses searchCompanies para preguntar al usuario qué empresa usar.",
        "Usa searchCompanies SOLO si necesitas listar TODAS las empresas del usuario (ej: para cambiar de empresa).",
        `Si el usuario pide crear un proyecto o presupuesto, usa directamente este companyId: "${data.workspaceId}".`,
      );
    }

    // Inyectar proyectos recientes en el prompt (para evitar searchProjects)
    if (recentProjectsList) {
      systemPromptLines.push(recentProjectsList);
    }

    // Inyectar guía del workflow/bundle si existe
    if (workflowGuidance) {
      systemPromptLines.push(workflowGuidance);
    }

    systemPromptLines.push(
      "",
      "Responde en español, con tono profesional y técnico.",
      "",
      "--- INSTRUCCIONES ---",
      "",
      "CREAR PROYECTO NUEVO:",
      "1. El usuario pide crear proyecto/presupuesto → si no está en la lista de PROYECTOS DISPONIBLES, pregúntale: ¿nuevo o existente?",
      "2. El usuario responde 'nuevo' (o similar) → pregúntale: ¿cuál es el nombre?",
      "3. El usuario da el nombre → LLAMA createProject({ name: elNombre }) INMEDIATAMENTE.",
      "   • No preguntes por location, clientName, projectType ni fechas (son opcionales).",
      "   • No pidas confirmación extra. El sistema ya maneja la aprobación.",
      "   • El companyId ya está configurado, no lo incluyas.",
      "",
      "PROYECTO EXISTENTE (BUSCAR EN LA LISTA DE ARRIBA):",
      "1. El usuario dice 'existente' (o similar) y da un nombre → BUSCA en la sección PROYECTOS DISPONIBLES (arriba) si el proyecto ya está listado.",
      "   • Los proyectos ya están listados con sus IDs. USA EL ID directamente, NO llames searchProjects.",
      "   • Ejemplo: si el usuario dice 'Santa Monica', revisa la lista de PROYECTOS DISPONIBLES. Si ves 'Santa Monica' ahí, usa su ID.",
      "2. Si el proyecto NO está en la lista de PROYECTOS DISPONIBLES, USA searchProjects({ query: nombreDelProyecto }) PARA BUSCARLO.",
      "   • PASA EL NOMBRE como query. NUNCA llames searchProjects sin query.",
      "3. searchProjects retorna resultados. ENCUENTRA el que coincide por nombre y usa su ID.",
      "4. Si el proyecto no se encuentra en los resultados, INFORMÁLE al usuario.",
      "",
      "GENERAR PRESUPUESTO:",
      "1. Cuando el usuario pide generar un presupuesto para un proyecto existente, USA generateBudget INMEDIATAMENTE.",
      "2. generateBudget requiere DOS parámetros OBLIGATORIOS:",
      "   • projectId: el ID del proyecto (SACADO de la lista PROYECTOS DISPONIBLES arriba). Ejemplo: 'proj-santa'.",
      "   • description: la descripción completa de la obra que el usuario proporcionó. Ejemplo: 'vivienda unifamiliar de 2 pisos, 120m2'.",
      "   EJEMPLO CORRECTO: generateBudget({ projectId: 'proj-santa', description: 'vivienda unifamiliar de 2 pisos, 120m2' })",
      "3. NO llames generateBudget sin projectId o sin description. Ambos son obligatorios.",
      "4. description debe tener al menos 10 caracteres. Si el usuario no dio suficiente detalle, usa el contexto completo.",
      "5. Los parámetros opcionales (templateType, templateSource, previewOnly) NO son necesarios.",
      "",
      "REGLAS IMPORTANTES:",
      "- NUNCA llames searchProjects() sin pasar el parámetro query con el nombre del proyecto.",
      "- Si el proyecto ya está en la lista de PROYECTOS DISPONIBLES, USA SU ID DIRECTO. No necesitas searchProjects.",
      "- NO uses searchBudgets para buscar proyectos. searchBudgets busca presupuestos dentro de un proyecto.",
      "- Si ya tienes la información que necesitas, responde al usuario en lugar de llamar más herramientas.",
      "- El sistema bloquea herramientas que se llaman más de 2 veces, así que úsalas con cuidado.",
      "",
      "CONSEJOS:",
      "- Puedes generar texto de forma natural mientras ejecutas herramientas.",
      "- Cuando tengas los datos necesarios, llama la herramienta sin demora.",
      "- No uses searchCompanies. Ya sabes cuál es la empresa del usuario.",
    );

    // ── Resolver modelo y provider desde la configuración del usuario ─────
    const settings = await getAiProviderSettings(session.user.id);
    const modelPreference = settings.openrouterModel || undefined;

    // ── Determinar provider y resolver API key ────────────────────────────
    const provider = modelPreference ? getAgentModelProvider(modelPreference) : undefined;

    let apiKey: string | undefined;
    let geminiApiKey: string | undefined;

    if (provider === "google") {
      geminiApiKey = await getDecryptedGeminiApiKey(session.user.id);
    } else if (provider !== "ollama") {
      apiKey = await getDecryptedOpenrouterApiKey(session.user.id);
    }

    // ── Sección extra para modelos locales (Ollama) ───────────────────────
    if (provider === "ollama") {
      systemPromptLines.push(
        "",
        "--- MODO LOCAL ---",
        "Eres un modelo local. Sé MÁS DIRECTO que un modelo cloud. NO preguntes, EJECUTA.",
        "El usuario espera acción inmediata. Si entiendes la intención, USA LA HERRAMIENTA YA.",
        "Ejemplo: si el usuario dice 'crear presupuesto para X', extrae X como nombre y crea el proyecto.",
      );
    }

    const systemPrompt = systemPromptLines.join("\n");

    // ── Construir LanguageModel según el provider del modelo ──────────────
    let prebuiltModel: unknown = undefined;

    if (provider === "google" && modelPreference && geminiApiKey) {
      const googleProvider = createGoogleGenerativeAI({ apiKey: geminiApiKey });
      // Extraer nombre del modelo: "google/gemini-2.5-flash-lite" → "gemini-2.5-flash-lite"
      const googleModelName = modelPreference.split("/").slice(1).join("/");
      prebuiltModel = googleProvider(googleModelName);
    } else if (provider === "ollama" && modelPreference) {
      // Usar Ollama local via ollama-ai-provider-v2 (especificación v2 del AI SDK)
      const ollamaConfig: { baseURL?: string } = {};
      if (process.env.OLLAMA_BASE_URL) {
        // El provider espera la URL completa incluyendo /api
        ollamaConfig.baseURL = `${process.env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api`;
      }
      const ollamaProvider = createOllama(ollamaConfig);
      // Extraer nombre del modelo: "ollama/llama3.1" → "llama3.1"
      const ollamaModelName = modelPreference.split("/").slice(1).join("/");
      prebuiltModel = ollamaProvider(ollamaModelName);
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          writePreamble(controller);

          const toolLatencies = new Map<string, number>();

          // Usar el historial completo si se provee (mantiene contexto entre turnos).
          // Si no hay historial, construir solo con el mensaje actual (compatibilidad).
          const conversationMessages: AiMessage[] = data.messages && data.messages.length > 0
            ? [
                { role: "system" as const, content: systemPrompt },
                ...data.messages.map((m) => ({
                  role: m.role as AiMessage["role"],
                  content: m.content,
                })),
              ]
            : [
                { role: "system" as const, content: systemPrompt },
                { role: "user" as const, content: data.message },
              ];

          for await (const event of streamAgentChat({
            task: "review_budget",
            messages: conversationMessages,
            userId: session.user.id,
            projectId: data.projectId,
            workspaceId: data.workspaceId,
            apiKey,
            modelPreference: modelPreference,
          }, prebuiltModel)) {
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
                const idMatch = text.match(/approval_id=([^\s]+)/);
                if (approvalMatch) {
                  writeEvent(controller, "approval_required", {
                    approvalId: idMatch?.[1] ?? "unknown",
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
