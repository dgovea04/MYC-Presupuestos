"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(process.env.NODE_ENV === "development" ? `Error de autenticacion: ${result.error}` : "Credenciales invalidas");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" placeholder="tu@empresa.com" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" placeholder="••••••••" required />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Ingresando..." : "Iniciar sesión"}
      </Button>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500">o continúa con</span>
        </div>
      </div>
      <GoogleSignInButton mode="login" />
    </form>
  );
}
