"use client";

import { Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MetradoTemplateRecord, MetradoTemplateType } from "@/types/metrado";

type MetradoTemplateSelectorProps = {
  templates: MetradoTemplateRecord[];
  value: MetradoTemplateType;
  disabled?: boolean;
  onChange: (value: MetradoTemplateType) => void;
};

export function MetradoTemplateSelector({
  templates,
  value,
  disabled = false,
  onChange,
}: MetradoTemplateSelectorProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {templates.map((template) => {
        const selected = template.type === value;

        return (
          <Button
            key={template.type}
            type="button"
            variant="outline"
            className={cn(
              "h-auto min-h-20 justify-start rounded-xl border-slate-200 bg-white p-3 text-left",
              selected && "border-sky-500 bg-sky-50 text-sky-900 shadow-[0_12px_28px_-22px_rgba(37,99,235,0.65)]",
            )}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(template.type)}
          >
            <span className="flex min-w-0 items-start gap-2">
              <Layers3 className={cn("mt-0.5 h-4 w-4 shrink-0 text-slate-400", selected && "text-sky-600")} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{template.name}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <Badge className={cn(selected && "bg-white text-sky-700")}>{template.defaultUnit}</Badge>
                  <span className="truncate">{template.formulas[0]?.label ?? "Manual"}</span>
                </span>
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
