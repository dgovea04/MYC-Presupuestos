import { KnowledgeReviewPanel } from "@/components/admin/knowledge-review-panel";
import type { getKnowledgeAdminDashboard } from "@/lib/knowledge/admin-dashboard";

type KnowledgeAdminDashboard = Awaited<ReturnType<typeof getKnowledgeAdminDashboard>>;

export function KnowledgeAdminContent({ dashboard }: { dashboard: KnowledgeAdminDashboard }) {
  const { counts, queue } = dashboard;
  const cards = [
    ["Partidas", counts.items],
    ["Recursos", counts.resources],
    ["Precios", counts.prices],
    ["Rendimientos", counts.yields],
  ] as const;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="theme-surface-card rounded-2xl border p-5 shadow-sm">
            <p className="theme-muted-text text-sm">{label}</p>
            <p className="theme-strong-text mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="theme-surface-card rounded-2xl border p-5 shadow-sm">
          <p className="theme-muted-text text-sm">Review queue</p>
          <p className="theme-strong-text mt-2 text-2xl font-semibold">{queue.assertions.length}</p>
        </div>
        <div className="theme-surface-card rounded-2xl border p-5 shadow-sm">
          <p className="theme-muted-text text-sm">Observaciones recientes</p>
          <p className="theme-strong-text mt-2 text-2xl font-semibold">{queue.recentPrices.length + queue.recentYields.length}</p>
        </div>
        <div className="theme-surface-card rounded-2xl border p-5 shadow-sm">
          <p className="theme-muted-text text-sm">Errores de integracion</p>
          <p className="theme-strong-text mt-2 text-2xl font-semibold">{queue.integrationErrors.length}</p>
        </div>
      </section>
      <KnowledgeReviewPanel
        items={dashboard.recentItems}
        resources={dashboard.recentResources}
        assertions={queue.assertions}
        promotionCandidates={queue.promotionCandidates}
        prices={queue.recentPrices}
        yields={queue.recentYields}
        evidence={dashboard.evidence}
        conflicts={dashboard.conflicts}
        integrationErrors={queue.integrationErrors}
      />
    </div>
  );
}
