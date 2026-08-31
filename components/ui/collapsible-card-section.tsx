"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CollapsibleCardSection({
  id,
  title,
  description,
  icon,
  children,
  className,
}: {
  id: string;
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = `${id}-contenido`;

  return (
    <section id={id}>
      <Card className={cn("theme-surface-card", className)}>
        <CardHeader className="p-0">
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
          >
            {icon}
            <div className="min-w-0 flex-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-5 w-5 shrink-0 text-[var(--app-text-muted)] transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </button>
        </CardHeader>
        <div id={contentId} hidden={!isExpanded}>
          <CardContent>{children}</CardContent>
        </div>
      </Card>
    </section>
  );
}
