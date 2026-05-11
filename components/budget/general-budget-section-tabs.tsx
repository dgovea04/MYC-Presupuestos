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
          onClick={() => router.push(`/budgets/${budgetId}/${section.href}`)}
          className={cn(
            "inline-flex rounded-full border px-3 py-1.5 text-sm transition",
            section.id === activeSection
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50",
          )}
        >
          {section.label}
        </button>
      ))}
    </>
  );
}
