"use client";

import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, CreditCard, Loader2, QrCode, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type YapePayload = {
  requestId: string;
  status: "INCOMPLETE";
  createdAt: string;
  yape: {
    accountName: string;
    amount: string;
    offerCode: string;
    phone: string;
    qrImageUrl: string;
  };
};

export function WorkspaceProActivation({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [pending, setPending] = useState<"stripe" | "yape" | "receipt" | null>(null);
  const [yape, setYape] = useState<YapePayload | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const receiptInputRef = useRef<HTMLInputElement>(null);

  async function startStripeCheckout() {
    setPending("stripe");
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/billing/checkout`, { method: "POST" });
      const payload: unknown = await response.json();
      if (!response.ok || !isUrlPayload(payload)) throw new Error(readError(payload, "No se pudo iniciar el checkout con tarjeta."));
      window.location.href = payload.url;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar el checkout con tarjeta.");
    } finally {
      setPending(null);
    }
  }

  async function startYapeRequest() {
    setPending("yape");
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/billing/yape/request`, { method: "POST" });
      const payload: unknown = await response.json();
      if (!response.ok || !isYapePayload(payload)) throw new Error(readError(payload, "No se pudo registrar la solicitud Yape."));
      setYape(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la solicitud Yape.");
    } finally {
      setPending(null);
    }
  }

  async function uploadReceipt(file: File) {
    setPending("receipt");
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/workspaces/${workspaceId}/billing/yape/receipt`, { method: "POST", body: formData });
      const payload: unknown = await response.json();
      if (!response.ok || !isReceiptPayload(payload)) throw new Error(readError(payload, "No se pudo subir el comprobante."));
      setReceiptUrl(payload.receiptUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo subir el comprobante.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="border-sky-200 shadow-sm">
      <CardHeader className="space-y-3 bg-sky-50/70">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Activación Pro</p>
        <CardTitle className="text-2xl">Activa Pro para {workspaceName}</CardTitle>
        <CardDescription>
          Tu cuenta y espacio de trabajo ya están creados. Elige cómo pagar y conserva el control del plan desde este espacio de trabajo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" size="lg" className="justify-between gap-3" disabled={pending !== null} onClick={() => void startStripeCheckout()}>
            <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" />{pending === "stripe" ? "Abriendo Stripe..." : "Pagar con tarjeta"}</span>
            {pending === "stripe" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </Button>
          <Button type="button" size="lg" variant="outline" className="justify-between gap-3" disabled={pending !== null} onClick={() => void startYapeRequest()}>
            <span className="flex items-center gap-2"><QrCode className="h-4 w-4" />{pending === "yape" ? "Preparando Yape..." : "Pagar con Yape"}</span>
            {pending === "yape" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>

        {yape ? (
          <YapeDetails
            request={yape}
            receiptUrl={receiptUrl}
            uploadingReceipt={pending === "receipt"}
            onSelectFile={() => receiptInputRef.current?.click()}
          />
        ) : null}
        <input
          ref={receiptInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadReceipt(file);
            event.target.value = "";
          }}
        />
        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
        <p className="text-center text-xs text-slate-500">La activación Pro ocurre cuando Stripe confirma el pago o administración valida el comprobante de Yape.</p>
      </CardContent>
    </Card>
  );
}

function YapeDetails({
  request,
  receiptUrl,
  uploadingReceipt,
  onSelectFile,
}: {
  request: YapePayload;
  receiptUrl: string | null;
  uploadingReceipt: boolean;
  onSelectFile: () => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-amber-950">Solicitud Yape registrada</p>
        <p className="mt-1 text-sm leading-6 text-amber-900">Realiza el pago, envía el comprobante al equipo y conserva el código de solicitud para la validación.</p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-200 bg-white">
          {request.yape.qrImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR can be an operator-provided URL.
            <img src={request.yape.qrImageUrl} alt="Código QR de Yape" className="h-full w-full object-contain p-2" />
          ) : <span className="px-4 text-center text-xs text-slate-500">QR pendiente de configuración</span>}
        </div>
        <dl className="grid min-w-0 gap-2 text-sm text-amber-950">
          <div><dt className="inline font-medium">Titular: </dt><dd className="inline">{request.yape.accountName}</dd></div>
          {request.yape.phone ? <div><dt className="inline font-medium">Yape: </dt><dd className="inline">{request.yape.phone}</dd></div> : null}
          <div><dt className="inline font-medium">Monto: </dt><dd className="inline">{request.yape.amount}</dd></div>
          <div><dt className="inline font-medium">Oferta: </dt><dd className="inline">{request.yape.offerCode}</dd></div>
          <div><dt className="inline font-medium">Solicitud: </dt><dd className="inline font-mono text-xs">{request.requestId}</dd></div>
        </dl>
      </div>
      {receiptUrl ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Comprobante enviado. El equipo lo validará para activar Pro.</span>
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs font-medium underline">Ver</a>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploadingReceipt} onClick={onSelectFile}>
          {uploadingReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploadingReceipt ? "Subiendo..." : "Adjuntar comprobante de pago"}
        </Button>
      )}
    </div>
  );
}

function readError(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : fallback;
}

function isUrlPayload(value: unknown): value is { url: string } {
  return typeof value === "object" && value !== null && "url" in value && typeof value.url === "string";
}

function isYapePayload(value: unknown): value is YapePayload {
  if (typeof value !== "object" || value === null || !("requestId" in value) || !("yape" in value)) return false;
  const candidate = value as { requestId?: unknown; yape?: unknown };
  return typeof candidate.requestId === "string" && typeof candidate.yape === "object" && candidate.yape !== null;
}

function isReceiptPayload(value: unknown): value is { receiptUrl: string } {
  return typeof value === "object" && value !== null && "receiptUrl" in value && typeof value.receiptUrl === "string";
}
