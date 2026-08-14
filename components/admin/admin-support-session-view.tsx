"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogOut, MailCheck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SupportTarget = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  planName: string;
  billingMode: string | null;
  companyName: string;
  projectCount: number;
  budgetCount: number;
  createdAt: string;
};

export function AdminSupportSessionView({ target }: { target: SupportTarget }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAccountAction(action: "verify-email" | "revoke-sessions") {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${target.id}/${action}`, {
        method: action === "verify-email" ? "PATCH" : "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(response.ok ? (action === "verify-email" ? "Correo verificado." : "Sesiones revocadas.") : payload?.error ?? "No se pudo completar la acción.");
    });
  }

  function stopSupportSession() {
    startTransition(async () => {
      await fetch("/api/admin/support-session/stop", { method: "POST" });
      router.push("/admin");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4" /> Sesión de soporte limitada</div>
        <p className="mt-1">Los datos de obra se muestran en solo lectura. Esta sesión expira automáticamente en 15 minutos.</p>
      </div>
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">Cuenta consultada</p>
              <h1 className="text-2xl font-semibold text-slate-900">{target.name}</h1>
              <p className="text-sm text-slate-500">{target.email}</p>
            </div>
            <Button type="button" variant="outline" disabled={isPending} onClick={stopSupportSession} className="gap-2"><LogOut className="h-4 w-4" />Cerrar sesión de soporte</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Membresía" value={target.planName} />
            <Summary label="Empresa" value={target.companyName} />
            <Summary label="Proyectos" value={String(target.projectCount)} />
            <Summary label="Presupuestos" value={String(target.budgetCount)} />
          </div>
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {!target.emailVerified ? <Button type="button" variant="outline" disabled={isPending} onClick={() => runAccountAction("verify-email")} className="gap-2"><MailCheck className="h-4 w-4" />Verificar correo</Button> : <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />Correo verificado</span>}
            <Button type="button" variant="outline" disabled={isPending} onClick={() => runAccountAction("revoke-sessions")} className="gap-2"><LogOut className="h-4 w-4" />Cerrar sesiones activas</Button>
          </div>
          {message ? <p className="rounded-xl border px-3 py-2 text-sm text-slate-600">{message}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-slate-50 px-3 py-3"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-medium text-slate-900">{value}</p></div>;
}
