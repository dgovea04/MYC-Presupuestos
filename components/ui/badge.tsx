import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600", className)}>{children}</span>;
}
