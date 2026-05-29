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
      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
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
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[1fr_0.9fr_0.9fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>Usuario</span>
          <span>Solicitud</span>
          <span>Fecha</span>
          <span>Accion</span>
        </div>
        {requests.map((request) => (
          <div key={request.id} className="grid grid-cols-[1fr_0.9fr_0.9fr_0.8fr] items-center border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{request.userName}</p>
              <p className="truncate text-xs text-slate-500">{request.userEmail}</p>
              <p className="truncate text-xs text-slate-400">Plan actual: {request.currentPlanName}</p>
            </div>
            <span className="truncate font-mono text-xs text-slate-500">{request.id}</span>
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
