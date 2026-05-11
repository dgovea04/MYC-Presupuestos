"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatCurrency } from "@/lib/utils";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";

export function AnimatedCurrencyValue({
  value,
  currency = "PEN",
  className,
}: {
  value: number;
  currency?: string;
  className?: string;
}) {
  const { currencyDecimals } = useFormattingSettings();
  const previousValue = useRef(value);
  const [changeTone, setChangeTone] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (previousValue.current === value) return;

    setChangeTone(value >= previousValue.current ? "up" : "down");
    previousValue.current = value;

    const timeout = window.setTimeout(() => setChangeTone(null), 850);
    return () => window.clearTimeout(timeout);
  }, [value]);

  return (
    <span
      className={cn(
        "inline-flex rounded-lg px-2 py-1 tabular-nums transition-all duration-700",
        changeTone === "up" ? "scale-[1.03] text-emerald-700" : "",
        changeTone === "down" ? "scale-[1.03] text-rose-700" : "",
        className,
      )}
    >
      {formatCurrency(value, currency, currencyDecimals)}
    </span>
  );
}
