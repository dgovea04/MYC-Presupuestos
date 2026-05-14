"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormActionBar, FormSectionPanel } from "@/components/ui/operational-surfaces";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function ResourceForm({ companyId }: { companyId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");

    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, currency: "PEN", ...Object.fromEntries(formData.entries()) }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "No se pudo crear el insumo");
      return;
    }

    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <FormSectionPanel
        title="Nuevo insumo"
        description="Registra rápidamente un insumo base para reutilizarlo en APUs, catálogos y presupuestos."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Input id="description" name="description" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select id="category" name="category" defaultValue="MATERIAL">
              <option value="MATERIAL">Materiales</option>
              <option value="LABOR">Mano de obra</option>
              <option value="EQUIPMENT">Equipos</option>
              <option value="TOOLS">Herramientas</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unidad</Label>
            <Input id="unit" name="unit" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unitPrice">Precio</Label>
            <Input id="unitPrice" name="unitPrice" type="number" step="0.01" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iu">IU</Label>
            <Input id="iu" name="iu" />
          </div>
          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <Label htmlFor="source">Fuente</Label>
            <Input id="source" name="source" />
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
          El código se genera automáticamente según la categoría.
        </div>
      </FormSectionPanel>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <FormActionBar>
        <Button className="gap-2 shadow-sm shadow-sky-950/10" disabled={loading}>
          <Plus className="h-4 w-4" />
          {loading ? "Guardando..." : "Crear insumo"}
        </Button>
      </FormActionBar>
    </form>
  );
}
