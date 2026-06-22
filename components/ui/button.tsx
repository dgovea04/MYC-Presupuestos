import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ui-button inline-flex items-center justify-center rounded-xl text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "ui-button-default bg-sky-600 text-white shadow-[0_12px_28px_-18px_rgba(2,132,199,0.55)] hover:bg-sky-700 hover:shadow-[0_16px_32px_-20px_rgba(2,132,199,0.6)]",
        outline: "ui-button-outline border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-strong)] hover:border-slate-400 hover:bg-[var(--app-surface-muted)]",
        secondary: "ui-button-secondary bg-slate-900 text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)] hover:bg-slate-800",
        ghost: "ui-button-ghost text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)]",
        destructive: "bg-rose-600 text-white shadow-[0_12px_28px_-18px_rgba(225,29,72,0.45)] hover:bg-rose-700",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, type = "button", variant, size, ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} type={type} {...props} />;
});
