"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import dynamic from "next/dynamic";

import { UpgradeCTA } from "@/components/billing/upgrade-cta";
import { PolynomialAdjustmentHistory } from "@/components/budget/polynomial-adjustment-history";
import { PolynomialAutoAdjustmentPreviewDialog } from "@/components/budget/polynomial-auto-adjustment-preview-dialog";
import { PolynomialFormulaMath } from "@/components/budget/polynomial-formula-math";

const ExportPanel = dynamic(() => import("@/components/exports/export-panel").then((mod) => mod.ExportPanel));
import { PolynomialKCalculator } from "@/components/budget/polynomial-k-calculator";
import { PolynomialMonomialsTable } from "@/components/budget/polynomial-monomials-table";
import { PolynomialValidationSummary } from "@/components/budget/polynomial-validation-summary";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfoCard } from "@/components/ui/info-cards";
import { Input } from "@/components/ui/input";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { SaveStateBadge } from "@/components/ui/save-state-badge";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import {
  calculateAdjustmentAmounts,
  mergePolynomialMonomials,
  validatePolynomialFormula,
} from "@/lib/calculations/polynomial-formula";
import { getExportDefinition } from "@/lib/exports/definitions";
import { createPolynomialFinalAdjustmentProposal } from "@/lib/polynomial-formula/final-adjustment-engine";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { PolynomialFormulaSectionData } from "@/types/budget-sections";
import type { PolynomialCompositionDetailProps } from "@/components/budget/polynomial-composition-detail";
import type { FinalAdjustmentResult } from "@/lib/polynomial-formula/final-adjustment-types";
import type {
  AdjustmentCalculationRecord,
  PolynomialFormulaRecord,
  PolynomialMonomialRecord,
  UnifiedIndexRecord,
} from "@/types/polynomial-formula";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

type KPreviewResult = {
  kRaw: string;
  kRounded: string;
  terms: Array<{
    name: string;
    coefficient: string;
    baseIndexValue: string;
    adjustmentIndexValue: string;
    ratio: string;
    partial: string;
  }>;
};

type FormulaStatus = PolynomialFormulaSectionData["summary"]["status"];

const PLACEHOLDER_INDEX_NAME = "Pendiente de asignar";
const DynamicPolynomialCompositionDetail =
  process.env.NODE_ENV !== "production"
    ? dynamic<PolynomialCompositionDetailProps>(() =>
        import("@/components/budget/polynomial-composition-detail").then(
          (module) => module.PolynomialCompositionDetail,
        ),
      )
    : null;

function cloneFormula(formula: PolynomialFormulaRecord | null): PolynomialFormulaRecord | null {
  if (!formula) {
    return null;
  }

  return {
    ...formula,
    monomials: formula.monomials.map((monomial) => ({
      ...monomial,
      composition: monomial.composition.map((row) => ({ ...row })),
    })),
  };
}

function getStatusBadgeClass(status: FormulaStatus) {
  if (status === "VALID") return "bg-emerald-100 text-emerald-700";
  if (status === "DRAFT") return "bg-amber-100 text-amber-700";
  if (status === "ARCHIVED") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function createFormulaSummary(formula: PolynomialFormulaRecord | null) {
  return {
    hasFormula: formula !== null,
    monomialCount: formula?.monomials.length ?? 0,
    totalBaseAmount: formula?.totalBaseAmount ?? "0.0000",
    status: formula?.status ?? "NOT_CREATED",
  } satisfies PolynomialFormulaSectionData["summary"];
}

function formatDisplayCurrency(value: string, currency: string, decimalPlaces: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatCurrency(parsed, currency, decimalPlaces) : "-";
}

function nullableTrimmedValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function nullablePositiveDecimalValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) && numericValue > 0 ? trimmed : null;
}

function getFormulaSavePayload(formula: PolynomialFormulaRecord) {
  return {
    formulaId: formula.id,
    name: formula.name,
    baseMonth: formula.baseMonth,
    baseYear: formula.baseYear,
    monomials: formula.monomials.map((monomial) => ({
      id: monomial.id,
      code: monomial.code,
      name: monomial.name,
      costGroupKey: monomial.costGroupKey,
      amount: monomial.amount,
      coefficient: monomial.coefficient,
      baseIndexCode: monomial.baseIndexCode,
      baseIndexName: monomial.baseIndexName,
      baseIndexValue: monomial.baseIndexValue,
      adjustmentIndexCode: nullableTrimmedValue(monomial.adjustmentIndexCode),
      adjustmentIndexName: nullableTrimmedValue(monomial.adjustmentIndexName),
      adjustmentIndexValue: nullablePositiveDecimalValue(monomial.adjustmentIndexValue),
      sortOrder: monomial.sortOrder,
      composition: monomial.composition.map((row) => ({
        id: row.id,
        budgetItemId: row.budgetItemId ?? null,
        apuResourceId: row.apuResourceId ?? null,
        resourceType: row.resourceType ?? null,
        resourceName: row.resourceName ?? null,
        amount: row.amount,
        unifiedIndexCode: row.unifiedIndexCode ?? null,
        unifiedIndexName: row.unifiedIndexName ?? null,
        iuFamily: row.iuFamily ?? null,
        participationPercentage: row.participationPercentage ?? null,
        coefficientContribution: row.coefficientContribution ?? null,
      })),
    })),
  };
}

function buildMonomialValidationInput(monomials: PolynomialMonomialRecord[]) {
  return monomials.map((monomial) => ({
    coefficient: monomial.coefficient,
    baseIndexValue: monomial.baseIndexValue,
    adjustmentIndexValue: "1",
    name: monomial.name,
  }));
}

function hasPendingBaseIndices(monomials: PolynomialMonomialRecord[]) {
  return monomials.some((monomial) => monomial.baseIndexName === PLACEHOLDER_INDEX_NAME);
}

function formatLastSavedLabel(lastSavedAt: number | null, currentTime: number) {
  if (!lastSavedAt) return null;

  const seconds = Math.max(0, Math.floor((currentTime - lastSavedAt) / 1000));
  if (seconds < 60) {
    return `Último guardado hace ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Último guardado hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }

  const hours = Math.floor(minutes / 60);
  return `Último guardado hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
}

export function PolynomialFormulaEditor({
  section,
  adjustments,
  canUsePolynomialAdjustments,
  showCompositionDetail = false,
}: {
  section: PolynomialFormulaSectionData;
  adjustments: AdjustmentCalculationRecord[];
  canUsePolynomialAdjustments: boolean;
  showCompositionDetail?: boolean;
}) {
  const { currencyDecimals, dateFormat } = useFormattingSettings();
  const { isExcelMode } = useAppViewMode();
  const [formula, setFormula] = useState(() => cloneFormula(section.formula));
  const [summary, setSummary] = useState(() => createFormulaSummary(section.formula));
  const [history, setHistory] = useState(adjustments);
  const [baseIndexOptions, setBaseIndexOptions] = useState<UnifiedIndexRecord[]>([]);
  const [baseIndicesLoading, setBaseIndicesLoading] = useState(() => Boolean(section.formula));
  const [generateMonth, setGenerateMonth] = useState(section.formula?.baseMonth ?? new Date().getMonth() + 1);
  const [generateYear, setGenerateYear] = useState(section.formula?.baseYear ?? new Date().getFullYear());
  const [previewMonth, setPreviewMonth] = useState(new Date().getMonth() + 1);
  const [previewYear, setPreviewYear] = useState(new Date().getFullYear());
  const [originalAmount, setOriginalAmount] = useState("100000.00");
  const [kPreview, setKPreview] = useState<KPreviewResult | null>(null);
  const [kPreviewError, setKPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [autoAdjustmentPreview, setAutoAdjustmentPreview] = useState<FinalAdjustmentResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplyingAdjustment, setIsApplyingAdjustment] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveClock, setSaveClock] = useState(() => Date.now());
  const lastSavedPayload = useRef<string | null>(
    section.formula ? JSON.stringify(getFormulaSavePayload(section.formula)) : null,
  );

  const validation = useMemo(
    () => validatePolynomialFormula(buildMonomialValidationInput(formula?.monomials ?? [])),
    [formula],
  );
  const canCalculatePreview =
    canUsePolynomialAdjustments &&
    formula !== null &&
    formula.monomials.length > 0 &&
    !hasPendingBaseIndices(formula.monomials) &&
    validation.isCoefficientSumValid;
  const previewAdjustedAmounts = useMemo(() => {
    if (!kPreview) return null;
    try {
      return calculateAdjustmentAmounts({
        originalAmount,
        kRounded: kPreview.kRounded,
      });
    } catch {
      return null;
    }
  }, [kPreview, originalAmount]);

  const calculateKPreview = useEffectEvent(
    async (formulaToPreview: PolynomialFormulaRecord, month: number, year: number) => {
      setPreviewLoading(true);
      setKPreviewError("");

      try {
        const response = await fetch(`/api/unified-indices?month=${month}&year=${year}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "No se pudieron cargar los índices de reajuste");
        }

        const indices = (await response.json()) as UnifiedIndexRecord[];
        const uniqueByCode = new Map<string, UnifiedIndexRecord>();
        const duplicateCodes = new Set<string>();

        for (const index of indices) {
          if (uniqueByCode.has(index.code)) {
            duplicateCodes.add(index.code);
            continue;
          }

          uniqueByCode.set(index.code, index);
        }

        const duplicatedSelectedCodes = formulaToPreview.monomials
          .map((monomial) => monomial.baseIndexCode)
          .filter((code) => duplicateCodes.has(code));

        if (duplicatedSelectedCodes.length > 0) {
          throw new Error(
            `Los códigos ${[...new Set(duplicatedSelectedCodes)].join(", ")} tienen múltiples ámbitos geográficos en ${month}/${year}.`,
          );
        }

        const payload = {
          monomials: formulaToPreview.monomials.map((monomial) => {
            const matchingIndex = uniqueByCode.get(monomial.baseIndexCode);

            if (!matchingIndex) {
              throw new Error(`Falta el índice de reajuste para el código ${monomial.baseIndexCode}`);
            }

            return {
              coefficient: monomial.coefficient,
              baseIndexValue: monomial.baseIndexValue,
              adjustmentIndexValue: matchingIndex.value,
              name: monomial.name,
            };
          }),
        };
        const calculationResponse = await fetch(`/api/polynomial-formulas/${formulaToPreview.id}/calculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!calculationResponse.ok) {
          const data = await calculationResponse.json();
          throw new Error(data.error ?? "No se pudo calcular K");
        }

        const result = (await calculationResponse.json()) as KPreviewResult;
        setKPreview(result);
      } catch (requestError) {
        setKPreview(null);
        setKPreviewError(requestError instanceof Error ? requestError.message : "No se pudo calcular K");
      } finally {
        setPreviewLoading(false);
      }
    },
  );

  useEffect(() => {
    if (!formula) {
      return;
    }

    let isActive = true;

    void fetch(`/api/unified-indices?month=${formula.baseMonth}&year=${formula.baseYear}`)
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "No se pudieron cargar los índices base");
        }

        return (await response.json()) as UnifiedIndexRecord[];
      })
      .then((data) => {
        if (!isActive) return;
        setBaseIndexOptions(data);
      })
      .catch((requestError) => {
        if (!isActive) return;
        setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar los índices base");
      })
      .finally(() => {
        if (isActive) {
          setBaseIndicesLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [formula?.baseMonth, formula?.baseYear, formula]);

  useEffect(() => {
    if (!formula) return;

    const nextPayload = JSON.stringify(getFormulaSavePayload(formula));

    if (lastSavedPayload.current === null) {
      setSaveState("dirty");
      return;
    }

    setSaveState(nextPayload === lastSavedPayload.current ? "idle" : "dirty");
  }, [formula]);

  useEffect(() => {
    if (!lastSavedAt) return;

    const interval = window.setInterval(() => setSaveClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lastSavedAt]);

  useEffect(() => {
    if (!feedback) return;

    const timeout = window.setTimeout(() => setFeedback(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!canCalculatePreview || !formula) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void calculateKPreview(formula, previewMonth, previewYear);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [canCalculatePreview, formula, previewMonth, previewYear]);

  async function generateFormula() {
    if (!section.budgetId) return;

    setIsGenerating(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(`/api/budgets/${section.budgetId}/polynomial-formula`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMonth: generateMonth,
          baseYear: generateYear,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo generar la fórmula polinómica");
      }

      const nextFormula = (await response.json()) as PolynomialFormulaRecord;
      setBaseIndicesLoading(true);
      setFormula(cloneFormula(nextFormula));
      setSummary(createFormulaSummary(nextFormula));
      setKPreview(null);
      setKPreviewError("");
      lastSavedPayload.current = JSON.stringify(getFormulaSavePayload(nextFormula));
      setSaveState("saved");
      setLastSavedAt(Date.now());
      setSaveClock(Date.now());
      setFeedback("Fórmula generada desde el presupuesto.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo generar la fórmula");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveFormula() {
    if (!formula) return false;

    setSaveState("saving");
    setError("");
    setFeedback("");

    try {
      const response = await fetch(`/api/budgets/${section.budgetId}/polynomial-formula`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...getFormulaSavePayload(formula),
          status:
            validation.isValid && !hasPendingBaseIndices(formula.monomials) ? "VALID" : "DRAFT",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo guardar la fórmula");
      }

      const savedFormula = (await response.json()) as PolynomialFormulaRecord;
      setFormula(cloneFormula(savedFormula));
      setSummary(createFormulaSummary(savedFormula));
      setKPreview(null);
      setKPreviewError("");
      lastSavedPayload.current = JSON.stringify(getFormulaSavePayload(savedFormula));
      setSaveState("saved");
      setLastSavedAt(Date.now());
      setSaveClock(Date.now());
      setFeedback("Fórmula guardada.");
      return true;
    } catch (requestError) {
      setSaveState("error");
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la fórmula");
      return false;
    }
  }

  async function applyAdjustment() {
    if (!formula || !kPreview) return;

    setIsApplyingAdjustment(true);
    setError("");
    setFeedback("");

    try {
      const needsSave =
        lastSavedPayload.current !== JSON.stringify(getFormulaSavePayload(formula));

      if (needsSave) {
        const saved = await saveFormula();
        if (!saved) {
          return;
        }
      }

      const response = await fetch(`/api/polynomial-formulas/${formula.id}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: previewMonth,
          year: previewYear,
          originalAmount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo registrar el reajuste");
      }

      const adjustment = (await response.json()) as AdjustmentCalculationRecord;
      setHistory((current) => [adjustment, ...current.filter((item) => item.id !== adjustment.id)]);
      setFeedback("Reajuste registrado en el historial.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo aplicar el reajuste");
    } finally {
      setIsApplyingAdjustment(false);
    }
  }

  function updateFormula(changes: Partial<PolynomialFormulaRecord>) {
    setFormula((current) => {
      if (!current) return current;
      const next = {
        ...current,
        ...changes,
      };

      if (
        (changes.baseMonth !== undefined && changes.baseMonth !== current.baseMonth) ||
        (changes.baseYear !== undefined && changes.baseYear !== current.baseYear)
      ) {
        setBaseIndicesLoading(true);
      }

      setSummary(createFormulaSummary(next));
      setKPreview(null);
      setKPreviewError("");
      return next;
    });
  }

  function updateMonomial(nextMonomial: PolynomialMonomialRecord) {
    setFormula((current) => {
      if (!current) return current;

      const next = {
        ...current,
        monomials: current.monomials.map((monomial) =>
          monomial.id === nextMonomial.id ? nextMonomial : monomial,
        ),
      };

      setSummary(createFormulaSummary(next));
      setKPreview(null);
      setKPreviewError("");
      return next;
    });
  }

  function mergeMonomials(targetMonomialId: string, sourceMonomialIds: string[]) {
    setFormula((current) => {
      if (!current) return current;

      const next = {
        ...current,
        monomials: mergePolynomialMonomials({
          monomials: current.monomials,
          targetMonomialId,
          sourceMonomialIds,
        }),
      };

      setSummary(createFormulaSummary(next));
      setKPreview(null);
      setKPreviewError("");
      setFeedback("Monomios juntados. Revisa el indice base del destino.");
      return next;
    });
  }

  function openAutoAdjustmentPreview() {
    if (!formula) return;

    setError("");
    setAutoAdjustmentPreview(createPolynomialFinalAdjustmentProposal(formula.monomials));
  }

  function applyAutoAdjustmentPreview() {
    if (!autoAdjustmentPreview?.canApply) return;

    setFormula((current) => {
      if (!current) return current;

      const next = {
        ...current,
        monomials: autoAdjustmentPreview.finalMonomials.map((monomial, index) => ({
          ...monomial,
          sortOrder: index,
          composition: monomial.composition.map((row) => ({ ...row })),
        })),
      };

      setSummary(createFormulaSummary(next));
      setKPreview(null);
      setKPreviewError("");
      setFeedback("Ajuste automatico aplicado. Revisa indices base antes de guardar.");
      return next;
    });
    setAutoAdjustmentPreview(null);
  }

  return (
    <div className="space-y-5">
      {!formula ? (
          <Card className={cn(isExcelMode ? "rounded-md border-slate-300 shadow-none" : "border-slate-200/90 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)]")}>
            <CardContent className="space-y-5 p-6">
            <OperationalPanel
              title={section.title}
              description="Genera la fórmula polinómica desde este presupuesto y luego asigna los índices INEI correspondientes a cada monomio."
              controls={
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    La generación inicial toma los coeficientes de este presupuesto y prepara el editor para la asignación de índices.
                  </p>
                  {section.budgetId ? (
                    <ExportPanel
                      buttonLabel="Exportar"
                      defaultPreset="formula_polinomica_detallada"
                      definition={getExportDefinition("polynomial_formula")}
                      targetId={section.budgetId}
                    />
                  ) : null}
                  {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                </div>
              }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <div className={cn("border bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.9)_100%)] p-4", isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl border-slate-200/90")}>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mes base</p>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={generateMonth}
                  onChange={(event) => setGenerateMonth(Number(event.target.value))}
                  className="mt-3"
                />
              </div>
                <div className={cn("border bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.9)_100%)] p-4", isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl border-slate-200/90")}>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Año base</p>
                <Input
                  type="number"
                  min={1979}
                  value={generateYear}
                  onChange={(event) => setGenerateYear(Number(event.target.value))}
                  className="mt-3"
                />
              </div>
                <div className={cn("border border-sky-200/80 bg-[linear-gradient(180deg,#f7fbff_0%,#eef7ff_100%)] p-4", isExcelMode ? "rounded-md shadow-none" : "rounded-2xl shadow-[0_14px_30px_-26px_rgba(2,132,199,0.22)]")}>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Accion</p>
                <Button
                  type="button"
                  onClick={() => void generateFormula()}
                  disabled={isGenerating}
                  className="mt-3 w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isGenerating ? "Generando..." : "Generar fórmula"}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {section.coefficients.map((coefficient) => (
                <div key={coefficient.symbol} className={cn("border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(248,250,252,0.95)_0%,rgba(241,245,249,0.9)_100%)] p-4", isExcelMode ? "rounded-md" : "rounded-2xl")}>
                  <p className="font-medium text-slate-900">
                    {coefficient.symbol} - {coefficient.label}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{coefficient.detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={cn(isExcelMode ? "rounded-md border-slate-300 shadow-none" : "border-slate-200/90 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)]")}>
            <CardContent className="space-y-4 p-6">
              <OperationalPanel
                title={formula.name}
                description={`Mes base ${formula.baseMonth}/${formula.baseYear}. Asigna índices INEI, valida coeficientes y calcula K en tiempo real.`}
                metrics={
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(getStatusBadgeClass(summary.status), isExcelMode ? "rounded-sm" : "rounded-full", "px-3 py-2 text-xs font-medium")}>
                      Estado: {summary.status}
                    </span>
                    <SaveStateBadge state={saveState} lastSavedLabel={formatLastSavedLabel(lastSavedAt, saveClock)} savedLabel="Guardado" />
                  </div>
                }
                controls={
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">
                      Guarda la fórmula antes de registrar reajustes para mantener consistente el historial de este presupuesto.
                    </p>
                    <div className="flex items-center gap-2">
                      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
                      {!error && feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
                      {section.budgetId ? (
                        <ExportPanel
                          buttonLabel="Exportar"
                          defaultPreset="formula_polinomica_detallada"
                          definition={getExportDefinition("polynomial_formula")}
                          targetId={section.budgetId}
                        />
                      ) : null}
                    </div>
                  </div>
                }
              />

              <div className="grid gap-3 md:grid-cols-3">
                <InfoCard label="Monomios" value={String(summary.monomialCount)} tone="sky" />
                <InfoCard
                  label="Base acumulada"
                  value={formatDisplayCurrency(summary.totalBaseAmount, section.currency, currencyDecimals)}
                  tone="slate"
                />
                <InfoCard
                  label="Índices pendientes"
                  value={String(formula.monomials.filter((monomial) => monomial.baseIndexName === PLACEHOLDER_INDEX_NAME).length)}
                  tone="amber"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_160px_160px_auto]">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Nombre</label>
                  <Input
                    value={formula.name}
                    onChange={(event) => updateFormula({ name: event.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Mes base</label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={formula.baseMonth}
                    onChange={(event) => updateFormula({ baseMonth: Number(event.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Año base</label>
                  <Input
                    type="number"
                    min={1979}
                    value={formula.baseYear}
                    onChange={(event) => updateFormula({ baseYear: Number(event.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="button" onClick={() => void saveFormula()} disabled={saveState === "saving"}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void generateFormula()}
                    disabled={isGenerating}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerar
                  </Button>
                </div>
              </div>

              <PolynomialFormulaMath monomials={formula.monomials} />
            </CardContent>
          </Card>

          <PolynomialValidationSummary monomials={formula.monomials} />
          <PolynomialMonomialsTable
            monomials={formula.monomials}
            baseIndexOptions={baseIndexOptions}
            baseIndicesLoading={baseIndicesLoading}
            currencyDecimals={currencyDecimals}
            onChangeMonomial={updateMonomial}
            onMergeMonomials={mergeMonomials}
            onAutoAdjustMonomials={openAutoAdjustmentPreview}
          />
          <PolynomialAutoAdjustmentPreviewDialog
            open={autoAdjustmentPreview !== null}
            preview={autoAdjustmentPreview}
            onApply={applyAutoAdjustmentPreview}
            onClose={() => setAutoAdjustmentPreview(null)}
          />
          {showCompositionDetail && DynamicPolynomialCompositionDetail ? (
            <DynamicPolynomialCompositionDetail monomials={formula.monomials} />
          ) : null}
          {canUsePolynomialAdjustments ? (
            <>
              <PolynomialKCalculator
                previewMonth={previewMonth}
                previewYear={previewYear}
                originalAmount={originalAmount}
                onPreviewMonthChange={setPreviewMonth}
                onPreviewYearChange={setPreviewYear}
                onOriginalAmountChange={setOriginalAmount}
                result={kPreview}
                resultError={kPreviewError}
                isLoading={previewLoading}
                adjustedAmounts={previewAdjustedAmounts}
                canApply={Boolean(kPreview && previewAdjustedAmounts && !kPreviewError)}
                onApplyAdjustment={() => void applyAdjustment()}
                isApplyingAdjustment={isApplyingAdjustment}
                currency={section.currency}
                currencyDecimals={currencyDecimals}
              />
              <PolynomialAdjustmentHistory
                adjustments={history}
                currency={section.currency}
                currencyDecimals={currencyDecimals}
              />
            </>
          ) : (
            <UpgradeCTA
              title="Calculo de K y valorizacion disponible en Pro"
              description="Starter incluye generar, editar y validar la formula polinomica. Pro desbloquea el calculo de K, valorizaciones reajustadas e historial operativo."
              benefits={[
                "Preview de coeficiente K",
                "Valorizaciones reajustadas",
                "Historial operativo de ajustes",
              ]}
            />
          )}
        </>
      )}

      {canUsePolynomialAdjustments && history.length > 0 ? (
        <p className="text-xs text-slate-500">
          Último reajuste registrado: {formatDate(history[0]?.createdAt ?? null, dateFormat)}
        </p>
      ) : null}
    </div>
  );
}
