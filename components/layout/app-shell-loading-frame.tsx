import type { ReactNode } from "react";

export function AppShellLoadingFrame({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
