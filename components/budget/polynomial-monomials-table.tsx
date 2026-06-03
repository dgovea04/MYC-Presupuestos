"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { cn, formatNumber } from "@/lib/utils";
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

function formatThreeDecimals(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : value;
}

function parseFormattedNumber(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAmountDisplay(value: string, decimalPlaces: number) {
  const parsed = parseFormattedNumber(value);
  return parsed === null ? value : formatNumber(parsed, decimalPlaces);
}

function MonomialAmountInput({
  value,
  decimalPlaces,
  onChange,
}: {
  value: string;
  decimalPlaces: number;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={isFocused ? draft : formatAmountDisplay(value, decimalPlaces)}
      onFocus={() => {
        setIsFocused(true);
        setDraft(value);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setIsFocused(false);
        const parsed = parseFormattedNumber(draft);
        if (parsed === null) {
          setDraft(formatAmountDisplay(value, decimalPlaces));
          return;
        }

        const nextValue = parsed.toFixed(decimalPlaces);
        onChange(nextValue);
        setDraft(formatNumber(parsed, decimalPlaces));
      }}
      className="h-8 rounded-lg px-2 text-right text-xs tabular-nums"
    />
  );
}

function MonomialCoefficientInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={isFocused ? draft : formatThreeDecimals(value)}
      onFocus={() => {
        setIsFocused(true);
        setDraft(value);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setIsFocused(false);
        const nextValue = formatThreeDecimals(draft);
        onChange(nextValue);
        setDraft(nextValue);
      }}
      className="h-8 rounded-lg px-2 text-right text-xs tabular-nums"
    />
  );
}

export function PolynomialMonomialsTable({
  monomials,
  baseIndexOptions,
  baseIndicesLoading,
  onChangeMonomial,
  currencyDecimals,
}: {
  monomials: PolynomialMonomialRecord[];
  baseIndexOptions: UnifiedIndexRecord[];
  baseIndicesLoading: boolean;
  onChangeMonomial: (monomial: PolynomialMonomialRecord) => void;
  currencyDecimals: number;
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
                <TH className="text-right">Monto base (en Soles)</TH>
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
                    <MonomialAmountInput
                      value={monomial.amount}
                      decimalPlaces={currencyDecimals}
                      onChange={(value) =>
                        onChangeMonomial({
                          ...monomial,
                          amount: value,
                        })
                      }
                    />
                  </TD>
                  <TD className="align-top">
                    <MonomialCoefficientInput
                      value={monomial.coefficient}
                      onChange={(value) =>
                        onChangeMonomial({
                          ...monomial,
                          coefficient: value,
                        })
                      }
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
