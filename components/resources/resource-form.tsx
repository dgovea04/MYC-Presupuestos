"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <form action={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-6">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Descripcion</Label>
        <Input id="description" name="description" required />
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
      <div className="space-y-2">
        <Label htmlFor="category">Categoria</Label>
        <Select id="category" name="category" defaultValue="MATERIAL">
          <option value="MATERIAL">Materiales</option>
          <option value="LABOR">Mano de obra</option>
          <option value="EQUIPMENT">Equipos</option>
          <option value="TOOLS">Herramientas</option>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="source">Fuente</Label>
        <Input id="source" name="source" />
      </div>
      <div className="flex items-end md:col-span-2">
        <div className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          El codigo se genera automaticamente segun la categoria.
        </div>
      </div>
      <div className="flex items-end md:col-span-2">
        <Button className="w-full" disabled={loading}>
          {loading ? "Guardando..." : "Crear insumo"}
        </Button>
      </div>
      {error ? <p className="text-sm text-rose-600 md:col-span-6">{error}</p> : null}
    </form>
  );
}
