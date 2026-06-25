import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEFAULT_DATE_FORMAT, type DateFormatOption } from "@/types/settings";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ensureDate(value: Date | string | undefined | null): Date {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
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

export function formatDate(value?: string | Date | null, dateFormat: DateFormatOption = DEFAULT_DATE_FORMAT) {
  if (!value) return "Sin fecha";
  const date = typeof value === "string" ? new Date(value) : value;

  if (dateFormat === "DD_MM_YYYY") {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  if (dateFormat === "DD_MM") {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  }

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
