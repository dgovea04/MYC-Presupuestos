"use client";

import Link from "next/link";
import type { ComponentProps, MouseEventHandler, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { trackClientEvent } from "@/lib/analytics/client";
import { cn } from "@/lib/utils";

type LandingV2ButtonProps = Omit<ComponentProps<typeof Link>, "className" | "children" | "onClick"> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
  showArrow?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
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
  onClick,
  ...props
}: LandingV2ButtonProps) {
  function handleClick(event: Parameters<MouseEventHandler<HTMLAnchorElement>>[0]) {
    if (typeof props.href === "string" && props.href.startsWith("/register")) {
      trackClientEvent("signup_started", {
        cta_location: "landing_v2_button",
        landing_path: window.location.pathname,
      });
    }

    onClick?.(event);
  }

  return (
    <Link {...props} onClick={handleClick} className={cn(baseClasses, variantClasses[variant], className)}>
      {children}
      {showArrow ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
    </Link>
  );
}
