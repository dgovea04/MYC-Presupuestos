"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Circle, Menu, X } from "lucide-react";
import { LandingLinkButton } from "@/components/landing/landing-link-button";
import { LandingLogo } from "@/components/landing/landing-logo";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Diferenciales", href: "#features" },
  { label: "Khipu IA", href: "#khipu" },
  { label: "Vista", href: "#preview" },
  { label: "Comparacion", href: "#comparison" },
  { label: "Precios", href: "#pricing" },
] as const;

const dialogFocusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useActiveSection(sectionIds: string[]) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((entry) => entry.isIntersecting);
        if (intersecting.length === 0) {
          return;
        }

        const topmost = intersecting.sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        setActiveId(topmost.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
}

export function LandingNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousMobileMenuOpenRef = useRef(false);
  const sectionIds = navItems.map((item) => item.href.slice(1));
  const activeSection = useActiveSection(sectionIds);

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

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      closeButtonRef.current?.focus();
    } else {
      document.body.style.overflow = "";
      if (previousMobileMenuOpenRef.current) {
        triggerRef.current?.focus();
      }
    }

    previousMobileMenuOpenRef.current = mobileMenuOpen;

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const closeMobileMenu = () => {
      setMobileMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(dialogFocusableSelector);
      if (!focusableElements || focusableElements.length === 0) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
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
        <Link href="/" aria-label="MC Presupuestos">
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

        <div className="hidden items-center gap-4 md:flex lg:gap-5">
          <LandingLinkButton href="/login" variant="secondary">
            Iniciar sesion
          </LandingLinkButton>
          <LandingLinkButton href="/register">Crear cuenta gratis</LandingLinkButton>
        </div>

        <button
          type="button"
          ref={triggerRef}
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex items-center justify-center rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 md:hidden"
          aria-label="Abrir menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="landing-mobile-navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className={cn("fixed inset-0 z-40 md:hidden", mobileMenuOpen ? "visible" : "invisible")} aria-hidden={!mobileMenuOpen}>
        <div
          className={cn(
            "absolute inset-0 h-screen bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300",
            mobileMenuOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileMenuOpen(false)}
        />

        <div
          id="landing-mobile-navigation"
          ref={dialogRef}
          className={cn(
            "absolute inset-y-0 right-0 flex h-screen w-full max-w-xs flex-col bg-white px-6 py-6 shadow-2xl transition-transform duration-300 ease-in-out",
            mobileMenuOpen ? "translate-x-0" : "translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegacion"
        >
          <div className="flex items-center justify-between">
            <LandingLogo />
            <button
              type="button"
              ref={closeButtonRef}
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              aria-label="Cerrar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-10 flex flex-col gap-1">
            {navItems.map((item) => {
              const sectionId = item.href.slice(1);
              const isActive = activeSection === sectionId;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition",
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                  )}
                >
                  {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-blue-600" />}
                  <Circle
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 fill-current transition",
                      isActive ? "text-blue-600 opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 space-y-4 border-t border-slate-100 pt-8">
            <LandingLinkButton href="/login" variant="secondary" className="w-full justify-center">
              Iniciar sesion
            </LandingLinkButton>
            <LandingLinkButton href="/register" className="w-full justify-center">
              Crear cuenta gratis
            </LandingLinkButton>
          </div>
        </div>
      </div>
    </header>
  );
}
