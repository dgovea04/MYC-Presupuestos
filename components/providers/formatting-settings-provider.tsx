"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_EXCEL_ROW_HEIGHT,
  DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
  DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  DEFAULT_VIEW_MODE,
  type UserSettingsRecord,
} from "@/types/settings";

const defaultFormattingSettings: UserSettingsRecord = {
  defaultCurrency: "PEN",
  currencyDecimals: 2,
  dateFormat: DEFAULT_DATE_FORMAT,
  defaultViewMode: DEFAULT_VIEW_MODE,
  excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
  excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
  defaultIgvRate: 0.18,
  defaultGeneralExpensesRate: 0.1,
  defaultUtilityRate: 0.08,
  defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
};

const FormattingSettingsContext = createContext<UserSettingsRecord>(defaultFormattingSettings);

export function FormattingSettingsProvider({
  children,
  settings,
}: {
  children: ReactNode;
  settings: UserSettingsRecord;
}) {
  return <FormattingSettingsContext.Provider value={settings}>{children}</FormattingSettingsContext.Provider>;
}

export function useFormattingSettings() {
  return useContext(FormattingSettingsContext);
}
