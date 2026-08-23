"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResendResponse = {
  error?: string;
  sent?: boolean;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [showMfaCode, setShowMfaCode] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const verifyEmail = searchParams.get("verifyEmail") === "1";
  const verificationSent = searchParams.get("sent") !== "0";
  const verified = searchParams.get("verified");
  const verificationReason = searchParams.get("reason");
  const canResend = email.trim().length > 0 && (verifyEmail || verified === "0");
  const nextPath = getSafeNextPath(searchParams.get("next"));

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const credentials = {
      email,
      password,
      redirect: false,
      ...(showMfaCode && mfaCode.trim() ? { mfaCode: mfaCode.trim() } : {}),
    };
    const result = await signIn("credentials", credentials);

    setLoading(false);

    if (result?.error === "MFA_REQUIRED") {
      setShowMfaCode(true);
      setMfaCode("");
      return;
    }

    if (result?.error) {
      setError(
        showMfaCode
          ? "El código MFA no es válido o ya venció. Intenta nuevamente."
          : "Credenciales inválidas, correo pendiente de verificación o cuenta suspendida.",
      );
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  async function handleResend() {
    if (!email.trim()) {
      setResendMessage("Ingresa tu correo para reenviar el enlace.");
      return;
    }

    setResending(true);
    setResendMessage("");

    const response = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, nextPath }),
    });

    const data = (await response.json().catch(() => null)) as ResendResponse | null;

    setResending(false);

    if (!response.ok) {
      setResendMessage(data?.error ?? "No se pudo reenviar la verificacion.");
      return;
    }

    setResendMessage(
      data?.sent
        ? "Te reenviamos el enlace de verificacion."
        : "No encontramos una cuenta pendiente de verificacion para ese correo.",
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {verifyEmail ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {verificationSent
            ? "Revisa tu correo y usa el enlace de verificacion antes de iniciar sesion."
            : "Tu cuenta fue creada, pero el correo no pudo enviarse automaticamente. Usa el reenvio para generar un nuevo enlace."}
        </div>
      ) : null}
      {verified === "1" ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Correo verificado. Ya puedes iniciar sesion.
        </div>
      ) : null}
      {verified === "0" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {getVerificationErrorMessage(verificationReason)}
        </div>
      ) : null}
      {!showMfaCode ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@empresa.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contrasena</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="........"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </>
      ) : null}
      {showMfaCode ? (
        <>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Paso 2 de 2</p>
            <p className="mt-1 text-sm font-semibold text-sky-950">Confirma tu identidad</p>
            <p className="mt-1 text-sm text-sky-800">Ingresa el código de tu aplicación autenticadora o un código de recuperación.</p>
            <Label htmlFor="mfaCode" className="mt-3 block">Código MFA o código de recuperación</Label>
            <Input
              id="mfaCode"
              name="mfaCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              className="mt-2 bg-white"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setShowMfaCode(false);
              setMfaCode("");
              setError("");
            }}
          >
            Volver a credenciales
          </Button>
        </>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? (showMfaCode ? "Verificando..." : "Ingresando...") : showMfaCode ? "Verificar código" : "Iniciar sesion"}
      </Button>
      {!showMfaCode && canResend ? (
        <Button type="button" variant="outline" className="w-full" disabled={resending} onClick={handleResend}>
          {resending ? "Reenviando..." : "Reenviar verificacion"}
        </Button>
      ) : null}
      {resendMessage ? <p className="text-sm text-slate-600">{resendMessage}</p> : null}
      {!showMfaCode ? (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">o continua con</span>
            </div>
          </div>
          <GoogleSignInButton mode="login" callbackUrl={nextPath} />
        </>
      ) : null}
    </form>
  );
}

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function getVerificationErrorMessage(reason: string | null) {
  if (reason === "expired") {
    return "El enlace de verificacion vencio. Puedes solicitar uno nuevo.";
  }

  if (reason === "already_verified") {
    return "Ese correo ya estaba verificado. Inicia sesion normalmente.";
  }

  return "El enlace de verificacion no es valido.";
}
