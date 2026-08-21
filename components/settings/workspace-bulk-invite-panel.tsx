"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type BulkResult = {
  results: Array<{
    email: string;
    status: "created" | "not_found" | "self" | "already_member";
    existingStatus?: string;
  }>;
  invalid: string[];
  createdCount: number;
  rejectedCount: number;
};

const STATUS_LABELS: Record<string, string> = {
  created: "Invitado",
  not_found: "No se encontró usuario con ese email",
  self: "No puedes invitarte a ti mismo",
  already_member: "Ya es miembro del workspace",
};

export function WorkspaceBulkInvitePanel({ workspaceId }: { workspaceId: string }) {
  const [emailsText, setEmailsText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);

  async function handleSubmit() {
    if (!emailsText.trim() || pending) return;
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/bulk-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailsText }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "No se pudo procesar el lote";
        throw new Error(message);
      }
      if (!isBulkResult(payload)) throw new Error("La respuesta no tiene el formato esperado");
      setResult(payload);
      if (payload.createdCount > 0) setEmailsText("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo procesar el lote");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Invitación masiva
        </CardTitle>
        <CardDescription>
          Pega varios emails separados por comas, punto y coma o saltos de línea. Los duplicados se deduplican automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          aria-label="Emails a invitar"
          className="min-h-28 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
          placeholder={"ana@empresa.com, luis@empresa.com\nmaria@empresa.com"}
          value={emailsText}
          onChange={(event) => {
            setEmailsText(event.target.value);
            setError("");
          }}
          disabled={pending}
        />
        <Button type="button" className="gap-2" disabled={pending || !emailsText.trim()} onClick={() => void handleSubmit()}>
          <Users className="h-4 w-4" />
          {pending ? "Procesando..." : "Enviar invitaciones"}
        </Button>

        {pending ? <div className="flex items-center gap-2 py-2 text-sm text-[var(--app-text-muted)]"><Loader2 className="h-4 w-4 animate-spin" />Procesando lote...</div> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        {result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{result.createdCount} invitados</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{result.rejectedCount} rechazados</span>
              {result.invalid.length > 0 ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{result.invalid.length} inválidos</span> : null}
            </div>

            {(result.results.length > 0 || result.invalid.length > 0) ? (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-[var(--app-border)] p-2 text-sm">
                {result.results.map((item) => (
                  <li key={item.email} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5">
                    <span className="min-w-0 truncate text-[var(--app-text-strong)]">{item.email}</span>
                    <span className={item.status === "created" ? "shrink-0 text-xs text-emerald-600" : "shrink-0 text-xs text-[var(--app-text-muted)]"}>{STATUS_LABELS[item.status] ?? item.status}</span>
                  </li>
                ))}
                {result.invalid.map((token) => (
                  <li key={token} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5">
                    <span className="min-w-0 truncate text-[var(--app-text-strong)]">{token}</span>
                    <span className="shrink-0 text-xs text-amber-600">Email inválido</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function isBulkResult(value: unknown): value is BulkResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { results?: unknown; invalid?: unknown; createdCount?: unknown; rejectedCount?: unknown };
  return Array.isArray(candidate.results) && Array.isArray(candidate.invalid) && typeof candidate.createdCount === "number" && typeof candidate.rejectedCount === "number";
}
