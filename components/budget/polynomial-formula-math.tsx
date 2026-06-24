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
    return <p className="theme-muted-text text-sm">La expresion matematica aparecera cuando exista una formula generada.</p>;
  }

  return (
    <div className={cn("theme-muted-panel border px-4 py-4", isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl")}>
      <p className="theme-muted-text text-xs uppercase tracking-[0.2em]">Expresion</p>
      <p className="theme-strong-text mt-3 break-words font-mono text-sm">
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
