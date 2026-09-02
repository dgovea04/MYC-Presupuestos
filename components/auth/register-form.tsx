"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { trackClientEvent } from "@/lib/analytics/client";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RegisterResponse = {
  error?: string;
  verificationEmailSent?: boolean;
};

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") === "pro" ? "pro" : null;
  const nextPath = plan ? "/billing/activate?plan=pro" : "/dashboard";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    trackClientEvent("signup_started", {
      cta_location: "register_form",
      landing_path: document.referrer || window.location.pathname,
    });
    setLoading(true);
    setError("");

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    const data = (await response.json().catch(() => null)) as RegisterResponse | null;

    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? "No se pudo registrar la cuenta");
      return;
    }

    const email = String(formData.get("email") ?? "");
    const sent = data?.verificationEmailSent === false ? "0" : "1";
    const loginParams = new URLSearchParams({
      verifyEmail: "1",
      email,
      sent,
      ...(plan ? { plan, next: nextPath } : {}),
    });
    router.push(`/login?${loginParams.toString()}`);
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      {plan ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Estás creando tu cuenta para activar Pro en tu espacio de trabajo.
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" placeholder="Ing. Maria Calderon" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" placeholder="tu@empresa.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contrasena</Label>
        <Input id="password" name="password" type="password" placeholder="Minimo 8 caracteres" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyName">Empresa o perfil profesional <span className="text-slate-500">(opcional)</span></Label>
        <Input id="companyName" name="companyName" placeholder="Constructora Andina SAC" />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <RegisterSubmitButton loading={loading} />
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500">o continua con</span>
        </div>
      </div>
      <GoogleSignInButton mode="register" callbackUrl={nextPath} />
    </form>
  );
}

function RegisterSubmitButton({ loading }: { loading: boolean }) {
  const { pending } = useFormStatus();
  const isLoading = loading || pending;

  return (
    <Button className="w-full" type="submit" loading={isLoading}>
      {isLoading ? "Creando cuenta..." : "Crear cuenta"}
    </Button>
  );
}
