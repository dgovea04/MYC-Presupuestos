import { SectionHeading } from "@/components/landing/section-heading";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { BotMessageSquare, Send } from "lucide-react";

const SAMPLE_MESSAGES = [
  {
    role: "assistant",
    text: "¡Hola! Soy Khipu. Puedo ayudarte a analizar presupuestos, revisar APU, comparar alternativas y generar recomendaciones técnicas. ¿Qué quieres revisar hoy?",
  },
  {
    role: "user",
    text: "Revisa este presupuesto y dime qué partidas requieren atención.",
  },
  {
    role: "assistant",
    text: "He revisado el presupuesto. Detecto que la partida 03.04 Encofrado tiene un costo unitario alto en comparación con partidas similares del catálogo. También hay una inconsistencia de unidades en la partida 05.02 donde usaste m2 pero el metrado indica m3. ¿Necesitas que desglose cada observación?",
  },
];

export function KhipuChatPreview() {
  return (
    <section className="landing-section landing-shell scroll-mt-28">
      <SectionHeading
        badge="Vista previa"
        title="Así se ve Khipu dentro de MC Presupuestos."
        description="Chat técnico con contexto real del proyecto, sugerencias claras y lenguaje de obra."
        align="center"
      />
      <div className="mx-auto mt-14 max-w-2xl">
        {/* Mock chat panel */}
        <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/8">
          {/* Chat header */}
          <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <KhipuSymbol className="h-8 w-8" />
            <div>
              <p className="font-display text-sm font-semibold text-slate-950">
                Khipu IA
              </p>
              <p className="text-xs text-slate-500">
                Tu asistente en MC Presupuestos
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              <BotMessageSquare className="h-3 w-3 text-cyan-600" />
              Activo
            </span>
          </header>

          {/* Messages */}
          <div className="space-y-4 px-5 py-5">
            {SAMPLE_MESSAGES.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2563EB,#06CFE3)]">
                    <KhipuSymbol className="h-4 w-4 invert" />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                    U
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                    msg.role === "assistant"
                      ? "bg-[linear-gradient(180deg,#f8fbff_0%,#f0f7ff_100%)] border border-blue-100 text-slate-800"
                      : "bg-khipu-blue text-white"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <span className="text-sm text-slate-400">
                Escribe tu consulta técnica...
              </span>
              <Send className="ml-auto h-4 w-4 text-khipu-blue" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
