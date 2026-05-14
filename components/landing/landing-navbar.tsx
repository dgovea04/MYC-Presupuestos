"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LandingLinkButton } from "@/components/landing/landing-link-button";
import { LandingLogo } from "@/components/landing/landing-logo";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Producto", href: "#features" },
  { label: "Vista", href: "#preview" },
  { label: "Comparacion", href: "#comparison" },
  { label: "Precios", href: "#pricing" },
];

export function LandingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-all duration-300",
        isScrolled
          ? "border-b border-slate-200/80 bg-white/92 shadow-sm shadow-slate-200/60 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
        <Link href="/" aria-label="MYC Presupuestos">
          <LandingLogo />
        </Link>
        <nav className="hidden items-center gap-10 md:flex lg:gap-14 xl:gap-16">
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
        <div className="flex items-center gap-4 lg:gap-5">
          <LandingLinkButton href="/login" variant="secondary" className="hidden sm:inline-flex">
            Iniciar sesion
          </LandingLinkButton>
          <LandingLinkButton href="/register">Solicitar acceso</LandingLinkButton>
        </div>
      </div>
    </header>
  );
}
