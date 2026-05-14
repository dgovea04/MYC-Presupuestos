import Link from "next/link";
import { footerLinks } from "@/components/landing/landing-content";
import { LandingLogo } from "@/components/landing/landing-logo";

const footerLinkMap: Record<string, string> = {
  Presupuestos: "#features",
  APU: "#features",
  "Fórmula polinómica": "#features",
  Reportes: "#preview",
  Nosotros: "#comparison",
  Clientes: "#comparison",
  Seguridad: "#pricing",
  Contacto: "#contacto",
  Demo: "#preview",
  "Guía de inicio": "/register",
  "Casos de uso": "#comparison",
  Soporte: "#contacto",
};

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-display text-sm font-semibold text-slate-950">{title}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item}>
            <Link href={footerLinkMap[item] ?? "/"} className="text-sm text-slate-500 transition hover:text-slate-900">
              {item}
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
            Plataforma moderna de costos y presupuestos de obra para ingenieros, contratistas y oficinas técnicas.
          </p>
          <p className="mt-6 text-sm text-slate-400">&copy; 2026 MYC Presupuestos. Todos los derechos reservados.</p>
        </div>
        <FooterColumn title="Producto" items={footerLinks.producto} />
        <FooterColumn title="Empresa" items={footerLinks.empresa} />
        <FooterColumn title="Recursos" items={footerLinks.recursos} />
      </div>
    </footer>
  );
}
