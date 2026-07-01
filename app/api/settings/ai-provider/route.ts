import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { getAiProviderSettings, updateAiProviderSettings, type AiProviderSettingsInput } from "@/lib/data/settings";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const settings = await getAiProviderSettings(session.user.id);
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al cargar configuración de IA." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
    }

    const input: AiProviderSettingsInput = {
      aiProviderPreference: readAiProviderPreference(body.aiProviderPreference),
      openaiApiKey: typeof body.openaiApiKey === "string" && body.openaiApiKey.trim().length > 0
        ? body.openaiApiKey.trim()
        : typeof body.openaiApiKey === "string" && body.openaiApiKey.trim().length === 0
          ? ""
          : null,
      geminiApiKey: typeof body.geminiApiKey === "string" && body.geminiApiKey.trim().length > 0
        ? body.geminiApiKey.trim()
        : typeof body.geminiApiKey === "string" && body.geminiApiKey.trim().length === 0
          ? ""
          : null,
      openrouterApiKey: typeof body.openrouterApiKey === "string" && body.openrouterApiKey.trim().length > 0
        ? body.openrouterApiKey.trim()
        : typeof body.openrouterApiKey === "string" && body.openrouterApiKey.trim().length === 0
          ? ""
          : null,
      openaiModel: typeof body.openaiModel === "string" && body.openaiModel.trim().length > 0
        ? body.openaiModel.trim()
        : null,
      geminiModel: typeof body.geminiModel === "string" && body.geminiModel.trim().length > 0
        ? body.geminiModel.trim()
        : null,
      openrouterModel: typeof body.openrouterModel === "string" && body.openrouterModel.trim().length > 0
        ? body.openrouterModel.trim()
        : null,
    };

    const settings = await updateAiProviderSettings(session.user.id, input);
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar configuración de IA." },
      { status: 500 },
    );
  }
}

function readAiProviderPreference(value: unknown): AiProviderSettingsInput["aiProviderPreference"] {
  if (typeof value === "string" && ["auto", "ollama", "chatgpt_bridge", "openai", "gemini", "openrouter"].includes(value)) {
    return value as AiProviderSettingsInput["aiProviderPreference"];
  }
  return "auto";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
