import { redirect } from "next/navigation";
import { WorkspaceProActivation } from "@/components/billing/workspace-pro-activation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthSession } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/data/settings";
import { prisma } from "@/lib/db/prisma";
import { getActiveWorkspaceId } from "@/lib/workspace/active-workspace";

export default async function BillingActivatePage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const session = await getAuthSession();
  if (!session?.user?.id) redirect("/login");

  const params = (await searchParams) ?? {};
  if (params.plan !== "pro") redirect("/dashboard");

  const workspaceId = await getActiveWorkspaceId(session.user.id);
  if (!workspaceId) redirect("/dashboard");

  const [settings, workspace, activeProSubscription] = await Promise.all([
    getUserSettings(session.user.id),
    prisma.company.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    prisma.companySubscription.findFirst({
      where: {
        companyId: workspaceId,
        membershipPlan: { slug: "pro" },
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      select: { id: true },
    }),
  ]);

  if (activeProSubscription) redirect("/dashboard");

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <div className="mx-auto max-w-3xl">
        <WorkspaceProActivation workspaceId={workspaceId} workspaceName={workspace?.name ?? "tu espacio de trabajo"} />
      </div>
    </AppShell>
  );
}
