"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_SAVE_ERROR = "No se pudo guardar la empresa.";

export function CompanyProfileForm({
  initialCompany,
}: {
  initialCompany?: {
    name?: string | null;
    ruc?: string | null;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initialCompany?.name ?? "");
  const [ruc, setRuc] = useState(initialCompany?.ruc ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ruc,
        }),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      setSuccess("Empresa guardada correctamente.");
      router.refresh();
    } catch {
      setError(DEFAULT_SAVE_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="companyName">Nombre</Label>
        <Input id="companyName" disabled={pending} required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyRuc">RUC</Label>
        <Input
          id="companyRuc"
          disabled={pending}
          inputMode="numeric"
          maxLength={11}
          placeholder="Opcional"
          value={ruc}
          onChange={(event) => setRuc(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-rose-600 md:col-span-2">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700 md:col-span-2">{success}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <Button disabled={pending}>{pending ? "Guardando..." : "Guardar empresa"}</Button>
      </div>
    </form>
  );
}

async function getErrorMessage(response: Response) {
  try {
    const data: unknown = await response.json();

    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string" &&
      data.error.trim().length > 0
    ) {
      return data.error;
    }
  } catch {
    return DEFAULT_SAVE_ERROR;
  }

  return DEFAULT_SAVE_ERROR;
}
