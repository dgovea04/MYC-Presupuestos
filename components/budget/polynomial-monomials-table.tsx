"use client";

import { Card, CardContent } from "@/components/ui/card";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { cn } from "@/lib/utils";
import type { PolynomialMonomialRecord, UnifiedIndexRecord } from "@/types/polynomial-formula";

type BaseIndexOption = {
  key: string;
  code: string;
  name: string;
  value: string;
  geographicArea?: string;
};

function toBaseIndexOptions(indices: UnifiedIndexRecord[]): BaseIndexOption[] {
  return indices.map((index) => ({
    key: `${index.code}:${index.geographicArea ?? "NA"}`,
    code: index.code,
    name: index.name,
    value: index.value,
    geographicArea: index.geographicArea,
  }));
}

export function PolynomialMonomialsTable({
  monomials,
  baseIndexOptions,
  baseIndicesLoading,
  onChangeMonomial,
}: {
  monomials: PolynomialMonomialRecord[];
  baseIndexOptions: UnifiedIndexRecord[];
  baseIndicesLoading: boolean;
  onChangeMonomial: (monomial: PolynomialMonomialRecord) => void;
}) {
  const { isExcelMode } = useAppViewMode();
  const options = toBaseIndexOptions(baseIndexOptions);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <OperationalPanel
          title="Monomios"
          description="Edita codigos, nombres e indices base. Los coeficientes deben sumar 1.000 y cada monomio debe quedar asociado a un indice INEI."
          metrics={<span>{monomials.length} monomios</span>}
        />

        {baseIndicesLoading ? (
          <div className={cn("border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600", isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl")}>
            Cargando indices INEI del mes base...
          </div>
        ) : null}

        <div className={getTableFrameClassName(isExcelMode)}>
          <Table className="min-w-[1120px]">
            <THead>
              <TR className="bg-slate-50 hover:bg-slate-50">
                <TH>Codigo</TH>
                <TH>Nombre</TH>
                <TH>Grupo</TH>
                <TH className="text-right">Monto base</TH>
                <TH className="text-right">Coeficiente</TH>
                <TH>Indice base</TH>
                <TH className="text-right">Valor base</TH>
              </TR>
            </THead>
            <TBody>
              {monomials.map((monomial) => (
                <TR key={monomial.id}>
                  <TD className="align-top">
                    <Input
                      value={monomial.code}
                      onChange={(event) =>
                        onChangeMonomial({
                          ...monomial,
                          code: event.target.value,
                        })
                      }
                      className="h-8 rounded-lg px-2 text-xs"
                    />
                  </TD>
                  <TD className="align-top">
                    <Input
                      value={monomial.name}
                      onChange={(event) =>
                        onChangeMonomial({
                          ...monomial,
                          name: event.target.value,
                        })
                      }
                      className="h-8 rounded-lg px-2 text-xs"
                    />
                  </TD>
                  <TD className="text-sm text-slate-700">{monomial.costGroupKey}</TD>
                  <TD className="align-top">
                    <Input
                      type="number"
                      step="0.0001"
                      value={monomial.amount}
                      onChange={(event) =>
                        onChangeMonomial({
                          ...monomial,
                          amount: event.target.value,
                        })
                      }
                      className="h-8 rounded-lg px-2 text-right text-xs tabular-nums"
                    />
                  </TD>
                  <TD className="align-top">
                    <Input
                      type="number"
                      step="0.001"
                      value={monomial.coefficient}
                      onChange={(event) =>
                        onChangeMonomial({
                          ...monomial,
                          coefficient: event.target.value,
                        })
                      }
                      className="h-8 rounded-lg px-2 text-right text-xs tabular-nums"
                    />
                  </TD>
                  <TD className="align-top">
                    <Select
                      value={monomial.baseIndexCode}
                      onChange={(event) => {
                        const nextOption = options.find((option) => option.code === event.target.value);

                        onChangeMonomial({
                          ...monomial,
                          baseIndexCode: event.target.value,
                          baseIndexName: nextOption
                            ? `${nextOption.name}${nextOption.geographicArea ? ` (${nextOption.geographicArea})` : ""}`
                            : monomial.baseIndexName,
                          baseIndexValue: nextOption?.value ?? monomial.baseIndexValue,
                        });
                      }}
                      className="h-8 min-w-[260px] rounded-lg px-2 text-xs"
                    >
                      <option value="">Selecciona un indice base</option>
                      {options.map((option) => (
                        <option key={option.key} value={option.code}>
                          {option.code} - {option.name}
                          {option.geographicArea ? ` (${option.geographicArea})` : ""}
                        </option>
                      ))}
                    </Select>
                  </TD>
                  <TD className="align-top">
                    <Input
                      type="number"
                      step="0.001"
                      value={monomial.baseIndexValue}
                      onChange={(event) =>
                        onChangeMonomial({
                          ...monomial,
                          baseIndexValue: event.target.value,
                        })
                      }
                      className="h-8 rounded-lg px-2 text-right text-xs tabular-nums"
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
