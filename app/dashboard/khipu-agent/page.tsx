import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AgentWorkspace } from "@/components/ai/AgentWorkspace";
import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { getAuthSession } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";
import { getEffectiveWorkspaceLicense, hasFeatureAccess } from "@/lib/workspace/entitlements";
import { getUserSettings } from "@/lib/data/settings";

export const metadata = {
  title: "Khipu Agent - MC Presupuestos",
  description: "Asistente técnico agéntico para presupuestos de obra.",
};

export default async function KhipuAgentPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const settings = await getUserSettings(session.user.id);
  const activeWorkspaceId = await getActiveWorkspaceId(session.user.id);
  const license = await getEffectiveWorkspaceLicense({
    userId: session.user.id,
    companyId: activeWorkspaceId,
  });

  if (!hasFeatureAccess(license, "khipu.agent")) {
    return (
      <AppShell currentUser={session.user} settings={settings}>
        <UpgradeCTA
          title="Khipu Agent disponible en Pro"
          description="El asistente agéntico planifica, ejecuta herramientas y pide aprobación antes de modificar tus presupuestos. Ideal para flujos de trabajo complejos."
          benefits={[
            "Ejecución de herramientas con plan de pasos",
            "Aprobaciones humanas para operaciones de escritura",
            "Auditoría completa de cada ejecución",
            "Catálogo de 30+ herramientas especializadas",
          ]}
        />
      </AppShell>
    );
  }

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <div className="p-4">
        <AgentWorkspace />
      </div>
    </AppShell>
  );
}
