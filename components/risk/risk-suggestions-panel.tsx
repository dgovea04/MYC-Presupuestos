"use client";

import { Bot, Check, Lightbulb, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskVariableRecord, RiskVariableSuggestion } from "@/types/risk";

type RiskSuggestionsPanelProps = {
  disabled: boolean;
  error?: string;
  isLoading?: boolean;
  isSaving?: boolean;
  onRequestSuggestions: () => Promise<void>;
  onSaveApprovedScenario: (variables: RiskVariableRecord[]) => Promise<void>;
  savedScenarioName?: string;
  suggestions: RiskVariableSuggestion[];
};

export function RiskSuggestionsPanel({
  disabled,
  error = "",
  isLoading = false,
  isSaving = false,
  onRequestSuggestions,
  onSaveApprovedScenario,
  savedScenarioName = "",
  suggestions,
}: RiskSuggestionsPanelProps) {
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(() => new Set(suggestions.map((suggestion) => suggestion.id)));

  const acceptedSuggestions = useMemo(
    () => suggestions.filter((suggestion) => acceptedIds.has(suggestion.id)),
    [acceptedIds, suggestions],
  );

  return (
    <Card className="theme-surface-card overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-5 py-4">
        <CardTitle className="theme-strong-text flex items-center gap-2 text-sm font-semibold">
          <Bot className="h-4 w-4" />
          Sugerencias de Khipu
        </CardTitle>
        <Button disabled={disabled || isLoading || isSaving} onClick={() => void onRequestSuggestions()} size="sm" variant="outline">
          <Lightbulb className="mr-2 h-4 w-4" />
          {isLoading ? "Generando" : "Sugerir variables"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {suggestions.length === 0 ? (
          <p className="theme-muted-text text-sm">Solicita variables sugeridas para revisarlas antes de guardar un escenario.</p>
        ) : (
          <div className="space-y-2">
            {suggestions.map((suggestion) => {
              const accepted = acceptedIds.has(suggestion.id);

              return (
                <div
                  key={suggestion.id}
                  className="grid gap-3 rounded-xl border border-[var(--app-border)] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="theme-strong-text text-sm font-medium">
                        {suggestion.variableType} | {suggestion.distributionType}
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {suggestion.source}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                        Conf. {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                    <p className="theme-muted-text text-xs">{suggestion.reason}</p>
                    <p className="theme-muted-text text-xs">
                      Min {suggestion.minimum} | Probable {suggestion.mostLikely} | Max {suggestion.maximum}
                    </p>
                  </div>

                  <Button
                    aria-label={`${accepted ? "Rechazar" : "Aceptar"} sugerencia ${suggestion.id}`}
                    className="h-8 w-8 self-start px-0"
                    disabled={disabled || isSaving}
                    onClick={() => toggleAccepted(suggestion.id)}
                    size="sm"
                    variant={accepted ? "outline" : "ghost"}
                  >
                    {accepted ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-slate-500" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="theme-muted-text text-xs">
            {acceptedSuggestions.length} de {suggestions.length} sugerencias aceptadas.
          </p>
          <Button
            disabled={disabled || isLoading || isSaving || acceptedSuggestions.length === 0}
            onClick={() => void onSaveApprovedScenario(acceptedSuggestions.map(toVariableRecord))}
            size="sm"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Guardando" : "Guardar escenario aprobado"}
          </Button>
        </div>

        {savedScenarioName ? <p className="theme-status-success rounded-xl border px-3 py-2 text-sm">{savedScenarioName}</p> : null}
        {error ? <p className="theme-status-error rounded-xl border px-3 py-2 text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );

  function toggleAccepted(suggestionId: string) {
    setAcceptedIds((current) => {
      const next = new Set(current);
      if (next.has(suggestionId)) {
        next.delete(suggestionId);
      } else {
        next.add(suggestionId);
      }
      return next;
    });
  }
}

function toVariableRecord(suggestion: RiskVariableSuggestion): RiskVariableRecord {
  return {
    id: suggestion.id,
    budgetId: suggestion.budgetId,
    budgetItemId: suggestion.budgetItemId,
    variableType: suggestion.variableType,
    distributionType: suggestion.distributionType,
    minimum: suggestion.minimum,
    mostLikely: suggestion.mostLikely,
    maximum: suggestion.maximum,
    enabled: true,
    source: suggestion.source,
    confidence: suggestion.confidence,
    rationale: suggestion.reason,
  };
}
