import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencySymbols: Record<string, string> = {
  PEN: "S/",
  USD: "$",
  EUR: "EUR",
};

export function formatNumber(value: number, decimalPlaces = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);
}

export function formatCurrency(value: number, currency = "PEN", decimalPlaces = 2) {
  const symbol = currencySymbols[currency] ?? currency;
  const sign = value < 0 ? "-" : "";
  return `${sign}${symbol} ${formatNumber(Math.abs(value), decimalPlaces)}`;
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "Sin fecha";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
