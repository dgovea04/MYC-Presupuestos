import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";
import { validatePolynomialFormula } from "@/lib/calculations/polynomial-formula";
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
          <Badge className={validation.isCoefficientSumValid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
            Suma coeficientes: {validation.coefficientSum}
          </Badge>
          <Badge className={validation.hasMaximumTermsValid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
            Monomios: {monomials.length}/8
          </Badge>
          <Badge className={pendingBaseAssignments.length === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
            Indices base pendientes: {pendingBaseAssignments.length}
          </Badge>
        </div>

        {validation.minimumCoefficientWarnings.length > 0 ? (
          <div className={cn("border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900", isExcelMode ? "rounded-md" : "rounded-2xl")}>
            {validation.minimumCoefficientWarnings.join(" ")}
          </div>
        ) : null}

        {!validation.isCoefficientSumValid ? (
          <div className={cn("border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800", isExcelMode ? "rounded-md" : "rounded-2xl")}>
            La suma de coeficientes debe ser exactamente 1.000 al milesimo.
          </div>
        ) : null}

        {pendingBaseAssignments.length > 0 ? (
          <div className={cn("border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600", isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl")}>
            Asigna indices INEI base a cada monomio antes de calcular K o registrar reajustes.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
