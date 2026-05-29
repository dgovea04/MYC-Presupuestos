import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AIWorkspace } from "@/components/ai/AIWorkspace";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveUserLicense, hasFeatureAccess } from "@/lib/billing/entitlements";
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
  const license = await getEffectiveUserLicense({ userId: session.user.id });
  if (!hasFeatureAccess(license, "ai.local")) {
    return (
      <AppShell currentUser={session.user} settings={settings}>
        <UpgradeCTA
          title="IA local disponible en Pro"
          description="Activa el copiloto tecnico para chat, generacion de APU, revision de presupuesto y autocompletado asistido."
        />
      </AppShell>
    );
  }

  const initialAction = readActionParam(readStringParam(resolvedSearchParams.action)) ?? "chat";
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
      <AIWorkspace
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
