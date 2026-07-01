"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useTransition } from "react";

import { cn } from "@/lib/utils";
import type { PolynomialFormulaSectionData, PolynomialFormulaSectionTab } from "@/types/budget-sections";

export function PolynomialFormulaSectionTabs({
  budgetId,
  activeSection,
  sections,
}: {
  budgetId: string;
  activeSection: Pick<PolynomialFormulaSectionData, "budgetId" | "title"> | null;
  sections: PolynomialFormulaSectionTab[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeSectionIndex = useMemo(
    () => sections.findIndex((section) => section.budgetId === activeSection?.budgetId),
    [activeSection?.budgetId, sections],
  );

  const buildSectionHref = useCallback(
    (section: PolynomialFormulaSectionTab) => {
      const sectionId = section.budgetId ?? section.title;
      return `/budgets/${budgetId}/polynomial-formula?section=${encodeURIComponent(sectionId)}`;
    },
    [budgetId],
  );

  const prefetchSection = useCallback(
    (section: PolynomialFormulaSectionTab) => {
      router.prefetch(buildSectionHref(section));
    },
    [buildSectionHref, router],
  );

  const navigateToSection = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  useEffect(() => {
    if (sections.length <= 1) {
      return;
    }

    const neighborSections = [
      activeSectionIndex > 0 ? sections[activeSectionIndex - 1] : null,
      activeSectionIndex >= 0 && activeSectionIndex < sections.length - 1 ? sections[activeSectionIndex + 1] : null,
    ].filter((section): section is PolynomialFormulaSectionTab => Boolean(section));

    for (const section of neighborSections) {
      prefetchSection(section);
    }
  }, [activeSectionIndex, prefetchSection, sections]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="theme-muted-text text-xs uppercase tracking-[0.2em]">Sub Presupuestos</span>
      {sections.map((section) => {
        const sectionId = section.budgetId ?? section.title;
        const href = buildSectionHref(section);
        const isActive = activeSection?.budgetId === section.budgetId;

        return (
          <Link
            key={sectionId}
            href={href}
            prefetch
            onMouseEnter={() => prefetchSection(section)}
            onFocus={() => prefetchSection(section)}
            onClick={(event) => {
              event.preventDefault();
              navigateToSection(href);
            }}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
              isActive ? "theme-filter-button-active" : "theme-filter-button-inactive",
              isPending ? "opacity-80" : undefined,
            )}
          >
            <span>{section.title.replace(/^Formula polinomica - /, "")}</span>
            <span className="text-xs opacity-75">{section.summary.monomialCount} monomios</span>
          </Link>
        );
      })}
    </div>
  );
}
