"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, Mail, MessageSquare, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type LandingContactDialogProps = {
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "primary" | "secondary";
  title?: string;
  description?: string;
};

type ContactResponse = {
  ok?: boolean;
  error?: string;
};

const triggerVariantClasses: Record<NonNullable<LandingContactDialogProps["triggerVariant"]>, string> = {
  primary:
    "bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] text-white shadow-[0_12px_30px_-12px_rgba(37,99,235,0.55)] hover:shadow-[0_16px_40px_-16px_rgba(37,99,235,0.6)] hover:opacity-95",
  secondary: "border border-slate-200/90 bg-white/90 text-slate-900 shadow-sm shadow-slate-200/70 hover:bg-slate-50",
};

const baseTriggerClasses =
  "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

export function LandingContactDialog({
  triggerLabel = "Contactar",
  triggerClassName,
  triggerVariant = "secondary",
  title = "Conversemos sobre tu flujo de presupuestos",
  description = "Cuéntanos qué tipo de proyectos manejas y te respondemos para coordinar una demo o resolver tus dudas.",
}: LandingContactDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json().catch(() => null)) as ContactResponse | null;

      if (!response.ok || !data?.ok) {
        setErrorMessage(data?.error ?? "No pudimos enviar tu mensaje. Inténtalo nuevamente.");
        return;
      }

      setForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        message: "",
      });
      setSuccessMessage("Mensaje enviado. Te responderemos pronto.");
    } catch {
      setErrorMessage("No pudimos enviar tu mensaje. Inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setErrorMessage("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(baseTriggerClasses, triggerVariantClasses[triggerVariant], triggerClassName)}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-labelledby={titleId} aria-describedby={descriptionId} role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            aria-label="Cerrar formulario de contacto"
            onClick={handleClose}
          />

          <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_32px_80px_-28px_rgba(15,23,42,0.38)]">
            <div className="grid gap-0 md:grid-cols-[0.95fr_1.25fr]">
              <div className="bg-[linear-gradient(180deg,#0f172a_0%,#1e3a8a_100%)] px-6 py-7 text-white sm:px-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-100">
                  Contacto
                </div>
                <h3 id={titleId} className="mt-5 text-2xl font-semibold tracking-tight">
                  {title}
                </h3>
                <p id={descriptionId} className="mt-3 text-sm leading-7 text-blue-50/88">
                  {description}
                </p>

                <div className="mt-8 space-y-4 text-sm text-blue-50/92">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
                    <p>Ideal para consultas comerciales, demos guiadas o evaluación técnica del flujo actual.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
                    <p>Cuanto más contexto compartas, mejor podremos orientarte sobre módulos, importaciones y plan recomendado.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-blue-200" />
                    <p>Si prefieres llamada, deja tu teléfono y el horario que mejor le funciona a tu equipo.</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-7 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Formulario rápido</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">Te escribimos en menos de 24 horas hábiles.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="landing-contact-name" className="mb-2 block text-sm font-medium text-slate-700">
                        Nombre
                      </label>
                      <Input
                        id="landing-contact-name"
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Ing. María Torres"
                        required
                        className="border-slate-200 bg-white text-slate-950 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="landing-contact-email" className="mb-2 block text-sm font-medium text-slate-700">
                        Correo
                      </label>
                      <Input
                        id="landing-contact-email"
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        placeholder="tu@empresa.com"
                        required
                        className="border-slate-200 bg-white text-slate-950 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="landing-contact-company" className="mb-2 block text-sm font-medium text-slate-700">
                        Empresa
                      </label>
                      <Input
                        id="landing-contact-company"
                        value={form.company}
                        onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                        placeholder="Constructora Andina"
                        className="border-slate-200 bg-white text-slate-950 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="landing-contact-phone" className="mb-2 block text-sm font-medium text-slate-700">
                        Teléfono
                      </label>
                      <Input
                        id="landing-contact-phone"
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                        placeholder="+51 999 999 999"
                        className="border-slate-200 bg-white text-slate-950 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="landing-contact-message" className="mb-2 block text-sm font-medium text-slate-700">
                      ¿Qué necesitas resolver?
                    </label>
                    <Textarea
                      id="landing-contact-message"
                      value={form.message}
                      onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                      placeholder="Queremos evaluar importación desde S10, flujo de APU y cronograma para nuestro equipo."
                      required
                      className="min-h-32 border-slate-200 bg-white text-slate-950 focus:border-blue-500"
                    />
                  </div>

                  {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
                  {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-slate-500">
                      Al enviar, usaremos esta información solo para responder tu consulta.
                    </p>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full min-w-44 whitespace-nowrap px-6 bg-blue-600 hover:bg-blue-700 sm:w-auto"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar mensaje"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
