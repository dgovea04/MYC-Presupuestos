"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";
import { captureUtmAttribution, getAttributionEventParams } from "@/lib/analytics/utm";
import { trackClientEvent } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PilotApplicationSectionProps = {
  sectionId?: string;
  landingVariant?: string;
  ctaLocation?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  formTitle?: string;
  formSubtitle?: string;
  submitLabel?: string;
  openOnMount?: boolean;
};

export function PilotApplicationSection({
  sectionId = "piloto",
  landingVariant = "acquisition-v1",
  ctaLocation = "acquisition_pilot_form",
  eyebrow = "Para equipos y constructoras",
  title = "¿Quieres evaluar MC Presupuestos para tu equipo?",
  description = "Cuéntanos brevemente sobre tu operación y el equipo podrá orientarte sobre una evaluación acompañada del producto.",
  formTitle = "Cuéntanos sobre tu equipo",
  formSubtitle = "Solo nombre y email",
  submitLabel = "Cuéntanos sobre tu equipo",
  openOnMount = false,
}: PilotApplicationSectionProps = {}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(openOnMount);

  const closeDialog = useCallback(() => {
    setOpen(false);
    if (window.location.hash === `#${sectionId}`) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [sectionId]);

  useEffect(() => {
    const openFromHashChange = () => {
      if (window.location.hash === `#${sectionId}`) setOpen(true);
    };
    const openFromCta = () => setOpen(true);
    window.addEventListener("hashchange", openFromHashChange);
    window.addEventListener("open-pilot-dialog", openFromCta);
    return () => {
      window.removeEventListener("hashchange", openFromHashChange);
      window.removeEventListener("open-pilot-dialog", openFromCta);
    };
  }, [sectionId]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeDialog, open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const landingPath = window.location.pathname;
    captureUtmAttribution();
    trackClientEvent("pilot_application_started", { cta_location: ctaLocation, landing_path: landingPath, landing_variant: landingVariant });
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/beta/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(values.get("name") ?? ""),
          email: String(values.get("email") ?? ""),
          metadata: {
            ...getAttributionEventParams(),
            landing_path: landingPath,
            landing_variant: landingVariant,
            cta_location: ctaLocation,
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setStatus("error");
        setMessage(payload?.error ?? "No se pudo enviar la solicitud.");
        return;
      }

      setStatus("success");
      setMessage("Recibimos tu solicitud. El equipo revisará el acceso y te contactará por correo.");
      trackClientEvent("pilot_application_submitted", { cta_location: ctaLocation, landing_path: landingPath, landing_variant: landingVariant });
      form.reset();
    } catch {
      setStatus("error");
      setMessage("No pudimos conectar con el servidor. Intenta nuevamente.");
    }
  }

  return (
    <>
      <section id={sectionId} className="hidden" aria-hidden="true" />
      {open ? <section className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-8 backdrop-blur-sm sm:px-6 md:py-12" role="dialog" aria-modal="true" aria-labelledby={`${sectionId}-title`}>
        <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Cerrar formulario de evaluación" onClick={closeDialog} />
        <div className="relative mx-auto max-w-5xl rounded-[2rem] bg-blue-50/95 shadow-2xl">
          <button type="button" onClick={closeDialog} className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-950" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          <div className="grid gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-8">
        <div>
          <span className="inline-flex rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</span>
          <h2 id={`${sectionId}-title`} className="mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{description}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Benefit text="Evaluación guiada del producto" />
            <Benefit text="Conversación sobre tus necesidades" />
            <Benefit text="Revisión individual de cada solicitud" />
            <Benefit text="Tu información no se publica" />
          </div>
        </div>
        <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(37,99,235,0.45)]">
          <div className="mb-6 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold text-slate-950">{formTitle}</p>
              <p className="text-xs text-slate-500">{formSubtitle}</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`${sectionId}-name`}>Nombre</Label>
              <Input aria-label="Nombre" id={`${sectionId}-name`} name="name" autoComplete="name" placeholder="Ing. María Calderón" required minLength={2} maxLength={120} disabled={status === "submitting"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${sectionId}-email`}>Email</Label>
              <Input aria-label="Email" id={`${sectionId}-email`} name="email" type="email" autoComplete="email" placeholder="tu@empresa.com" required disabled={status === "submitting"} />
            </div>
            {status === "success" ? <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{message}</p> : null}
            {status === "error" ? <p className="rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700">{message}</p> : null}
            <Button type="submit" className="w-full gap-2" disabled={status === "submitting"}>
              {status === "submitting" ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</> : submitLabel}
            </Button>
            <p className="text-xs leading-5 text-slate-500">Al enviar aceptas que usemos estos datos únicamente para revisar y coordinar el acceso piloto.</p>
          </form>
        </div>
          </div>
        </div>
      </section> : null}
    </>
  );
}

function Benefit({ text }: { text: string }) {
  return <p className="flex items-start gap-2 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{text}</p>;
}
