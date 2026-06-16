import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { landingV2NavItems } from "@/components/landing-v2/landing-v2-content";
import { LandingV2Button } from "@/components/landing-v2/landing-v2-button";

export function LandingV2Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#222222] bg-[#0f0f0f]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-4 sm:px-6 xl:px-0">
        <Link href="/" className="flex items-center gap-3" aria-label="MYC Presupuestos">
          <Image
            src="/nuevo-logo-white-300-v3.png"
            alt="MYC Presupuestos"
            width={132}
            height={43}
            priority
            className="h-9 w-auto object-contain sm:h-10"
          />
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Navegacion principal">
          {landingV2NavItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-[#a8a8a8] transition hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LandingV2Button href="/login" variant="secondary" className="hidden sm:inline-flex">
            Ingresar
          </LandingV2Button>
          <LandingV2Button href="/register" className="hidden sm:inline-flex">
            Solicitar acceso
          </LandingV2Button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#333333] text-white md:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
