import Link from "next/link";
import { LandingContactDialog } from "@/components/landing/landing-contact-dialog";
import { LandingLogo } from "@/components/landing/landing-logo";

const footerColumns = {
  producto: [
    { label: "Diferenciales", href: "#features" },
    { label: "Khipu IA", href: "#khipu" },
    { label: "Espacio de trabajo", href: "#workspace" },
    { label: "Flujo conectado", href: "#flows" },
    { label: "Vista del producto", href: "#preview" },
  ],
  empresa: [
    { label: "Comparación", href: "#comparison" },
    { label: "Beneficios", href: "#benefits" },
    { label: "Testimonios", href: "#testimonios" },
    { label: "Contacto", href: "#contacto" },
  ],
  recursos: [
    { label: "Preguntas frecuentes", href: "#faq" },
    { label: "Precios", href: "#pricing" },
    { label: "Crear cuenta", href: "/register" },
    { label: "Iniciar sesion", href: "/login" },
  ],
};

function FooterColumn({ title, items }: { title: string; items: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <p className="font-display text-sm font-semibold text-slate-950">{title}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className="text-sm text-slate-500 transition hover:text-slate-900">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer id="contacto" className="scroll-mt-28 border-t border-slate-200/80 bg-white">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_repeat(3,0.7fr)] lg:px-8 xl:px-12">
        <div>
          <LandingLogo />
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-500">
            Plataforma moderna de costos y presupuestos de obra para oficinas tecnicas, constructoras e ingenieros que necesitan un flujo mas conectado.
          </p>
          <div className="mt-6">
            <LandingContactDialog triggerLabel="Contactar al equipo" triggerVariant="primary" />
          </div>
          <p className="mt-6 text-sm text-slate-400">&copy; 2026 MC Presupuestos. Todos los derechos reservados.</p>
        </div>
        <FooterColumn title="Producto" items={footerColumns.producto} />
        <FooterColumn title="Empresa" items={footerColumns.empresa} />
        <FooterColumn title="Recursos" items={footerColumns.recursos} />
      </div>
    </footer>
  );
}
