"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { UserSettingsRecord } from "@/types/settings";

const defaultFormattingSettings: UserSettingsRecord = {
  currencyDecimals: 2,
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
