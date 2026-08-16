"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AcquisitionCta } from "@/components/landing/acquisition/acquisition-cta";
import { acquisitionNavItems } from "@/components/landing/acquisition/acquisition-landing-content";
import { LandingLogo } from "@/components/landing/landing-logo";
import { cn } from "@/lib/utils";

type AcquisitionNavbarItem = {
  label: string;
  href: string;
};

export type AcquisitionNavbarProps = {
  homeHref?: string;
  navItems?: readonly AcquisitionNavbarItem[];
  primaryHref?: string;
  primaryLabel?: string;
  primaryLocation?: string;
};

export function AcquisitionNavbar({
  homeHref = "/software-presupuestos-construccion",
  navItems = acquisitionNavItems,
  primaryHref = "/register",
  primaryLabel = "Crear cuenta gratis",
  primaryLocation = "acquisition_navbar",
}: AcquisitionNavbarProps = {}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-all duration-300",
        isScrolled || mobileMenuOpen
          ? "border-b border-slate-200/80 bg-white/92 shadow-sm shadow-slate-200/60 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="landing-shell flex items-center justify-between gap-8 py-5">
        <Link href={homeHref} aria-label="MC Presupuestos">
          <LandingLogo />
        </Link>

        <nav className="hidden items-center gap-10 md:flex lg:gap-14 xl:gap-16" aria-label="Navegación de adquisición">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex lg:gap-5">
          <AcquisitionCta href="/login" location="acquisition_navbar_login" variant="secondary" className="px-4 py-2.5">
            Iniciar sesión
          </AcquisitionCta>
          <AcquisitionCta href={primaryHref} location={primaryLocation} className="px-4 py-2.5">
            {primaryLabel}
          </AcquisitionCta>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex items-center justify-center rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:hidden"
          aria-label="Abrir navegación"
          aria-expanded={mobileMenuOpen}
          aria-controls="acquisition-mobile-navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div
        className={cn("fixed inset-0 z-40 md:hidden", mobileMenuOpen ? "visible" : "invisible")}
        aria-hidden={!mobileMenuOpen}
      >
        <div
          className={cn(
            "absolute inset-0 h-screen bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300",
            mobileMenuOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileMenuOpen(false)}
        />

        <div
          id="acquisition-mobile-navigation"
          className={cn(
            "absolute inset-y-0 right-0 flex h-screen w-full max-w-xs flex-col bg-white px-6 py-6 shadow-2xl transition-transform duration-300 ease-in-out",
            mobileMenuOpen ? "translate-x-0" : "translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
        >
          <div className="flex items-center justify-between">
            <Link href={homeHref} onClick={() => setMobileMenuOpen(false)} aria-label="MC Presupuestos">
              <LandingLogo />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-10 flex flex-col gap-1" aria-label="Navegación móvil">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-4 py-3.5 text-base font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 space-y-4 border-t border-slate-100 pt-8">
            <AcquisitionCta
              href="/login"
              location="acquisition_mobile_nav_login"
              variant="secondary"
              className="w-full justify-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              Iniciar sesión
            </AcquisitionCta>
            <AcquisitionCta
              href={primaryHref}
              location={primaryLocation}
              className="w-full justify-center"
              onClick={() => setMobileMenuOpen(false)}
            >
              {primaryLabel}
            </AcquisitionCta>
          </div>
        </div>
      </div>
    </header>
  );
}
