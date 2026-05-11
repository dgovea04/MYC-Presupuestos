"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

export function UserSettingsForm({ initialDecimals }: { initialDecimals: number }) {
  const [currencyDecimals, setCurrencyDecimals] = useState(String(initialDecimals));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currencyDecimals: Number(currencyDecimals),
      }),
    });

    setPending(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo guardar la configuracion");
      return;
    }

    setSuccess("Configuracion guardada correctamente.");
  }

  const preview = formatCurrency(7723.48, "PEN", Number(currencyDecimals));

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="currencyDecimals">Decimales para moneda</Label>
        <Select id="currencyDecimals" value={currencyDecimals} onChange={(event) => setCurrencyDecimals(event.target.value)}>
          <option value="0">0 decimales</option>
          <option value="1">1 decimal</option>
          <option value="2">2 decimales</option>
          <option value="3">3 decimales</option>
          <option value="4">4 decimales</option>
        </Select>
        <p className="text-sm text-slate-500">Vista previa: <span className="font-medium text-slate-900">{preview}</span></p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar configuracion"}
      </Button>
    </form>
  );
}
