"use client";

import { useState } from "react";
import { CreditCard, QrCode, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";

type BillingActionButtonsProps = {
  canManageBilling: boolean;
  canUpgrade: boolean;
};

type BillingErrorPayload = {
  error?: string;
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

      if (!response.ok) {
        const errorPayload = payload as BillingErrorPayload;
        setError(errorPayload.error ?? "No se pudo registrar la solicitud Yape.");
        return;
      }

      if (isBillingErrorPayload(payload)) {
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
              className="theme-filter-button-inactive gap-2 border"
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
      {error ? <p className="theme-status-error rounded-xl border px-3 py-2 text-sm">{error}</p> : null}
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

function isBillingErrorPayload(payload: YapeRequest | BillingErrorPayload): payload is BillingErrorPayload {
  return "error" in payload;
}

function YapeRequestPanel({ request }: { request: YapeRequest }) {
  return (
    <div className="theme-muted-panel space-y-3 rounded-2xl border p-4">
      <div>
        <p className="theme-strong-text text-sm font-semibold">Pago manual con Yape</p>
        <p className="theme-muted-text mt-1 text-sm leading-6">
          Escanea el QR, realiza el pago y envia el comprobante al equipo. La activacion Pro se valida manualmente desde admin.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="theme-surface-card relative flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-2xl border">
          {request.yape.qrImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR can be an arbitrary operator-provided URL.
            <img alt="Codigo QR de Yape para MYC Presupuestos" src={request.yape.qrImageUrl} className="h-full w-full object-contain p-2" />
          ) : (
            <span className="theme-muted-text px-4 text-center text-xs leading-5">Configura el QR de Yape en el entorno</span>
          )}
        </div>
        <div className="theme-muted-text min-w-0 space-y-2 text-sm">
          <p>
            <span className="theme-strong-text font-medium">Titular:</span> {request.yape.accountName}
          </p>
          {request.yape.phone ? (
            <p>
              <span className="theme-strong-text font-medium">Yape:</span> {request.yape.phone}
            </p>
          ) : null}
          {request.yape.amount ? (
            <p>
              <span className="theme-strong-text font-medium">Monto:</span> {request.yape.amount}
            </p>
          ) : null}
          <p>
            <span className="theme-strong-text font-medium">Solicitud:</span> {request.requestId}
          </p>
        </div>
      </div>
    </div>
  );
}
