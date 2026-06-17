"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AiViewContextProvider } from "@/components/ai/ai-view-context";
import { FloatingAiAssistant } from "@/components/ai/floating-ai-assistant";

const HIDDEN_ROUTES = new Set(["/login", "/register"]);

export function GlobalAiAssistantProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hidden = pathname ? HIDDEN_ROUTES.has(pathname) : false;

  return (
    <AiViewContextProvider>
      {children}
      {hidden ? null : <FloatingAiAssistant open={open} onOpenChange={setOpen} />}
    </AiViewContextProvider>
  );
}
