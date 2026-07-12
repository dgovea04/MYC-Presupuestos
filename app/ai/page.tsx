import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { KhipuWorkspace } from "@/components/ai/KhipuWorkspace";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getWorkspaceContextForUser } from "@/lib/workspace/context";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import { getUserSettings } from "@/lib/data/settings";

export default async function AIPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const settings = await getUserSettings(session.user.id);
  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const [license, workspaceCtx] = await Promise.all([
    getEffectiveWorkspaceLicense({ userId: session.user.id, companyId: activeWorkspaceId }),
    getWorkspaceContextForUser(session.user.id),
  ]);
  const canUseAssistant = hasFeatureAccess(license, "ai.local");
  const canUseAgent = hasFeatureAccess(license, "khipu.agent");

  if (!canUseAssistant && !canUseAgent) {
    return (
      <AppShell currentUser={session.user} settings={settings}>
        <UpgradeCTA
          title="Khipu disponible en Pro"
          description="Activa Khipu para chat tecnico, generacion de APU, revision de presupuesto y flujos agenticos con aprobaciones."
          benefits={[
            "Chat tecnico con contexto de obra",
            "Generacion y revision asistida de APU",
            "Agente con herramientas, simulacion y auditoria",
          ]}
        />
      </AppShell>
    );
  }

  const initialAction = readActionParam(readStringParam(resolvedSearchParams.action)) ?? "chat";
  const initialMode = readModeParam(readStringParam(resolvedSearchParams.mode));
  const selectedItem = readStringParam(resolvedSearchParams.selectedItem) ?? readStringParam(resolvedSearchParams.item);
  const unit = readStringParam(resolvedSearchParams.unit) ?? readStringParam(resolvedSearchParams.apuUnit);
  const initialContext = {
    project: readStringParam(resolvedSearchParams.project) ?? "Edificio Multifamiliar",
    module: readStringParam(resolvedSearchParams.module) ?? "APU",
    selectedItem: selectedItem ?? "Concreto f'c=210",
    unit: unit ?? "m3",
    currentCost: readNumericParam(readStringParam(resolvedSearchParams.currentCost)) ?? 420,
    activeTable: readStringParam(resolvedSearchParams.activeTable) ?? "Analisis de precios unitarios",
  };

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <KhipuWorkspace
        availableFeatures={license?.availableFeatures ?? []}
        initialMode={initialMode}
        initialAction={initialAction}
        initialContext={initialContext}
        initialChatMessage={readStringParam(resolvedSearchParams.message) ?? "Genera recomendaciones para revisar este APU."}
        initialApuDescription={readStringParam(resolvedSearchParams.description) ?? selectedItem ?? "Concreto armado f'c=210 kg/cm2 para columnas"}
        initialApuUnit={readStringParam(resolvedSearchParams.apuUnit) ?? unit ?? "m3"}
        initialReviewSummary={
          readStringParam(resolvedSearchParams.budgetSummary) ??
          "Partida 01.02 Concreto f'c=210 m3 S/ 420. Partida 01.03 Concreto f'c=210 m2 S/ 415."
        }
        initialAutocompleteInput={readStringParam(resolvedSearchParams.input) ?? "Excavacion manual en"}
        workspaceId={activeWorkspaceId ?? undefined}
        workspaceName={workspaceCtx?.workspace.name ?? undefined}
      />
    </AppShell>
  );
}

function readStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function readNumericParam(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readActionParam(value: string | undefined) {
  if (value === "chat" || value === "apu" || value === "review" || value === "autocomplete") {
    return value;
  }

  return undefined;
}

function readModeParam(value: string | undefined) {
  if (value === "assistant" || value === "agent" || value === "metrics") {
    return value;
  }

  return undefined;
}
