import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, Bot, ShieldCheck, Users } from "lucide-react";
import { AdminAuditLog } from "@/components/admin/admin-audit-log";
import { AdminAuditRetentionControl } from "@/components/admin/admin-audit-retention-control";
import { AdminBulkUserActions } from "@/components/admin/admin-bulk-user-actions";
import { AdminDeletionApprovals } from "@/components/admin/admin-deletion-approvals";
import { AdminSecurityOverview } from "@/components/admin/admin-security-overview";
import { AdminMarketingAnalytics } from "@/components/admin/admin-marketing-analytics";
import { AdminMarketingReconciliation } from "@/components/admin/admin-marketing-reconciliation";
import { AdminMarketingHealth } from "@/components/admin/admin-marketing-health";
import { AdminMarketingAlerts } from "@/components/admin/admin-marketing-alerts";
import { AdminMarketingMonetization } from "@/components/admin/admin-marketing-monetization";
import { AdminBetaApplications } from "@/components/admin/admin-beta-applications";
import { AdminBetaCampaigns } from "@/components/admin/admin-beta-campaigns";
import { AdminPageTabs, normalizeAdminTab } from "@/components/admin/admin-page-tabs";
import { AdminCloudAiSettings } from "@/components/admin/admin-cloud-ai-settings";
import { AdminMfaSettings } from "@/components/admin/admin-mfa-settings";
import { AdminUserAccessForm } from "@/components/admin/admin-user-access-form";
import { ManualPaymentRequests } from "@/components/admin/manual-payment-requests";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompactStatCard } from "@/components/ui/compact-stat-card";
import { OperationalPanel, OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import { hasAdminCapability } from "@/lib/auth/admin-permissions";
import { requireAdminSession } from "@/lib/auth/session";
import {
  getAdminDashboardStats,
  normalizeAdminUserPage,
  normalizeAdminUserQuery,
} from "@/lib/data/admin-dashboard";
import {
  listAdminAuditLogs,
  normalizeAdminAuditAction,
  normalizeAdminAuditPage,
  normalizeAdminAuditQuery,
} from "@/lib/data/admin-audit";
import { getUserSettings } from "@/lib/data/settings";
import { listPendingAdminDeletionApprovals, listScheduledAdminDeletions } from "@/lib/data/admin-deletion-approvals";
import { getAdminSecurityOverview } from "@/lib/data/admin-security";
import { getAdminMarketingAnalytics, normalizeAdminMarketingDateRange } from "@/lib/data/admin-marketing-analytics";
import { getAdminMarketingReconciliation } from "@/lib/data/admin-marketing-reconciliation";
import { getAdminMarketingHealth } from "@/lib/data/admin-marketing-health";
import { buildMarketingAlerts } from "@/lib/data/admin-marketing-alerts";
import { getAdminMarketingMonetization } from "@/lib/data/admin-marketing-monetization";
import { getAdminBetaAnalytics } from "@/lib/data/admin-beta-analytics";
import { listBetaCampaigns } from "@/lib/beta/campaigns";
import { listBetaApplications } from "@/lib/beta/applications";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{
    plan?: string;
    role?: string;
    status?: string;
    q?: string;
    page?: string;
    auditQ?: string;
    auditAction?: string;
    auditPage?: string;
    marketingFrom?: string;
    marketingTo?: string;
    betaCampaignId?: string;
    betaDuration?: string;
    adminTab?: string;
  }>;
}) {
  const session = await requireAdminSession();

  if (!session) {
    redirect("/dashboard");
  }

  const canManageAccess = hasAdminCapability(session.user, "users.manage_access");
  const canManageLifecycle = hasAdminCapability(session.user, "users.manage_lifecycle");
  const canImpersonate = hasAdminCapability(session.user, "users.impersonate");
  const canApproveDeletion = hasAdminCapability(session.user, "users.approve_deletion");
  const canManageDeletionGracePeriod = hasAdminCapability(session.user, "users.delete_permanently");
  const canRevokeSessions = hasAdminCapability(session.user, "users.revoke_sessions");
  const canVerifyEmail = hasAdminCapability(session.user, "users.verify_email");
  const canManageAuditRetention = hasAdminCapability(session.user, "audit.manage_retention");
  const resolvedSearchParams = (await searchParams) ?? {};
  const roleFilter: "ADMIN" | "USER" | undefined =
    resolvedSearchParams.role === "ADMIN" || resolvedSearchParams.role === "USER"
      ? resolvedSearchParams.role
      : undefined;
  const statusFilter: "ACTIVE" | "SUSPENDED" | undefined =
    resolvedSearchParams.status === "ACTIVE" || resolvedSearchParams.status === "SUSPENDED"
      ? resolvedSearchParams.status
      : undefined;
  const filters = {
    plan: resolvedSearchParams.plan || undefined,
    role: roleFilter,
    status: statusFilter,
    query: normalizeAdminUserQuery(resolvedSearchParams.q),
    page: normalizeAdminUserPage(Number(resolvedSearchParams.page ?? "1")),
  };
  const auditFilters = {
    query: normalizeAdminAuditQuery(resolvedSearchParams.auditQ),
    action: normalizeAdminAuditAction(resolvedSearchParams.auditAction),
    page: normalizeAdminAuditPage(Number(resolvedSearchParams.auditPage ?? "1")),
  };
  const marketingRange = normalizeAdminMarketingDateRange(resolvedSearchParams.marketingFrom, resolvedSearchParams.marketingTo);
  const adminTab = normalizeAdminTab(resolvedSearchParams.adminTab);
  const betaCampaignId = resolvedSearchParams.betaCampaignId || undefined;
  const betaDuration: 60 | 90 | undefined = resolvedSearchParams.betaDuration === "60" || resolvedSearchParams.betaDuration === "90"
    ? Number(resolvedSearchParams.betaDuration) as 60 | 90
    : undefined;
  const [settings, stats, auditLogs, deletionApprovals, scheduledDeletions, securityOverview, marketingAnalytics, marketingReconciliation, marketingHealth, marketingMonetization] = await Promise.all([
    getUserSettings(session.user.id),
    getAdminDashboardStats(filters),
    listAdminAuditLogs(auditFilters),
    listPendingAdminDeletionApprovals(),
    listScheduledAdminDeletions(),
    getAdminSecurityOverview(),
    getAdminMarketingAnalytics(marketingRange),
    getAdminMarketingReconciliation(marketingRange),
    getAdminMarketingHealth(marketingRange),
    getAdminMarketingMonetization(marketingRange),
  ]);
  const betaData = adminTab === "beta"
    ? await Promise.all([
        listBetaCampaigns(),
        getAdminBetaAnalytics(marketingRange, betaCampaignId, betaDuration),
        listBetaApplications(),
      ])
    : null;
  const canManageBeta = hasAdminCapability(session.user, "beta.manage");
  const canExportBeta = hasAdminCapability(session.user, "beta.export");

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <div className="space-y-4">
        <div>
          <p className="theme-strong-text text-2xl font-semibold tracking-tight">Administración</p>
          <p className="theme-muted-text mt-1 text-sm">Gestiona adquisición, producto, usuarios, facturación y seguridad desde un solo lugar.</p>
        </div>
        <AdminPageTabs
          activeTab={adminTab}
          marketingFrom={resolvedSearchParams.marketingFrom}
          marketingTo={resolvedSearchParams.marketingTo}
        />
      </div>

      {adminTab === "analytics" ? (
        <>
          <AdminMarketingAnalytics analytics={marketingAnalytics} range={marketingRange} />
          <AdminMarketingMonetization monetization={marketingMonetization} />
          <AdminMarketingReconciliation reconciliation={marketingReconciliation} />
          <AdminMarketingHealth health={marketingHealth} />
          <AdminMarketingAlerts alerts={buildMarketingAlerts({ reconciliation: marketingReconciliation, health: marketingHealth })} />
        </>
      ) : null}

      {adminTab === "beta" && betaData ? (
        <>
          <AdminBetaApplications
            applications={betaData[2]}
            canReview={Boolean(session.user.isSuperAdmin || session.user.adminProfile === "SUPER_ADMIN")}
          />
          <AdminBetaCampaigns
          campaigns={betaData[0].campaigns}
          analytics={betaData[1]}
          canManage={canManageBeta}
          canExport={canExportBeta}
          selectedCampaignId={betaCampaignId}
          selectedDuration={betaDuration}
          marketingFrom={resolvedSearchParams.marketingFrom}
          marketingTo={resolvedSearchParams.marketingTo}
          />
        </>
      ) : null}

      {adminTab === "users" || adminTab === "ai" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {adminTab === "users" ? (
            <>
              <AdminStatCard title="Usuarios" value={String(stats.metrics.totalUsers)} description="Cuentas registradas filtradas." icon={<Users className="h-5 w-5" />} />
              <AdminStatCard title="Activos" value={String(stats.metrics.activeUsers)} description={`${stats.metrics.suspendedUsers} usuarios suspendidos.`} icon={<ShieldCheck className="h-5 w-5" />} />
            </>
          ) : null}
          {adminTab === "ai" ? (
            <>
              <AdminStatCard title="Tokens IA del mes" value={formatTokenCount(stats.metrics.monthlyConsumedTokens)} description="Consumo persistente del periodo actual." icon={<Bot className="h-5 w-5" />} />
              <AdminStatCard title="Solicitudes IA" value={String(stats.actionUsage.reduce((sum, item) => sum + item.requests, 0))} description="Agrupadas por accion IA." icon={<Activity className="h-5 w-5" />} />
            </>
          ) : null}
        </section>
      ) : null}

      {adminTab === "billing" || adminTab === "ai" ? (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          {adminTab === "billing" ? (
            <Card className="theme-surface-card">
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader title="Membresias" description="Distribucion de usuarios y cupos mensuales por plan." />
            <div className="grid gap-3">
              {stats.plans.map((plan) => (
                <Link
                  key={plan.slug}
                  href={`/admin?adminTab=billing&plan=${plan.slug}`}
                  scroll={false}
                  className="theme-surface-card rounded-2xl border px-4 py-3 transition hover:border-sky-300 hover:bg-[var(--app-primary-muted)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="theme-strong-text font-medium">{plan.name}</p>
                      <p className="theme-muted-text text-sm">{formatTokenCount(plan.monthlyTokenLimit)} tokens/mes</p>
                    </div>
                    <Badge className="theme-status-info theme-status-info-strong">{plan.usersCount} usuarios</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
            </Card>
          ) : null}

          {adminTab === "ai" ? (
            <Card className="theme-surface-card">
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader title="Uso IA por accion" description="Consumo mensual del ledger para chat, APU, revision y JSON." />
            {stats.actionUsage.length === 0 ? (
              <p className="theme-dashed-panel theme-muted-text rounded-2xl border px-4 py-6 text-sm">
                Aun no hay consumo IA registrado en este periodo.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {stats.actionUsage.map((entry) => (
                  <CompactStatCard
                    key={entry.action}
                    label={entry.action}
                    value={formatTokenCount(entry.tokens)}
                    tone="sky"
                  />
                ))}
              </div>
            )}
          </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {adminTab === "billing" ? (
        <section>
          <Card className="theme-surface-card">
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader
              title="Solicitudes Yape pendientes"
              description="Pagos manuales registrados por usuarios. Valida el comprobante antes de activar Pro."
            />
            <ManualPaymentRequests requests={stats.manualPaymentRequests} />
          </CardContent>
          </Card>
        </section>
      ) : null}

      {adminTab === "ai" ? (
        <section>
        {session.user.isSuperAdmin ? (
          <AdminCloudAiSettings />
        ) : (
          <Card className="theme-surface-card">
            <CardContent className="space-y-2 p-6">
              <OperationalSectionHeader
                title="Proveedores Cloud IA del sistema"
                description="La configuración de API keys y modelos queda reservada al administrador principal."
              />
              <p className="theme-muted-text text-sm">
                Puedes consultar el estado general, pero no modificar secretos ni modelos de la organización.
              </p>
            </CardContent>
          </Card>
        )}
      </section>
      ) : null}

      {adminTab === "security" ? (
        <>
          {session.user.isSuperAdmin ? (
            <section>
              <AdminMfaSettings />
            </section>
          ) : null}
          <section>
            <AdminSecurityOverview overview={securityOverview} />
          </section>

          <section>
            <AdminDeletionApprovals
              currentUserId={session.user.id}
              canApprove={canApproveDeletion}
              canManageGracePeriod={canManageDeletionGracePeriod}
              approvals={deletionApprovals}
              scheduledDeletions={scheduledDeletions}
            />
          </section>
        </>
      ) : null}

      {adminTab === "audit" ? (
        <>
          <section>
            <AdminAuditRetentionControl enabled={canManageAuditRetention} />
          </section>

          <section>
            <AdminAuditLog
              entries={auditLogs.entries}
              actions={auditLogs.actions}
              filters={auditLogs.filters}
              pagination={auditLogs.pagination}
              preservedFilters={filters}
            />
          </section>
        </>
      ) : null}

      {adminTab === "users" ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="theme-surface-card">
          <CardContent className="space-y-4 p-6">
            <OperationalPanel title="Usuarios" description="Busca y administra usuarios con filtros server-side, rol, estado, plan y cupo extra mensual." />
            <form action="/admin" method="get" className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="adminTab" value="users" />
              <input
                name="q"
                defaultValue={filters.query}
                placeholder="Buscar por nombre o correo..."
                aria-label="Buscar usuarios por nombre o correo"
                className="theme-surface-card theme-strong-text min-h-10 flex-1 rounded-xl border px-3 text-sm outline-none transition placeholder:text-[var(--app-text-muted)] focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              {filters.plan ? <input type="hidden" name="plan" value={filters.plan} /> : null}
              {filters.role ? <input type="hidden" name="role" value={filters.role} /> : null}
              {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
              <button type="submit" className="theme-filter-button-active min-h-10 rounded-xl border px-4 text-sm font-medium transition hover:brightness-95">
                Buscar
              </button>
              {filters.query ? (
                <Link href={buildAdminUsersHref({ ...filters, query: undefined, page: 1 })} className="theme-filter-button min-h-10 rounded-xl border px-4 py-2 text-center text-sm font-medium">
                  Limpiar
                </Link>
              ) : null}
            </form>
            <div className="flex flex-wrap gap-2">
              <FilterLink href={buildAdminUsersHref({ ...filters, page: 1, query: filters.query })} label="Todos" active={!filters.plan && !filters.role && !filters.status} />
              <FilterLink href={buildAdminUsersHref({ ...filters, status: "ACTIVE", role: undefined, page: 1 })} label="Activos" active={filters.status === "ACTIVE"} />
              <FilterLink href={buildAdminUsersHref({ ...filters, status: "SUSPENDED", role: undefined, page: 1 })} label="Suspendidos" active={filters.status === "SUSPENDED"} />
              <FilterLink href={buildAdminUsersHref({ ...filters, role: "ADMIN", status: undefined, page: 1 })} label="Admins" active={filters.role === "ADMIN"} />
            </div>
            <div className="theme-surface-card overflow-x-auto rounded-2xl border">
              <div className="min-w-[760px]">
                <div className="theme-muted-panel theme-muted-text grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">
                  <span>Usuario</span>
                  <span>Plan</span>
                  <span>Licencia</span>
                  <span>Estado</span>
                  <span>Tokens</span>
                  <span>Cupo</span>
                </div>
                {stats.users.length === 0 ? (
                  <p className="theme-muted-text border-t border-[var(--app-border-soft)] px-4 py-8 text-center text-sm">
                    No encontramos usuarios con estos filtros.
                  </p>
                ) : (
                  stats.users.map((user) => (
                    <div
                      key={user.id}
                      className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr] border-t border-[var(--app-border-soft)] px-4 py-3 text-sm text-[var(--app-text)]"
                    >
                      <div className="min-w-0">
                        <p className="theme-strong-text truncate font-medium">{user.name}</p>
                        <p className="theme-muted-text truncate text-xs">{user.email}</p>
                        <p className="theme-subtle-text truncate text-xs">{user.companyName}</p>
                      </div>
                      <span>{user.planName}</span>
                      <span>{formatBillingState(user.billingMode, user.billingStatus)}</span>
                      <span>{user.status === "ACTIVE" ? "Activo" : "Suspendido"}</span>
                      <span>{formatTokenCount(user.consumedTokens)}</span>
                      <span>{formatTokenCount(user.allowance)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <AdminBulkUserActions
              users={stats.users}
              currentUserId={session.user.id}
              canManageLifecycle={canManageLifecycle}
              canRevokeSessions={canRevokeSessions}
            />
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="theme-muted-text">
                Página {stats.pagination.page} de {stats.pagination.totalPages} · {stats.pagination.totalUsers} usuarios encontrados
              </p>
              {stats.pagination.totalPages > 1 ? (
                <nav aria-label="Paginación de usuarios" className="flex items-center gap-2">
                  {stats.pagination.page > 1 ? (
                    <Link
                      href={buildAdminUsersHref({ ...filters, page: stats.pagination.page - 1 })}
                      className="theme-filter-button rounded-xl border px-3 py-1.5 font-medium"
                    >
                      Anterior
                    </Link>
                  ) : null}
                  {stats.pagination.page < stats.pagination.totalPages ? (
                    <Link
                      href={buildAdminUsersHref({ ...filters, page: stats.pagination.page + 1 })}
                      className="theme-filter-button-active rounded-xl border px-3 py-1.5 font-medium"
                    >
                      Siguiente
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="theme-surface-card">
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader title="Gestion de acceso" description="Edita plan, rol, estado y tokens extra por usuario." />
            <AdminUserAccessForm
              currentUserId={session.user.id}
              isSuperAdmin={Boolean(session.user.isSuperAdmin)}
              canManageAccess={canManageAccess}
              canManageLifecycle={canManageLifecycle}
              canImpersonate={canImpersonate}
              canRevokeSessions={canRevokeSessions}
              canVerifyEmail={canVerifyEmail}
              plans={stats.plans}
              users={stats.users}
            />
          </CardContent>
        </Card>
        </section>
      ) : null}
    </AppShell>
  );
}

function buildAdminUsersHref(filters: {
  plan?: string;
  role?: "ADMIN" | "USER";
  status?: "ACTIVE" | "SUSPENDED";
  query?: string;
  page?: number;
}) {
  const params = new URLSearchParams();

  params.set("adminTab", "users");
  if (filters.query) params.set("q", filters.query);
  if (filters.plan) params.set("plan", filters.plan);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function formatBillingState(mode: string, status: string | null) {
  if (mode === "MANUAL") return "Manual";
  if (mode === "STRIPE") return status ? `Stripe ${status.toLowerCase()}` : "Stripe pendiente";
  return "Gratis";
}

function AdminStatCard({
  description,
  icon,
  title,
  value,
}: {
  description: string;
  icon: ReactNode;
  title: string;
  value: string;
}) {
  return (
    <Card className="theme-surface-card shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div>
          <p className="theme-muted-text text-sm">{title}</p>
          <p className="theme-strong-text mt-2 text-3xl font-semibold">{value}</p>
          <p className="theme-muted-text mt-2 text-sm">{description}</p>
        </div>
        <span className="theme-filter-button-active inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function FilterLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active ? "theme-status-info theme-status-info-strong" : "theme-surface-card theme-muted-text hover:border-sky-300 hover:bg-[var(--app-primary-muted)]"
      }`}
    >
      {label}
    </Link>
  );
}

function formatTokenCount(value: number) {
  return new Intl.NumberFormat("es-PE", {
    maximumFractionDigits: 0,
  }).format(value);
}
