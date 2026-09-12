import { KnowledgeReviewPanel } from "@/components/admin/knowledge-review-panel";
import type { getKnowledgeAdminDashboard } from "@/lib/knowledge/admin-dashboard";

type KnowledgeAdminDashboard = Awaited<ReturnType<typeof getKnowledgeAdminDashboard>>;
type ImportReview = NonNullable<KnowledgeAdminDashboard["importLearning"]>;

type ImportAssertion = ImportReview["assertions"][number];

export function KnowledgeAdminContent({ dashboard }: { dashboard: KnowledgeAdminDashboard }) {
  const { counts, queue, importLearning } = dashboard;
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
      {importLearning ? <ImportLearningSummary review={importLearning} /> : null}
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

function ImportLearningSummary({ review }: { review: ImportReview }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="font-semibold">Revisión de import-learning</h2>
          <p className="theme-muted-text text-sm">Assertions extraídas de importaciones con fuente y evidencia conservadas.</p>
        </div>
        <p className="theme-muted-text text-sm">Página {review.pagination.page} de {review.pagination.totalPages} · {review.pagination.total} registros</p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[1fr_1.1fr_0.8fr_0.8fr_1.2fr] border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <span>Dominio</span><span>Predicate</span><span>Estado</span><span>Confianza</span><span>Provenance</span>
          </div>
          {review.assertions.map((row: ImportAssertion) => (
            <div key={row.id} className="grid grid-cols-[1fr_1.1fr_0.8fr_0.8fr_1.2fr] border-t border-slate-100 px-5 py-3 text-sm">
              <span>{row.subjectType.replace("IMPORT_", "")}</span>
              <span className="truncate">{row.predicate}</span>
              <span>{String(row.status)}</span>
              <span>{String(row.confidence)}</span>
              <span className="truncate">{row.source?.sourceType ?? "—"} · {row.evidence?.fileName ?? "sin archivo"}</span>
            </div>
          ))}
          {review.assertions.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">No hay assertions de import-learning para estos filtros.</p> : null}
        </div>
      </div>
    </section>
  );
}
