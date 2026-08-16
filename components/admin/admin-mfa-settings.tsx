"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OperationalSectionHeader } from "@/components/ui/operational-surfaces";
import { useRouter } from "next/navigation";

type MfaStatus = { enabled: boolean };

type SetupPayload = {
  secret: string;
  otpauthUri: string;
};

export function AdminMfaSettings() {
  const router = useRouter();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verifiedUntil, setVerifiedUntil] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/mfa/status");
      const payload: unknown = await response.json();
      if (!response.ok || !isMfaStatus(payload)) {
        throw new Error(readError(payload, "No se pudo consultar el estado de MFA."));
      }
      setStatus(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo consultar el estado de MFA.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadStatus();
    });
  }, [loadStatus]);

  async function beginSetup() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/mfa/setup", { method: "POST" });
      const payload: unknown = await response.json();
      if (!response.ok || !isSetupPayload(payload)) {
        throw new Error(readError(payload, "No se pudo iniciar la configuración de MFA."));
      }
      setSetup(payload);
      setCode("");
      setRecoveryCodes([]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo iniciar la configuración de MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    await submitCode("/api/admin/mfa/activate", "POST", "MFA activado. Guarda tus códigos de recuperación en un lugar seguro.");
  }

  async function verifyForCriticalActions() {
    await submitCode("/api/admin/mfa/verify", "POST", "MFA verificado. Las acciones críticas estarán habilitadas durante 10 minutos.");
  }

  async function disable() {
    if (!window.confirm("¿Desactivar MFA para el administrador principal? Tendrás que configurarlo nuevamente después.")) {
      return;
    }

    await submitCode("/api/admin/mfa/disable", "DELETE", "MFA desactivado.");
  }

  async function submitCode(url: string, method: "POST" | "DELETE", successMessage: string) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(readError(payload, "El código MFA no es válido."));
      }

      setMessage(successMessage);
      setCode("");

      if (url.endsWith("/activate")) {
        if (isRecoveryCodePayload(payload)) {
          setRecoveryCodes(payload.recoveryCodes);
        }
        setSetup(null);
        setStatus({ enabled: true });
        router.refresh();
      } else if (url.endsWith("/disable")) {
        setStatus({ enabled: false });
        setSetup(null);
        setRecoveryCodes([]);
        setVerifiedUntil(null);
        router.refresh();
      } else {
        setVerifiedUntil(new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo completar la operación MFA.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-4 p-6">
        <OperationalSectionHeader
          title="Autenticación multifactor"
          description="Protege las operaciones críticas del administrador principal con una aplicación TOTP."
        />

        {loading ? <p className="theme-muted-text text-sm">Consultando configuración MFA...</p> : null}
        {error ? <p className="theme-status-error rounded-xl border px-3 py-2 text-sm">{error}</p> : null}
        {message ? <p className="theme-status-success theme-status-success-strong rounded-xl border px-3 py-2 text-sm">{message}</p> : null}

        {!loading && status?.enabled === false ? (
          <div className="space-y-4">
            {!setup ? (
              <div className="theme-muted-panel flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="theme-strong-text font-medium">MFA todavía no está activado</p>
                  <p className="theme-muted-text mt-1 text-sm">Actívalo antes de eliminar usuarios o modificar secretos del sistema.</p>
                </div>
                <Button type="button" onClick={() => void beginSetup()} disabled={busy} className="gap-2">
                  <KeyRound className="h-4 w-4" />
                  Configurar MFA
                </Button>
              </div>
            ) : (
              <div className="theme-muted-panel space-y-4 rounded-2xl border px-4 py-4">
                <div>
                  <p className="theme-strong-text font-medium">Añade esta cuenta a tu aplicación autenticadora</p>
                  <p className="theme-muted-text mt-1 text-sm">Como no se agregó una dependencia de QR, puedes introducir la clave manualmente.</p>
                </div>
                <div className="space-y-2">
                  <p className="theme-muted-text text-xs font-medium uppercase tracking-wide">Clave secreta</p>
                  <code className="theme-surface-card block break-all rounded-xl border px-3 py-2 text-sm">{setup.secret}</code>
                </div>
                <div className="space-y-2">
                  <p className="theme-muted-text text-xs font-medium uppercase tracking-wide">URI de configuración</p>
                  <code className="theme-surface-card block max-h-20 overflow-auto break-all rounded-xl border px-3 py-2 text-xs">{setup.otpauthUri}</code>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Código de 6 dígitos"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    maxLength={6}
                  />
                  <Button type="button" onClick={() => void activate()} disabled={busy || code.trim().length < 6}>
                    Activar MFA
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {!loading && status?.enabled === true ? (
          <div className="space-y-4">
            <div className="theme-muted-panel flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <p className="theme-strong-text font-medium">MFA activo</p>
                  <p className="theme-muted-text mt-1 text-sm">Las acciones críticas requieren un código verificado recientemente.</p>
                </div>
              </div>
              {verifiedUntil ? <span className="theme-status-success theme-status-success-strong rounded-full px-3 py-1 text-xs">Verificado hasta {verifiedUntil}</span> : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Código TOTP o recuperación"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={20}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                onClick={() => void verifyForCriticalActions()}
                disabled={busy || code.trim().length < 6}
                className="w-full shrink-0 whitespace-nowrap sm:w-auto"
              >
                Verificar para acciones críticas
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void disable()}
                disabled={busy || code.trim().length < 6}
                className="w-full shrink-0 gap-2 whitespace-nowrap sm:w-auto"
              >
                <ShieldOff className="h-4 w-4" />
                Desactivar
              </Button>
            </div>

            {recoveryCodes.length > 0 ? (
              <div className="theme-status-warning rounded-2xl border px-4 py-4">
                <p className="font-medium">Códigos de recuperación — guárdalos ahora</p>
                <p className="mt-1 text-sm">Cada código se puede utilizar una sola vez y no volverá a mostrarse.</p>
                <div className="mt-3 grid gap-2 font-mono text-sm sm:grid-cols-2">
                  {recoveryCodes.map((recoveryCode) => <code key={recoveryCode}>{recoveryCode}</code>)}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function isMfaStatus(value: unknown): value is MfaStatus {
  return isRecord(value) && typeof value.enabled === "boolean";
}

function isSetupPayload(value: unknown): value is SetupPayload {
  return isRecord(value) && typeof value.secret === "string" && typeof value.otpauthUri === "string";
}

function isRecoveryCodePayload(value: unknown): value is { recoveryCodes: string[] } {
  return isRecord(value) && Array.isArray(value.recoveryCodes) && value.recoveryCodes.every((code) => typeof code === "string");
}

function readError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
