import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import { getKnowledgeAdminDashboard } from "@/lib/knowledge/admin-dashboard";
import { isKnowledgeFeatureEnabled } from "@/lib/knowledge/feature-flags";
import { KnowledgeReviewPanel } from "@/components/admin/knowledge-review-panel";

export default async function KnowledgeAdminPage() {
  const session = await requireAdminSession("audit.read");
  if (!session) redirect("/dashboard");
  if (!isKnowledgeFeatureEnabled("adminReviewQueue")) redirect("/admin");
  const dashboard = await getKnowledgeAdminDashboard();
  const { counts, queue } = dashboard;
  const cards = [["Partidas", counts.items], ["Recursos", counts.resources], ["Precios", counts.prices], ["Rendimientos", counts.yields]] as const;
  return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900"><div className="mx-auto max-w-6xl space-y-8"><div><Link href="/admin" className="text-sm text-blue-700 hover:underline">Administración</Link><h1 className="mt-4 text-3xl font-semibold tracking-tight">MC Knowledge Perú</h1><p className="mt-2 text-slate-600">Revisión interna de entidades, observaciones, eventos y provenance.</p></div><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</section><section className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Review queue</p><p className="mt-2 text-2xl font-semibold">{queue.assertions.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Observaciones recientes</p><p className="mt-2 text-2xl font-semibold">{queue.recentPrices.length + queue.recentYields.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Errores de integración</p><p className="mt-2 text-2xl font-semibold">{queue.integrationErrors.length}</p></div></section><KnowledgeReviewPanel items={dashboard.recentItems} resources={dashboard.recentResources} assertions={queue.assertions} promotionCandidates={queue.promotionCandidates} prices={queue.recentPrices} yields={queue.recentYields} evidence={dashboard.evidence} conflicts={dashboard.conflicts} integrationErrors={queue.integrationErrors} /></div></main>;
}
