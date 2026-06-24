import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";
import { validatePolynomialFormula } from "@/lib/calculations/polynomial-formula";
import { POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS } from "@/lib/polynomial-formula/smart-monomial-types";
import type { PolynomialMonomialRecord } from "@/types/polynomial-formula";

const PLACEHOLDER_INDEX_NAME = "Pendiente de asignar";

export function PolynomialValidationSummary({
  monomials,
}: {
  monomials: PolynomialMonomialRecord[];
}) {
  const { isExcelMode } = useAppViewMode();
  const validation = validatePolynomialFormula(
    monomials.map((monomial) => ({
      coefficient: monomial.coefficient,
      baseIndexValue: monomial.baseIndexValue,
      adjustmentIndexValue: "1",
      name: monomial.name,
      code: monomial.code,
      composition: monomial.composition,
    })),
  );
  const pendingBaseAssignments = monomials.filter(
    (monomial) => monomial.baseIndexName === PLACEHOLDER_INDEX_NAME,
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <OperationalPanel
          title="Validacion"
          description="Revisa la consistencia estructural antes de pasar a calculos de reajuste."
        />

        <div className="flex flex-wrap gap-2">
          <Badge className={validation.isCoefficientSumValid ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-300"}>
            Suma coeficientes: {validation.coefficientSum}
          </Badge>
          <Badge className={validation.hasMaximumTermsValid ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-300"}>
            Monomios: {monomials.length}/{POLYNOMIAL_FORMULA_DEFAULT_MAX_MONOMIALS}
          </Badge>
          <Badge className={pendingBaseAssignments.length === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-300"}>
            Indices base pendientes: {pendingBaseAssignments.length}
          </Badge>
        </div>

        {validation.compositionDiagnostics.length > 0 ? (
          <div className={cn("border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200", isExcelMode ? "rounded-md" : "rounded-2xl")}>
            <ul className="space-y-1">
              {validation.compositionDiagnostics.map((diagnostic) => (
                <li key={`${diagnostic.code}:${diagnostic.monomialName}:${diagnostic.message}`}>
                  {diagnostic.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!validation.isCoefficientSumValid ? (
          <div className={cn("border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200", isExcelMode ? "rounded-md" : "rounded-2xl")}>
            La suma de coeficientes debe ser exactamente 1.000 al milesimo.
          </div>
        ) : null}

        {pendingBaseAssignments.length > 0 ? (
          <div
            className={cn(
              "border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 text-sm text-[var(--app-text-muted)]",
              isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl",
            )}
          >
            Asigna indices INEI base a cada monomio antes de calcular K o registrar reajustes.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
