import { Star } from "lucide-react";
import { testimonials } from "@/components/landing/landing-content";
import { SectionHeading } from "@/components/landing/section-heading";

export function TestimonialsSection() {
  return (
    <section id="testimonios" className="mx-auto max-w-[1440px] scroll-mt-28 px-4 py-20 sm:px-6 md:py-28 lg:px-8 xl:px-12">
      <SectionHeading
        badge="Testimonios"
        title="Profesionales que buscan menos hojas sueltas y más control técnico."
        description="Historias breves de profesionales que necesitan velocidad, trazabilidad y menos dependencia de hojas dispersas."
        align="center"
      />
      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {testimonials.map((testimonial) => {
          const initials = testimonial.name
            .split(" ")
            .slice(-2)
            .map((part) => part[0])
            .join("");

          return (
            <article
              key={testimonial.name}
              className="landing-surface-elevated group relative overflow-hidden rounded-[1.75rem] p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_28px_80px_-46px_rgba(37,99,235,0.22)]"
            >
              <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.1),transparent_62%)] opacity-70" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={`${testimonial.name}-${index}`} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <span className="rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-slate-400 uppercase">
                  Verificado
                </span>
              </div>
              <p className="relative mt-6 text-base leading-8 text-slate-700">
                {"\""}
                {testimonial.quote}
                {"\""}
              </p>
              <div className="relative mt-8 h-px bg-[linear-gradient(90deg,rgba(37,99,235,0.18),rgba(226,232,240,0.6),transparent)]" />
              <div className="relative mt-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)] text-sm font-semibold text-blue-700 shadow-sm shadow-blue-100/70">
                  {initials}
                </div>
                <div>
                  <p className="font-display text-base font-semibold tracking-tight text-slate-950">{testimonial.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{testimonial.role}</p>
                  <p className="text-sm text-slate-400">{testimonial.company}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
