"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActionBar, FormSectionPanel } from "@/components/ui/operational-surfaces";
import { Label } from "@/components/ui/label";
import type { AiAutocompletePartidaSuggestion } from "@/lib/ai/types";
import type { CatalogPartidaPatchResult, CatalogPartidaRecord, CatalogPartidaStatePatch } from "@/types/partida";

export function PartidaForm({
  onCreated,
  onCancel,
  initialSuggestion,
}: {
  onCreated?: (partida: CatalogPartidaRecord) => void;
  onCancel?: () => void;
  initialSuggestion?: AiAutocompletePartidaSuggestion | null;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const description = String(formData.get("description") ?? "");
    const unit = String(formData.get("unit") ?? "");
    const source = String(formData.get("source") ?? "");
    const performance = Number(formData.get("performance") ?? 1);
    const clientId = crypto.randomUUID();
    const patch: CatalogPartidaStatePatch = {
      create: [
        {
          clientId,
          data: {
            description,
            unit,
            unitPrice: 0,
            currency: "PEN",
            source,
            performance,
            performanceUnit: unit,
            performanceRate: buildPerformanceRate(performance, unit),
            apuRows: [],
          },
        },
      ],
      update: [],
      delete: [],
    };

    const response = await fetch("/api/partidas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo crear la partida");
      return;
    }

    const result = (await response.json()) as CatalogPartidaPatchResult;
    const createdPartida = result.created.find((entry) => entry.clientId === clientId)?.partida;
    if (!createdPartida) {
      setError("No se pudo recuperar la partida creada");
      return;
    }

    formRef.current?.reset();
    broadcastAppDataChange(["/partidas", "/budgets"]);
    onCreated?.(createdPartida);
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-5">
      <FormSectionPanel
        title="Nueva partida"
        description="Registra una partida base sin salir del catalogo y completale el APU cuando la necesites."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Descripcion</Label>
            <Input id="description" name="description" defaultValue={initialSuggestion?.description ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unidad</Label>
            <Input id="unit" name="unit" defaultValue={initialSuggestion?.unit ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="performance">Rendimiento</Label>
            <Input id="performance" name="performance" type="number" step="0.0001" min="0.0001" defaultValue="1" required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="source">Fuente</Label>
            <Input id="source" name="source" />
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
          La partida se crea con precio inicial 0 y sin filas de APU. Luego puedes completarla desde &quot;Ver APU&quot;.
        </div>
      </FormSectionPanel>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <FormActionBar>
        <div className="flex flex-wrap items-center gap-2">
          {onCancel ? (
            <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" className="gap-2 shadow-sm shadow-sky-950/10" disabled={loading}>
            <Plus className="h-4 w-4" />
            {loading ? "Guardando..." : "Crear partida"}
          </Button>
        </div>
      </FormActionBar>
    </form>
  );
}

function buildPerformanceRate(performance: number, unit: string) {
  const normalizedUnit = unit.trim();
  return normalizedUnit ? `${performance.toFixed(4)} ${normalizedUnit}/DIA` : `${performance.toFixed(4)}`;
}
