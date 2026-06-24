"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ManualPaymentRequest = {
  id: string;
  createdAt: string;
  userEmail: string;
  userName: string;
  currentPlanName: string;
};

export function ManualPaymentRequests({ requests }: { requests: ManualPaymentRequest[] }) {
  const [isPending, startTransition] = useTransition();

  if (requests.length === 0) {
    return (
      <p className="theme-dashed-panel theme-muted-text rounded-2xl border px-4 py-6 text-sm">
        No hay solicitudes Yape pendientes por validar.
      </p>
    );
  }

  function activateRequest(requestId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/billing/manual-requests/${requestId}/activate`, {
        method: "POST",
      });

      if (response.ok) {
        window.location.reload();
      }
    });
  }

  return (
    <div className="theme-surface-card overflow-x-auto rounded-2xl border">
      <div className="min-w-[760px]">
        <div className="theme-muted-panel theme-muted-text grid grid-cols-[1fr_0.9fr_0.9fr_0.8fr] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em]">
          <span>Usuario</span>
          <span>Solicitud</span>
          <span>Fecha</span>
          <span>Accion</span>
        </div>
        {requests.map((request) => (
          <div key={request.id} className="grid grid-cols-[1fr_0.9fr_0.9fr_0.8fr] items-center border-t border-[var(--app-border-soft)] px-4 py-3 text-sm text-[var(--app-text)]">
            <div className="min-w-0">
              <p className="theme-strong-text truncate font-medium">{request.userName}</p>
              <p className="theme-muted-text truncate text-xs">{request.userEmail}</p>
              <p className="theme-subtle-text truncate text-xs">Plan actual: {request.currentPlanName}</p>
            </div>
            <span className="theme-muted-text truncate font-mono text-xs">{request.id}</span>
            <span>{formatDateLabel(request.createdAt)}</span>
            <Button className="w-fit gap-2" disabled={isPending} size="sm" type="button" onClick={() => activateRequest(request.id)}>
              <CheckCircle2 className="h-4 w-4" />
              Activar Pro
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
