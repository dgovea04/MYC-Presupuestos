import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type LandingLinkButtonProps = Omit<ComponentProps<typeof Link>, "className" | "children"> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

const baseClasses =
  "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

const variantClasses: Record<NonNullable<LandingLinkButtonProps["variant"]>, string> = {
  primary:
    "bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] text-white shadow-[0_12px_30px_-12px_rgba(37,99,235,0.55)] hover:shadow-[0_16px_40px_-16px_rgba(37,99,235,0.6)] hover:opacity-95",
  secondary: "border border-slate-200/90 bg-white/90 text-slate-900 shadow-sm shadow-slate-200/70 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

export function LandingLinkButton({
  children,
  variant = "primary",
  className,
  ...props
}: LandingLinkButtonProps) {
  return (
    <Link
      {...props}
      className={cn(
        baseClasses,
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
