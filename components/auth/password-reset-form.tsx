"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setMessage(null);
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        newPassword: String(formData.get("newPassword") ?? ""),
        confirmPassword: String(formData.get("confirmPassword") ?? ""),
      }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    setIsPending(false);

    if (!response.ok) {
      setMessage(payload?.error ?? "No se pudo cambiar la contrasena.");
      return;
    }

    setSuccess(true);
    setMessage("Contrasena actualizada. Ya puedes iniciar sesion.");
    window.setTimeout(() => router.push("/login"), 1200);
  }

  if (!token) {
    return <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">El enlace de recuperacion no es valido.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nueva contrasena</Label>
        <Input id="new-password" name="newPassword" type="password" minLength={8} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmar contrasena</Label>
        <Input id="confirm-password" name="confirmPassword" type="password" minLength={8} required />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Actualizando..." : "Cambiar contrasena"}
      </Button>
      {message ? (
        <p className={`rounded-xl px-3 py-2 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
