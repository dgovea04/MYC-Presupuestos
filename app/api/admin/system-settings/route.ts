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
    return NextResponse.json(toSafeSystemSettings(settings));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al cargar configuracion del sistema." },
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
      return NextResponse.json({ error: "Cuerpo de solicitud invalido." }, { status: 400 });
    }

    const input: SystemSettingsInput = {
      openaiApiKey: readOptionalSecret(body.openaiApiKey),
      geminiApiKey: readOptionalSecret(body.geminiApiKey),
      openrouterApiKey: readOptionalSecret(body.openrouterApiKey),
      openaiModel: readOptionalModel(body.openaiModel),
      geminiModel: readOptionalModel(body.geminiModel),
      openrouterModel: readOptionalModel(body.openrouterModel),
    };

    const settings = await updateSystemSettings(input);
    return NextResponse.json(toSafeSystemSettings(settings));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar configuracion del sistema." },
      { status: 500 },
    );
  }
}

function readOptionalSecret(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function readOptionalModel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSafeSystemSettings(settings: Awaited<ReturnType<typeof getSystemSettings>>) {
  return {
    openaiApiKeyMasked: settings.openaiApiKeyMasked,
    geminiApiKeyMasked: settings.geminiApiKeyMasked,
    openrouterApiKeyMasked: settings.openrouterApiKeyMasked,
    openaiModel: settings.openaiModel,
    geminiModel: settings.geminiModel,
    openrouterModel: settings.openrouterModel,
    openaiConfigured: settings.openaiConfigured,
    geminiConfigured: settings.geminiConfigured,
    openrouterConfigured: settings.openrouterConfigured,
  };
}
