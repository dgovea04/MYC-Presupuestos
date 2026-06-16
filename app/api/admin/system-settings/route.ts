import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettingsInput,
} from "@/lib/data/system-settings";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const settings = await getSystemSettings();
    // Strip decrypted keys — never expose raw API keys in the response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { openaiApiKey: _openaiApiKey, geminiApiKey: _geminiApiKey, ...safeSettings } = settings;
    return NextResponse.json(safeSettings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al cargar configuración del sistema." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
    }

    const input: SystemSettingsInput = {
      openaiApiKey:
        typeof body.openaiApiKey === "string" && body.openaiApiKey.trim().length > 0
          ? body.openaiApiKey.trim()
          : typeof body.openaiApiKey === "string" && body.openaiApiKey.trim().length === 0
            ? ""
            : null,
      geminiApiKey:
        typeof body.geminiApiKey === "string" && body.geminiApiKey.trim().length > 0
          ? body.geminiApiKey.trim()
          : typeof body.geminiApiKey === "string" && body.geminiApiKey.trim().length === 0
            ? ""
            : null,
      openaiModel:
        typeof body.openaiModel === "string" && body.openaiModel.trim().length > 0
          ? body.openaiModel.trim()
          : null,
      geminiModel:
        typeof body.geminiModel === "string" && body.geminiModel.trim().length > 0
          ? body.geminiModel.trim()
          : null,
    };

    const settings = await updateSystemSettings(input);
    // Strip decrypted keys — never expose raw API keys in the response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { openaiApiKey: _openaiApiKey, geminiApiKey: _geminiApiKey, ...safeSettings } = settings;
    return NextResponse.json(safeSettings);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar configuración del sistema." },
      { status: 500 },
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
