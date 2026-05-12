import { formatNumber } from "@/lib/utils";

export type BudgetFooterRow = {
  code: "CD" | "PGG" | "UTI" | "ST" | "IGV" | "TOTAL";
  description: string;
  formula: string;
  value: number;
  iu: string;
  highlight: boolean;
};

export type BudgetFooterSummary = {
  rows: BudgetFooterRow[];
  amountInWords: string;
};

export function calculateBudgetFooterSummary(input: {
  totalDirectCost: number;
  totalGeneralExpenses: number;
  utilityRate: number;
  igvRate: number;
  currency?: string;
}): BudgetFooterSummary {
  const cd = round(input.totalDirectCost);
  const pgg = round(input.totalGeneralExpenses);
  const uti = round(cd * input.utilityRate);
  const st = round(cd + pgg + uti);
  const igv = round(cd * input.igvRate);
  const total = round(st + igv);

  return {
    rows: [
      { code: "CD", description: "COSTO DIRECTO", formula: "", value: cd, iu: "", highlight: true },
      {
        code: "PGG",
        description: `GASTOS GENERALES ${formatRateLabel(getRatio(pgg, cd))}`,
        formula: `CD * ${formatFormulaRate(getRatio(pgg, cd))}`,
        value: pgg,
        iu: "39",
        highlight: false,
      },
      {
        code: "UTI",
        description: `UTILIDAD ${formatRateLabel(input.utilityRate)}`,
        formula: `CD * ${formatFormulaRate(input.utilityRate)}`,
        value: uti,
        iu: "39",
        highlight: false,
      },
      { code: "ST", description: "SUB TOTAL", formula: "CD + PGG + UTI", value: st, iu: "", highlight: true },
      {
        code: "IGV",
        description: `IGV ${formatRateLabel(input.igvRate)}`,
        formula: `CD * ${formatFormulaRate(input.igvRate)}`,
        value: igv,
        iu: "",
        highlight: false,
      },
      { code: "TOTAL", description: "TOTAL PRESUPUESTO", formula: "ST + IGV", value: total, iu: "", highlight: true },
    ],
    amountInWords: formatAmountInWords(total, input.currency ?? "PEN"),
  };
}

function formatRateLabel(rate: number) {
  return `${formatNumber(rate * 100, 2)}%`;
}

function formatFormulaRate(rate: number) {
  return rate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function getRatio(value: number, base: number) {
  if (base <= 0) return 0;
  return value / base;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100000) / 100000;
}

function formatAmountInWords(amount: number, currency: string) {
  const absolute = Math.abs(amount);
  const integerPart = Math.floor(absolute);
  const decimalPart = Math.round((absolute - integerPart) * 100);
  const currencyLabel = currency === "USD" ? "DOLARES" : "SOLES";

  return `SON: ${toSpanishWords(integerPart)} CON ${decimalPart.toString().padStart(2, "0")}/100 ${currencyLabel}`;
}

function toSpanishWords(value: number): string {
  if (value === 0) return "CERO";
  if (value < 0) return `MENOS ${toSpanishWords(Math.abs(value))}`;

  if (value >= 1_000_000) {
    const millions = Math.floor(value / 1_000_000);
    const remainder = value % 1_000_000;
    const millionsText = millions === 1 ? "UN MILLON" : `${toSpanishWords(millions)} MILLONES`;
    return remainder === 0 ? millionsText : `${millionsText} ${toSpanishWords(remainder)}`;
  }

  if (value >= 1000) {
    const thousands = Math.floor(value / 1000);
    const remainder = value % 1000;
    const thousandsText = thousands === 1 ? "MIL" : `${toSpanishWords(thousands)} MIL`;
    return remainder === 0 ? thousandsText : `${thousandsText} ${toSpanishWords(remainder)}`;
  }

  if (value >= 100) {
    const hundredsMap: Record<number, string> = {
      1: value === 100 ? "CIEN" : "CIENTO",
      2: "DOSCIENTOS",
      3: "TRESCIENTOS",
      4: "CUATROCIENTOS",
      5: "QUINIENTOS",
      6: "SEISCIENTOS",
      7: "SETECIENTOS",
      8: "OCHOCIENTOS",
      9: "NOVECIENTOS",
    };

    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;
    return remainder === 0 ? hundredsMap[hundreds] : `${hundredsMap[hundreds]} ${toSpanishWords(remainder)}`;
  }

  if (value >= 30) {
    const tensMap: Record<number, string> = {
      3: "TREINTA",
      4: "CUARENTA",
      5: "CINCUENTA",
      6: "SESENTA",
      7: "SETENTA",
      8: "OCHENTA",
      9: "NOVENTA",
    };

    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    return remainder === 0 ? tensMap[tens] : `${tensMap[tens]} Y ${toSpanishWords(remainder)}`;
  }

  const directMap: Record<number, string> = {
    1: "UNO",
    2: "DOS",
    3: "TRES",
    4: "CUATRO",
    5: "CINCO",
    6: "SEIS",
    7: "SIETE",
    8: "OCHO",
    9: "NUEVE",
    10: "DIEZ",
    11: "ONCE",
    12: "DOCE",
    13: "TRECE",
    14: "CATORCE",
    15: "QUINCE",
    16: "DIECISEIS",
    17: "DIECISIETE",
    18: "DIECIOCHO",
    19: "DIECINUEVE",
    20: "VEINTE",
    21: "VEINTIUNO",
    22: "VEINTIDOS",
    23: "VEINTITRES",
    24: "VEINTICUATRO",
    25: "VEINTICINCO",
    26: "VEINTISEIS",
    27: "VEINTISIETE",
    28: "VEINTIOCHO",
    29: "VEINTINUEVE",
  };

  return directMap[value];
}
