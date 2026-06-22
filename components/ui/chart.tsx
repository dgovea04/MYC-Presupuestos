"use client";

import React from "react";

// ---------------------------------------------------------------------------
// Minimal tooltip – clean, no backdrop‑blur, no shadow‑lg, no animation
// ---------------------------------------------------------------------------

/**
 * Base tooltip content for dashboard charts.
 *
 * Removes the emergent animation (`backdrop-blur`, `shadow-lg`) and uses a
 * flat, clean card that inherits the app surface token.
 *
 * The `payload` prop matches the subset of recharts `Payload` that the
 * tooltip content renders – `name`, `value`, and `color` for the dot.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  labelClassName,
  children,
}: {
  active?: boolean;
  // Accept any recharts Payload shape – we only access .name, .value, .color
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: ReadonlyArray<Record<string, any>>;
  label?: string | number;
  labelClassName?: string;
  children: React.ReactNode;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2.5 text-sm">
      {label != null && (
        <p className={labelClassName ?? "mb-1.5 text-xs font-medium text-[var(--app-text-muted)]"}>
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Re‑export recharts Tooltip for convenience
// ---------------------------------------------------------------------------

export { Tooltip } from "recharts";
