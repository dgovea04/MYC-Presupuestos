"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AiViewContextProvider } from "@/components/ai/ai-view-context";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";

const HIDDEN_EXACT_ROUTES = new Set(["/", "/login", "/register"]);
const HIDDEN_ROUTE_PREFIXES = ["/landing"] as const;

export function GlobalAiAssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visible = pathname ? !isHiddenAssistantRoute(pathname) : false;

  return (
    <AiViewContextProvider>
      {children}
      {visible ? <FloatingAiAssistant open={open} onOpenChange={setOpen} /> : null}
    </AiViewContextProvider>
  );
}

function isHiddenAssistantRoute(pathname: string) {
  return HIDDEN_EXACT_ROUTES.has(pathname) || HIDDEN_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}-`));
}
