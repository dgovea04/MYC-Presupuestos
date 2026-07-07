"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AiViewContextProvider, type AiViewContextValue } from "@/components/ai/ai-view-context";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";

const HIDDEN_EXACT_ROUTES = new Set(["/", "/login", "/register"]);
const HIDDEN_ROUTE_PREFIXES = ["/landing"] as const;
const MODULE_HINTS: Record<string, string> = {
  apu: "APU",
  budgets: "Presupuestos",
  cronograma: "Cronograma",
  dashboard: "Dashboard",
  formulas: "Formulas",
  metrados: "Metrados",
  presupuesto: "Presupuesto",
  presupuestos: "Presupuestos",
  projects: "Proyecto",
  reportes: "Reportes",
  resources: "Recursos",
};

export function GlobalAiAssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visible = pathname ? !isHiddenAssistantRoute(pathname) : false;
  const viewContext = pathname ? deriveAiViewContext(pathname) : {};

  return (
    <AiViewContextProvider value={viewContext}>
      {children}
      {visible ? <FloatingAiAssistant open={open} onOpenChange={setOpen} /> : null}
      <Toaster position="bottom-right" richColors closeButton />
    </AiViewContextProvider>
  );
}

function isHiddenAssistantRoute(pathname: string) {
  return HIDDEN_EXACT_ROUTES.has(pathname) || HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}-`));
}

function deriveAiViewContext(pathname: string): AiViewContextValue {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return {};
  }

  const projectIndex = segments.indexOf("projects");
  const projectId = projectIndex >= 0 ? segments[projectIndex + 1] : undefined;
  const moduleSegment = resolveModuleSegment(segments, projectIndex);
  const moduleHint = moduleSegment ? MODULE_HINTS[moduleSegment] ?? toTitleCase(moduleSegment) : undefined;

  return {
    module: moduleHint,
    project: projectId,
    projectId,
  };
}

function resolveModuleSegment(segments: string[], projectIndex: number) {
  if (projectIndex >= 0) {
    return segments[projectIndex + 2] ?? segments[projectIndex];
  }

  return segments[0];
}

function toTitleCase(segment: string) {
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
