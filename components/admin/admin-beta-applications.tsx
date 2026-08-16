"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type BetaApplicationRow = {
  id: string;
  name: string;
  email: string;
  campaign: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt: string | Date | null;
  reviewNote: string | null;
  createdAt: string | Date;
};

export function AdminBetaApplications({
  applications,
  canReview,
}: {
  applications: BetaApplicationRow[];
  canReview: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function review(application: BetaApplicationRow, decision: "APPROVE" | "REJECT") {
    const reviewNote = window.prompt(decision === "APPROVE" ? "Nota opcional de aprobación" : "Motivo del rechazo") ?? "";
    if (decision === "REJECT" && reviewNote.trim().length < 3) {
      setMessage("Indica un motivo breve para rechazar la solicitud.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/beta/applications?id=${encodeURIComponent(application.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNote: reviewNote.trim() || null }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? `Solicitud ${decision === "APPROVE" ? "aprobada" : "rechazada"}.` : payload?.error ?? "No se pudo revisar la solicitud.");
      if (response.ok) router.refresh();
    });
  }

  return (
    <Card className="theme-surface-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="theme-filter-button-active inline-flex h-10 w-10 items-center justify-center rounded-2xl"><Mail className="h-5 w-5" /></span>
          <div>
            <CardTitle>Solicitudes de Usuarios Fundadores Perú</CardTitle>
            <p className="theme-muted-text mt-1 text-sm">Beta Pro sin cobro durante 60 días. La aprobación no crea una suscripción Stripe.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {applications.length === 0 ? (
          <p className="theme-dashed-panel theme-muted-text rounded-2xl border px-4 py-8 text-center text-sm">No hay solicitudes registradas.</p>
        ) : (
          applications.map((application) => (
            <div key={application.id} className="theme-surface-card flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="theme-strong-text font-semibold">{application.name}</p>
                  <StatusBadge status={application.status} />
                </div>
                <p className="theme-muted-text mt-1 text-sm">{application.email}</p>
                <p className="theme-subtle-text mt-1 text-xs">Solicitó {formatDate(application.createdAt)} · {application.campaign}</p>
                {application.reviewNote ? <p className="theme-muted-text mt-2 text-xs">Nota: {application.reviewNote}</p> : null}
              </div>
              {canReview && application.status === "PENDING" ? (
                <div className="flex shrink-0 gap-2">
                  <Button type="button" disabled={isPending} onClick={() => review(application, "APPROVE")} className="gap-2"><Check className="h-4 w-4" />Aprobar</Button>
                  <Button type="button" variant="outline" disabled={isPending} onClick={() => review(application, "REJECT")} className="gap-2"><X className="h-4 w-4" />Rechazar</Button>
                </div>
              ) : null}
            </div>
          ))
        )}
        {message ? <p className="theme-muted-panel theme-muted-text rounded-xl px-3 py-2 text-sm">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: BetaApplicationRow["status"] }) {
  const className = status === "APPROVED"
    ? "theme-status-success"
    : status === "REJECTED"
      ? "theme-status-error"
      : "theme-status-info theme-status-info-strong";
  return <span className={`${className} rounded-full px-2.5 py-1 text-xs font-semibold`}>{status}</span>;
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
