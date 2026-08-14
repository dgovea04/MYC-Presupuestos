import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { notifyPrimaryAdminSecurityEvent } from "@/lib/auth/admin-security-alert";
import { recordAdminAudit } from "@/lib/data/admin-audit";
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettingsInput,
} from "@/lib/data/system-settings";

export async function GET() {
  const session = await requireAdminSession("system_settings.read");
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
  const session = await requireAdminSession("system_settings.manage", request);
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
      agentModel: readOptionalModel(body.agentModel),
    };

    const settings = await updateSystemSettings(input);
    await recordAdminAudit({
      actorUserId: session.user.id,
      targetUserId: null,
      targetEmail: session.user.email ?? "sistema",
      action: "SYSTEM_SETTINGS_UPDATED",
      detail: "Configuracion de proveedores Cloud IA actualizada.",
      metadata: {
        openaiApiKeyChanged: typeof body.openaiApiKey === "string",
        geminiApiKeyChanged: typeof body.geminiApiKey === "string",
        openrouterApiKeyChanged: typeof body.openrouterApiKey === "string",
      },
      ...getAdminActionContext(request),
    });
    await notifyPrimaryAdminSecurityEvent({
      action: "SYSTEM_SETTINGS_UPDATED",
      actorEmail: session.user.email ?? session.user.id,
      detail: "Se actualizaron proveedores o modelos Cloud IA del sistema.",
    });
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

function getAdminActionContext(request: Request) {
  return {
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  };
}

function toSafeSystemSettings(settings: Awaited<ReturnType<typeof getSystemSettings>>) {
  return {
    openaiApiKeyMasked: settings.openaiApiKeyMasked,
    geminiApiKeyMasked: settings.geminiApiKeyMasked,
    openrouterApiKeyMasked: settings.openrouterApiKeyMasked,
    openaiModel: settings.openaiModel,
    geminiModel: settings.geminiModel,
    openrouterModel: settings.openrouterModel,
    agentModel: settings.agentModel,
    openaiConfigured: settings.openaiConfigured,
    geminiConfigured: settings.geminiConfigured,
    openrouterConfigured: settings.openrouterConfigured,
  };
}
