import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, Bot, ShieldCheck, Users } from "lucide-react";
import { AdminUserAccessForm } from "@/components/admin/admin-user-access-form";
import { ManualPaymentRequests } from "@/components/admin/manual-payment-requests";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CompactStatCard } from "@/components/ui/compact-stat-card";
import { OperationalPanel, OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminDashboardStats } from "@/lib/data/admin-dashboard";
import { getUserSettings } from "@/lib/data/settings";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string; role?: string; status?: string }>;
}) {
  const session = await requireAdminSession();

  if (!session) {
    redirect("/dashboard");
  }

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
  };
  const [settings, stats] = await Promise.all([
    getUserSettings(session.user.id),
    getAdminDashboardStats(filters),
  ]);

  return (
    <AppShell currentUser={session.user} settings={settings}>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard title="Usuarios" value={String(stats.metrics.totalUsers)} description="Cuentas registradas filtradas." icon={<Users className="h-5 w-5" />} />
        <AdminStatCard title="Activos" value={String(stats.metrics.activeUsers)} description={`${stats.metrics.suspendedUsers} usuarios suspendidos.`} icon={<ShieldCheck className="h-5 w-5" />} />
        <AdminStatCard title="Tokens IA del mes" value={formatTokenCount(stats.metrics.monthlyConsumedTokens)} description="Consumo persistente del periodo actual." icon={<Bot className="h-5 w-5" />} />
        <AdminStatCard title="Solicitudes IA" value={String(stats.actionUsage.reduce((sum, item) => sum + item.requests, 0))} description="Agrupadas por accion IA." icon={<Activity className="h-5 w-5" />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader title="Membresias" description="Distribucion de usuarios y cupos mensuales por plan." />
            <div className="grid gap-3">
              {stats.plans.map((plan) => (
                <Link
                  key={plan.slug}
                  href={`/admin?plan=${plan.slug}`}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-sky-300 hover:bg-sky-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{plan.name}</p>
                      <p className="text-sm text-slate-500">{formatTokenCount(plan.monthlyTokenLimit)} tokens/mes</p>
                    </div>
                    <Badge className="bg-sky-100 text-sky-700">{plan.usersCount} usuarios</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader title="Uso IA por accion" description="Consumo mensual del ledger para chat, APU, revision y JSON." />
            {stats.actionUsage.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
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
      </section>

      <section>
        <Card>
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader
              title="Solicitudes Yape pendientes"
              description="Pagos manuales registrados por usuarios. Valida el comprobante antes de activar Pro."
            />
            <ManualPaymentRequests requests={stats.manualPaymentRequests} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <OperationalPanel title="Usuarios" description="Control operativo de rol, estado, plan y cupo extra mensual." />
            <div className="flex flex-wrap gap-2">
              <FilterLink href="/admin" label="Todos" active={!filters.plan && !filters.role && !filters.status} />
              <FilterLink href="/admin?status=ACTIVE" label="Activos" active={filters.status === "ACTIVE"} />
              <FilterLink href="/admin?status=SUSPENDED" label="Suspendidos" active={filters.status === "SUSPENDED"} />
              <FilterLink href="/admin?role=ADMIN" label="Admins" active={filters.role === "ADMIN"} />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <span>Usuario</span>
                  <span>Plan</span>
                  <span>Licencia</span>
                  <span>Estado</span>
                  <span>Tokens</span>
                  <span>Cupo</span>
                </div>
                {stats.users.map((user) => (
                  <div
                    key={user.id}
                    className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.8fr_0.8fr] border-t border-slate-100 px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">{user.email}</p>
                      <p className="truncate text-xs text-slate-400">{user.companyName}</p>
                    </div>
                    <span>{user.planName}</span>
                    <span>{formatBillingState(user.billingMode, user.billingStatus)}</span>
                    <span>{user.status === "ACTIVE" ? "Activo" : "Suspendido"}</span>
                    <span>{formatTokenCount(user.consumedTokens)}</span>
                    <span>{formatTokenCount(user.allowance)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <OperationalSectionHeader title="Gestion de acceso" description="Edita plan, rol, estado y tokens extra por usuario." />
            <AdminUserAccessForm plans={stats.plans} users={stats.users} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
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
    <Card className="border-slate-200 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
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
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active ? "border-sky-200 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
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
