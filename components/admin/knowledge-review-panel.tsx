"use client";

import { useState } from "react";

type Candidate = { id: string; name: string; scope: string; aliases: Array<{ alias: string; confirmed: boolean }> };

export function KnowledgeReviewPanel({ items, resources }: { items: Candidate[]; resources: Candidate[] }) {
  const [message, setMessage] = useState<string>("");
  const [alias, setAlias] = useState<Record<string, string>>({});
  async function confirm(kind: "items" | "resources", id: string) {
    const value = alias[id]?.trim(); if (!value) return setMessage("Escribe un alias antes de confirmarlo.");
    const response = await fetch(`/api/knowledge/${kind}/${id}/aliases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ alias: value }) });
    const payload = await response.json() as { error?: string }; setMessage(response.ok ? "Alias confirmado." : payload.error ?? "No se pudo confirmar el alias."); if (response.ok) setAlias((current) => ({ ...current, [id]: "" }));
  }
  const render = (kind: "items" | "resources", rows: Candidate[]) => rows.map((row) => <div key={row.id} className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{row.name}</p><p className="text-xs text-slate-500">{row.scope} · {row.aliases.length} aliases</p></div><div className="flex gap-2"><input aria-label={`Alias para ${row.name}`} value={alias[row.id] ?? ""} onChange={(event) => setAlias((current) => ({ ...current, [row.id]: event.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Alias confirmado" /><button type="button" onClick={() => void confirm(kind, row.id)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">Confirmar</button></div></div>);
  return <section className="grid gap-5 lg:grid-cols-2"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Partidas candidatas</h2>{render("items", items)}</div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="px-5 py-4 font-semibold">Recursos candidatos</h2>{render("resources", resources)}</div>{message ? <p role="status" className="text-sm text-slate-600 lg:col-span-2">{message}</p> : null}</section>;
}

