"use client";

import { useState } from "react";
import { Save } from "lucide-react";
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
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="mb-4 space-y-1">
          <p className="text-sm font-medium text-slate-900">Datos principales</p>
          <p className="text-sm text-slate-500">Información comercial base para proyectos, presupuestos y catálogos.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

      <div className="flex items-center justify-end rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <Button className="gap-2 shadow-sm shadow-sky-950/10" disabled={pending}>
          <Save className="h-4 w-4" />
          {pending ? "Guardando..." : "Guardar empresa"}
        </Button>
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
