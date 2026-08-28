"use client";

const APP_DATA_CHANGE_KEY = "myc:app-data-change";
const APP_DATA_CHANGE_EVENT = "myc:app-data-change";

export type BudgetLiveUpdateSummary = {
  id: string;
  projectId: string;
  parentBudgetId?: string | null;
  name: string;
  kind: "GENERAL" | "SUB_BUDGET";
  currency: string;
  totalAmount: number;
  updatedAt: string;
};

export type MetradoLiveUpdateSummary = {
  itemId: string;
  projectId: string;
  budgetId: string;
  quantity: number;
  isAdvanced: boolean;
};

export type AiUsageLiveUpdateSummary = {
  userId: string;
  consumedTokens: number;
};

export type AppDataChangePayload = {
  paths: string[];
  metrados?: MetradoLiveUpdateSummary[];
  occurredAt: number;
  budgets?: BudgetLiveUpdateSummary[];
  locallyHandledPaths?: string[];
  aiUsage?: AiUsageLiveUpdateSummary;
};

export function broadcastAppDataChange(
  paths: string[],
  budgets?: BudgetLiveUpdateSummary[],
  options?: { locallyHandledPaths?: string[]; metrados?: MetradoLiveUpdateSummary[]; aiUsage?: AiUsageLiveUpdateSummary },
) {
  const payload: AppDataChangePayload = {
    paths,
    occurredAt: Date.now(),
    budgets,
    metrados: options?.metrados,
    locallyHandledPaths: options?.locallyHandledPaths,
    aiUsage: options?.aiUsage,
  };

  try {
    localStorage.setItem(APP_DATA_CHANGE_KEY, JSON.stringify(payload));
  } catch {}

  window.dispatchEvent(new CustomEvent<AppDataChangePayload>(APP_DATA_CHANGE_EVENT, { detail: payload }));
}

export function getAppDataChangeStorageKey() {
  return APP_DATA_CHANGE_KEY;
}

export function getAppDataChangeEventName() {
  return APP_DATA_CHANGE_EVENT;
}
