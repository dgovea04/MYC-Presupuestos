"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo registrar la cuenta");
      return;
    }

    router.push("/login");
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" placeholder="Ing. María Calderón" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" placeholder="tu@empresa.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" placeholder="Mínimo 8 caracteres" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyName">Empresa o perfil profesional</Label>
        <Input id="companyName" name="companyName" placeholder="Constructora Andina SAC" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ruc">RUC</Label>
        <Input id="ruc" name="ruc" placeholder="20123456789" />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500">o continúa con</span>
        </div>
      </div>
      <GoogleSignInButton mode="register" />
    </form>
  );
}
