"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, MessageSquareMore } from "lucide-react";
import { LandingContactDialog } from "@/components/landing/landing-contact-dialog";
import { faqItems } from "@/components/landing/landing-content";
import { SectionHeading } from "@/components/landing/section-heading";
import { cn } from "@/lib/utils";

const faqCategories = [
  { label: "Generales", filter: () => true },
  { label: "Planes y precios", filter: (q: string) => q.includes("plan") || q.includes("gratuito") || q.includes("soporte") || q.includes("exportación") },
  { label: "Técnicas", filter: (q: string) => q.includes("norma") || q.includes("Excel") || q.includes("fórmula") || q.includes("segur") },
];

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="landing-surface-elevated rounded-[1.35rem] transition duration-300 hover:border-blue-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
          <span className="text-[0.95rem] font-semibold leading-7 text-slate-950">{question}</span>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300",
            isOpen && "rotate-180 text-blue-600",
          )}
        />
      </button>
      <div
        className={cn(
          "grid overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="px-6 text-[0.93rem] leading-7 text-slate-600">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqItems[0].question);
  const [activeCategory, setActiveCategory] = useState(faqCategories[0].label);

  const filteredFaq = faqItems.filter((item) => {
    const category = faqCategories.find((currentCategory) => currentCategory.label === activeCategory);
    return category ? category.filter(item.question) : true;
  });

  function handleCategoryChange(category: string) {
    setActiveCategory(category);
    setOpenQuestion(null);
  }

  return (
    <section id="faq" className="landing-section landing-shell scroll-mt-28 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]">
      <SectionHeading
        badge="Preguntas frecuentes"
        title="Respuestas directas para empezar con confianza."
        description="Si tienes otra duda, escríbenos. Preferimos responder antes que dejar una pregunta sin atender."
        align="center"
      />

      <div className="mx-auto mt-10 grid max-w-6xl gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div className="landing-surface-elevated rounded-[1.5rem] p-6 sm:p-7">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <MessageSquareMore className="h-5 w-5" />
          </div>
          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
            Respuestas para evaluar tu próximo flujo técnico.
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Encuentra respuestas sobre planes, migración, seguridad, IA y soporte. Si tu caso requiere una revisión más específica, puedes contactarnos y coordinamos una demo guiada.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {faqCategories.map((category) => (
              <button
                key={category.label}
                type="button"
                onClick={() => handleCategoryChange(category.label)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  activeCategory === category.label
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
                )}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-[1.25rem] border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] p-5">
            <p className="text-sm font-semibold text-slate-900">¿No encontraste lo que buscabas?</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Te respondemos en menos de 24 horas y también podemos coordinar una demo guiada para tu equipo.
            </p>
            <div className="mt-4">
              <LandingContactDialog triggerLabel="Abrir formulario" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {filteredFaq.map((item) => (
            <FaqItem
              key={item.question}
              question={item.question}
              answer={item.answer}
              isOpen={openQuestion === item.question}
              onToggle={() => setOpenQuestion(openQuestion === item.question ? null : item.question)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
