"use client";

import { useState } from "react";
import { CreditCard, QrCode, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";

type BillingActionButtonsProps = {
  canManageBilling: boolean;
  canUpgrade: boolean;
};

export function BillingActionButtons({ canManageBilling, canUpgrade }: BillingActionButtonsProps) {
  const [pendingAction, setPendingAction] = useState<"checkout" | "portal" | "yape" | null>(null);
  const [error, setError] = useState("");
  const [yapeRequest, setYapeRequest] = useState<YapeRequest | null>(null);

  async function redirectFromBillingEndpoint(endpoint: "/api/billing/checkout" | "/api/billing/portal", action: "checkout" | "portal") {
    setPendingAction(action);
    setError("");

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        setError(payload.error ?? "No se pudo abrir Stripe. Revisa la configuracion de facturacion.");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError("No se pudo conectar con facturacion.");
    } finally {
      setPendingAction(null);
    }
  }

  async function createYapeRequest() {
    setPendingAction("yape");
    setError("");

    try {
      const response = await fetch("/api/billing/yape/request", { method: "POST" });
      const payload = (await response.json()) as YapeRequest | { error?: string };

      if (!response.ok || "error" in payload) {
        setError(payload.error ?? "No se pudo registrar la solicitud Yape.");
        return;
      }

      setYapeRequest(payload);
    } catch {
      setError("No se pudo registrar la solicitud Yape.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {canUpgrade ? (
          <>
            <Button
              className="gap-2"
              disabled={pendingAction !== null}
              type="button"
              onClick={() => void redirectFromBillingEndpoint("/api/billing/checkout", "checkout")}
            >
              <CreditCard className="h-4 w-4" />
              {pendingAction === "checkout" ? "Abriendo..." : "Pagar con tarjeta"}
            </Button>
            <Button
              className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
              disabled={pendingAction !== null}
              type="button"
              variant="outline"
              onClick={() => void createYapeRequest()}
            >
              <QrCode className="h-4 w-4" />
              {pendingAction === "yape" ? "Generando..." : "Pagar con Yape"}
            </Button>
          </>
        ) : null}
        {canManageBilling ? (
          <Button
            className="gap-2"
            disabled={pendingAction !== null}
            type="button"
            variant="outline"
            onClick={() => void redirectFromBillingEndpoint("/api/billing/portal", "portal")}
          >
            <Settings className="h-4 w-4" />
            {pendingAction === "portal" ? "Abriendo..." : "Gestionar facturacion"}
          </Button>
        ) : null}
      </div>
      {yapeRequest ? <YapeRequestPanel request={yapeRequest} /> : null}
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

type YapeRequest = {
  createdAt: string;
  requestId: string;
  status: "INCOMPLETE";
  yape: {
    accountName: string;
    amount: string;
    phone: string;
    qrImageUrl: string;
  };
};

function YapeRequestPanel({ request }: { request: YapeRequest }) {
  return (
    <div className="space-y-3 rounded-2xl border border-purple-200 bg-purple-50/70 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-950">Pago manual con Yape</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Escanea el QR, realiza el pago y envia el comprobante al equipo. La activacion Pro se valida manualmente desde admin.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-purple-100 bg-white">
          {request.yape.qrImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR can be an arbitrary operator-provided URL.
            <img alt="Codigo QR de Yape para MYC Presupuestos" src={request.yape.qrImageUrl} className="h-full w-full object-contain p-2" />
          ) : (
            <span className="px-4 text-center text-xs leading-5 text-slate-500">Configura el QR de Yape en el entorno</span>
          )}
        </div>
        <div className="min-w-0 space-y-2 text-sm text-slate-700">
          <p>
            <span className="font-medium text-slate-950">Titular:</span> {request.yape.accountName}
          </p>
          {request.yape.phone ? (
            <p>
              <span className="font-medium text-slate-950">Yape:</span> {request.yape.phone}
            </p>
          ) : null}
          {request.yape.amount ? (
            <p>
              <span className="font-medium text-slate-950">Monto:</span> {request.yape.amount}
            </p>
          ) : null}
          <p>
            <span className="font-medium text-slate-950">Solicitud:</span> {request.requestId}
          </p>
        </div>
      </div>
    </div>
  );
}
