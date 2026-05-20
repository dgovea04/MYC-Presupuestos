"use client";

import { useState } from "react";
import Image from "next/image";
import { Save, Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { broadcastAppDataChange } from "@/lib/client/live-updates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_SAVE_ERROR = "No se pudo guardar la empresa.";

export function CompanyProfileForm({
  initialCompany,
  onSaved,
  onCancel,
  onSubmitSuccess,
}: {
  initialCompany?: {
    name?: string | null;
    ruc?: string | null;
    logoUrl?: string | null;
  };
  onSaved?: (company: { name?: string | null; ruc?: string | null; logoUrl?: string | null }) => void;
  onCancel?: () => void;
  onSubmitSuccess?: () => void;
}) {
  const [name, setName] = useState(initialCompany?.name ?? "");
  const [ruc, setRuc] = useState(initialCompany?.ruc ?? "");
  const [logoUrl, setLogoUrl] = useState(initialCompany?.logoUrl ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [logoPending, setLogoPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function persistCompanyDraft() {
    const response = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ruc,
      }),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const company = (await response.json()) as { name?: string | null; ruc?: string | null; logoUrl?: string | null };
    const nextCompany = {
      name: company.name ?? name,
      ruc: company.ruc ?? ruc,
      logoUrl: company.logoUrl ?? logoUrl,
    };

    setName(nextCompany.name ?? "");
      setRuc(nextCompany.ruc ?? "");
      setLogoUrl(nextCompany.logoUrl ?? null);
      onSaved?.(nextCompany);

    return nextCompany;
  }

  async function persistSelectedLogo() {
    if (!logoFile) {
      return null;
    }

    const formData = new FormData();
    formData.set("logo", logoFile);

    const response = await fetch("/api/company/logo", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const company = (await response.json()) as { name?: string | null; ruc?: string | null; logoUrl?: string | null };
    const nextCompany = {
      name: company.name ?? name,
      ruc: company.ruc ?? ruc,
      logoUrl: company.logoUrl ?? null,
    };

    setName(nextCompany.name ?? "");
    setRuc(nextCompany.ruc ?? "");
    setLogoUrl(nextCompany.logoUrl);
    setLogoFile(null);
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoPreviewUrl(null);
    onSaved?.(nextCompany);

    return nextCompany;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    try {
      await persistCompanyDraft();
      if (logoFile) {
        await persistSelectedLogo();
      }
      broadcastAppDataChange(["/dashboard", "/projects", "/budgets", "/resources", "/settings"], undefined, {
        locallyHandledPaths: ["/settings"],
      });
      setSuccess("Empresa guardada correctamente.");
      onSubmitSuccess?.();
    } catch {
      setError(DEFAULT_SAVE_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function handleLogoUpload() {
    if (!logoFile) return;

    setLogoPending(true);
    setError("");
    setSuccess("");

    try {
      if (!initialCompany) {
        await persistCompanyDraft();
      }

      await persistSelectedLogo();
      broadcastAppDataChange(["/dashboard", "/projects", "/budgets", "/resources", "/settings"], undefined, {
        locallyHandledPaths: ["/settings"],
      });
      setSuccess("Logo guardado correctamente.");
    } catch {
      setError(DEFAULT_SAVE_ERROR);
    } finally {
      setLogoPending(false);
    }
  }

  async function handleLogoDelete() {
    setLogoPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/company/logo", {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      const company = (await response.json()) as { name?: string | null; ruc?: string | null; logoUrl?: string | null };
      const nextCompany = {
        name: company.name ?? name,
        ruc: company.ruc ?? ruc,
        logoUrl: null,
      };
      setName(nextCompany.name ?? "");
      setRuc(nextCompany.ruc ?? "");
      setLogoUrl(null);
      setLogoFile(null);
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      setLogoPreviewUrl(null);
      onSaved?.(nextCompany);
      broadcastAppDataChange(["/dashboard", "/projects", "/budgets", "/resources", "/settings"], undefined, {
        locallyHandledPaths: ["/settings"],
      });
      setSuccess("Logo eliminado correctamente.");
    } catch {
      setError(DEFAULT_SAVE_ERROR);
    } finally {
      setLogoPending(false);
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

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="mb-4 space-y-1">
          <p className="text-sm font-medium text-slate-900">Logo de empresa</p>
          <p className="text-sm text-slate-500">Usa PNG o JPG para que el logo pueda salir correctamente en PDF y Excel.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="flex h-36 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
            {logoPreviewUrl || logoUrl ? (
              <Image src={logoPreviewUrl ?? logoUrl ?? ""} alt="Logo de empresa" width={140} height={112} className="max-h-28 max-w-[140px] object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <ImageIcon className="h-8 w-8" />
                <span className="text-xs font-medium uppercase tracking-[0.16em]">Sin logo</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="companyLogo">Seleccionar logo</Label>
              <Input
                id="companyLogo"
                type="file"
                accept="image/png,image/jpeg"
                disabled={logoPending}
                onChange={(event) => {
                  if (logoPreviewUrl) {
                    URL.revokeObjectURL(logoPreviewUrl);
                  }

                  const nextFile = event.target.files?.[0] ?? null;
                  setLogoFile(nextFile);
                  setLogoPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-2" disabled={!logoFile || logoPending} onClick={() => void handleLogoUpload()}>
                <Upload className="h-4 w-4" />
                {logoPending ? "Subiendo..." : logoUrl ? "Reemplazar logo" : "Subir logo"}
              </Button>
              {logoUrl ? (
                <Button type="button" variant="ghost" className="gap-2 text-rose-600 hover:text-rose-700" disabled={logoPending} onClick={() => void handleLogoDelete()}>
                  <Trash2 className="h-4 w-4" />
                  Eliminar logo
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

      <div className="flex items-center justify-end gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        {onCancel ? (
          <Button type="button" variant="outline" disabled={pending || logoPending} onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" className="gap-2 shadow-sm shadow-sky-950/10" disabled={pending}>
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
