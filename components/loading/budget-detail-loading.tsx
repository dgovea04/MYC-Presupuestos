"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BudgetDetailPageSkeleton,
  BudgetSubBudgetPageSkeleton,
} from "@/components/loading/budget-detail-page-skeleton";

type BudgetKind = "GENERAL" | "SUB_BUDGET";

type BudgetKindResponse = {
  kind?: BudgetKind;
};

export function BudgetDetailLoading() {
  const params = useParams<{ id?: string }>();
  const budgetId = params?.id;
  const [kind, setKind] = useState<BudgetKind | null>(null);

  useEffect(() => {
    if (!budgetId) return;

    const controller = new AbortController();

    async function resolveBudgetKind() {
      try {
        const response = await fetch(`/api/budgets/${budgetId}/kind`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const payload = (await response.json()) as BudgetKindResponse;
        if (payload.kind === "GENERAL" || payload.kind === "SUB_BUDGET") {
          setKind(payload.kind);
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Keep the neutral skeleton while the route itself resolves.
      }
    }

    void resolveBudgetKind();
    return () => controller.abort();
  }, [budgetId]);

  if (kind === "SUB_BUDGET") return <BudgetSubBudgetPageSkeleton />;
  if (kind === "GENERAL") return <BudgetDetailPageSkeleton />;
  return <BudgetDetailPageSkeleton />;
}
