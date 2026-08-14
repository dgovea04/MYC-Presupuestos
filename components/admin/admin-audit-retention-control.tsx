"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminAuditRetentionControl({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!enabled) {
    return null;
  }

  function handleAnonymize() {
    const confirmed = window.confirm(
      "Se anonimizarán los registros de auditoría con más de 90 días. Se conservarán la acción y la fecha, pero no se podrá recuperar la información personal. ¿Continuar?",
    );

    if (!confirmed) return;

    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/audit/retention", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string; anonymizedCount?: number } | null;

      if (!response.ok) {
        setMessage(payload?.error ?? "No se pudo aplicar la política de retención.");
        return;
      }

      setMessage(`${payload?.anonymizedCount ?? 0} registros antiguos fueron anonimizados.`);
      router.refresh();
    });
  }

  return (
    <div className="theme-muted-panel flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="theme-strong-text font-medium">Retención de auditoría</p>
        <p className="theme-muted-text mt-1 text-xs">Anonimiza datos personales de eventos con más de 90 días. La acción es irreversible.</p>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <Button type="button" variant="outline" disabled={isPending} onClick={handleAnonymize} className="gap-2">
          <Archive className="h-4 w-4" />
          {isPending ? "Anonimizando..." : "Anonimizar registros antiguos"}
        </Button>
        {message ? <p className="theme-muted-text text-xs">{message}</p> : null}
      </div>
    </div>
  );
}
