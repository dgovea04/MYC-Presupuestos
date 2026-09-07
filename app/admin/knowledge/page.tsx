import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { KnowledgeReviewPanel } from "@/components/admin/knowledge-review-panel";

export default async function KnowledgeAdminPage() {
  const session = await requireAdminSession("audit.read");
  if (!session) redirect("/dashboard");
  const [items, resources, prices, yields, recentItems, recentResources, events] = await Promise.all([
    prisma.canonicalItem.count(), prisma.canonicalResource.count(), prisma.priceObservation.count(), prisma.yieldObservation.count(),
    prisma.canonicalItem.findMany({ orderBy: { updatedAt: "desc" }, take: 20, include: { aliases: true } }),
    prisma.canonicalResource.findMany({ orderBy: { updatedAt: "desc" }, take: 20, include: { aliases: true } }),
    prisma.knowledgeEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25, select: { id: true, eventType: true, scope: true, entityType: true, entityId: true, createdAt: true } }),
  ]);
  const cards = [["Partidas", items], ["Recursos", resources], ["Precios", prices], ["Rendimientos", yields]] as const;
  return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900"><div className="mx-auto max-w-6xl space-y-8"><div><Link href="/admin" className="text-sm text-blue-700 hover:underline">← Administración</Link><h1 className="mt-4 text-3xl font-semibold tracking-tight">MC Knowledge Perú</h1><p className="mt-2 text-slate-600">Revisión interna de entidades, observaciones, eventos y provenance.</p></div><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</section><KnowledgeReviewPanel items={recentItems} resources={recentResources} /><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Eventos recientes</h2></div>{events.length === 0 ? <p className="p-5 text-sm text-slate-500">Todavía no hay eventos registrados.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Evento</th><th className="px-5 py-3">Scope</th><th className="px-5 py-3">Entidad</th></tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-slate-100"><td className="px-5 py-3 text-slate-500">{event.createdAt.toLocaleString("es-PE")}</td><td className="px-5 py-3 font-medium">{event.eventType}</td><td className="px-5 py-3">{event.scope}</td><td className="px-5 py-3">{event.entityType} · {event.entityId}</td></tr>)}</tbody></table></div>}</section></div></main>;
}
