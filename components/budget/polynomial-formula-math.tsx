import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn } from "@/lib/utils";
import type { PolynomialMonomialRecord } from "@/types/polynomial-formula";

function formatCoefficient(value: string) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(3) : value;
}

export function PolynomialFormulaMath({
  monomials,
}: {
  monomials: PolynomialMonomialRecord[];
}) {
  const { isExcelMode } = useAppViewMode();

  if (!monomials.length) {
    return <p className="text-sm text-slate-500">La expresion matematica aparecera cuando exista una formula generada.</p>;
  }

  return (
    <div className={cn("border border-slate-200 bg-slate-50 px-4 py-4", isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl")}>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Expresion</p>
      <p className="mt-3 break-words font-mono text-sm text-slate-900">
        K ={" "}
        {monomials
          .map(
            (monomial) =>
              `${formatCoefficient(monomial.coefficient)}(${monomial.code}r/${monomial.code}o)`,
          )
          .join(" + ")}
      </p>
    </div>
  );
}
