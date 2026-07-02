"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type SectionTab = {
  id: string;
  label: string;
  href: string;
};

export function GeneralBudgetSectionTabs({
  budgetId,
  activeSection,
  sections,
}: {
  budgetId: string;
  activeSection: string;
  sections: readonly SectionTab[];
}) {
  const router = useRouter();

  return (
    <>
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => router.push(`/budgets/${budgetId}/${section.href}`, { scroll: false })}
          className={cn(
            "inline-flex rounded-full border px-3 py-1.5 text-sm transition",
            section.id === activeSection
              ? "theme-filter-button-active"
              : "theme-filter-button-inactive",
          )}
        >
          {section.label}
        </button>
      ))}
    </>
  );
}
