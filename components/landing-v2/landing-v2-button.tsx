import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type LandingV2ButtonProps = Omit<ComponentProps<typeof Link>, "className" | "children"> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
  showArrow?: boolean;
  className?: string;
};

const baseClasses =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a26ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]";

const variantClasses: Record<NonNullable<LandingV2ButtonProps["variant"]>, string> = {
  primary: "bg-[#0007cd] text-white hover:bg-[#0005a3]",
  secondary: "bg-[#222222] text-white hover:bg-[#2a2a2a]",
  outline: "border border-[#333333] bg-transparent text-white hover:bg-[#181818]",
};

export function LandingV2Button({
  children,
  variant = "primary",
  showArrow = false,
  className,
  ...props
}: LandingV2ButtonProps) {
  return (
    <Link {...props} className={cn(baseClasses, variantClasses[variant], className)}>
      {children}
      {showArrow ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
    </Link>
  );
}
