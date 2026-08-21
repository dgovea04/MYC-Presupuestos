"use client";

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type UsagePayload = { seats: { used: number; limit: number | null } };

export function WorkspaceSeatUsageCard({ workspaceId }: { workspaceId: string }) {
  const [usage, setUsage] = useState<UsagePayload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/workspaces/${workspaceId}/usage`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok || !isUsagePayload(payload)) throw new Error("No se pudo cargar el uso de asientos");
        setUsage(payload);
      })
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "No se pudo cargar el uso de asientos"); });
    return () => controller.abort();
  }, [workspaceId]);

  return <Card className="border-[var(--app-border)] bg-[var(--app-surface)]"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Asientos del workspace</CardTitle></CardHeader><CardContent>{usage ? <><p className="text-2xl font-semibold text-[var(--app-text-strong)]">{usage.seats.used} <span className="text-sm font-normal text-[var(--app-text-muted)]">/ {usage.seats.limit === null ? "Ilimitados" : usage.seats.limit}</span></p><p className="mt-1 text-sm text-[var(--app-text-muted)]">Se cuentan miembros activos e invitaciones pendientes.</p></> : error ? <p className="text-sm text-rose-700">{error}</p> : <Loader2 className="h-4 w-4 animate-spin" />}</CardContent></Card>;
}

function isUsagePayload(value: unknown): value is UsagePayload {
  if (typeof value !== "object" || value === null || !("seats" in value)) return false;
  const seats = (value as { seats?: unknown }).seats;
  return typeof seats === "object" && seats !== null && "used" in seats && typeof seats.used === "number" && "limit" in seats && (typeof seats.limit === "number" || seats.limit === null);
}
