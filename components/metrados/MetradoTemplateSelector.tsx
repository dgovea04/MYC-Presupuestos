"use client";

import { Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CustomMetradoFormulaRecord,
  MetradoTemplateRecord,
  MetradoTemplateType,
} from "@/types/metrado";

type MetradoTemplateSelectorProps = {
  templates: MetradoTemplateRecord[];
  value: MetradoTemplateType;
  customFormulaValue?: string | null;
  customFormulaSuggestions?: CustomMetradoFormulaRecord[];
  disabled?: boolean;
  onChange: (value: MetradoTemplateType) => void;
  onCustomFormulaChange?: (formula: CustomMetradoFormulaRecord) => void;
};

export function MetradoTemplateSelector({
  templates,
  value,
  customFormulaValue = null,
  customFormulaSuggestions = [],
  disabled = false,
  onChange,
  onCustomFormulaChange,
}: MetradoTemplateSelectorProps) {
  const regularTemplates = templates.filter((template) => template.type !== "CUSTOM");
  const customTemplate = templates.find((template) => template.type === "CUSTOM") ?? null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {regularTemplates.map((template) => {
        const selected = template.type === value;

        return (
          <Button
            key={template.type}
            type="button"
            variant="outline"
            className={cn(
              "h-auto min-h-20 justify-start rounded-xl border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-left text-[var(--app-text)]",
              selected && "border-sky-500 bg-[var(--app-primary-muted)] text-[var(--app-text-strong)] shadow-[0_12px_28px_-22px_rgba(37,99,235,0.65)]",
            )}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(template.type)}
          >
            <span className="flex min-w-0 items-start gap-2">
              <Layers3 className={cn("mt-0.5 h-4 w-4 shrink-0 text-[var(--app-text-subtle)]", selected && "text-sky-600")} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{template.name}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                  <Badge className={cn(selected && "bg-[var(--app-surface)] text-sky-700")}>{template.defaultUnit}</Badge>
                  <span className="truncate">{template.formulas[0]?.label ?? "Manual"}</span>
                </span>
              </span>
            </span>
          </Button>
        );
      })}
      {customFormulaSuggestions.map((formula) => {
        const selected = value === "CUSTOM" && customFormulaValue === formula.key;

        return (
          <Button
            key={formula.id}
            type="button"
            variant="outline"
            className={cn(
              "h-auto min-h-20 justify-start rounded-xl border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-left text-[var(--app-text)]",
              selected && "border-sky-500 bg-[var(--app-primary-muted)] text-[var(--app-text-strong)] shadow-[0_12px_28px_-22px_rgba(37,99,235,0.65)]",
            )}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onCustomFormulaChange?.(formula)}
          >
            <span className="flex min-w-0 items-start gap-2">
              <Layers3 className={cn("mt-0.5 h-4 w-4 shrink-0 text-[var(--app-text-subtle)]", selected && "text-sky-600")} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{formula.label}</span>
                <span className="mt-1 flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                  <Badge className={cn(selected && "bg-[var(--app-surface)] text-sky-700")}>{formula.resultUnit}</Badge>
                  <span className="truncate">{formatFormulaExpression(formula.expression)}</span>
                </span>
              </span>
            </span>
          </Button>
        );
      })}
      {customTemplate ? (
        <TemplateButton
          template={customTemplate}
          selected={value === "CUSTOM" && !customFormulaSuggestions.some((formula) => formula.key === customFormulaValue)}
          disabled={disabled}
          onClick={() => onChange(customTemplate.type)}
        />
      ) : null}
    </div>
  );
}

function formatFormulaExpression(expression: string): string {
  return expression
    .replace(/\*/g, " x ")
    .replace(/\//g, " / ")
    .replace(/\+/g, " + ")
    .replace(/-/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function TemplateButton({
  template,
  selected,
  disabled,
  onClick,
}: {
  template: MetradoTemplateRecord;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "h-auto min-h-20 justify-start rounded-xl border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-left text-[var(--app-text)]",
        selected && "border-sky-500 bg-[var(--app-primary-muted)] text-[var(--app-text-strong)] shadow-[0_12px_28px_-22px_rgba(37,99,235,0.65)]",
      )}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-start gap-2">
        <Layers3 className={cn("mt-0.5 h-4 w-4 shrink-0 text-[var(--app-text-subtle)]", selected && "text-sky-600")} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{template.name}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
            <Badge className={cn(selected && "bg-[var(--app-surface)] text-sky-700")}>{template.defaultUnit}</Badge>
            <span className="truncate">{template.formulas[0]?.label ?? "Manual"}</span>
          </span>
        </span>
      </span>
    </Button>
  );
}
