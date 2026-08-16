"use client";

import Link from "next/link";
import type { ComponentProps, MouseEventHandler, ReactNode } from "react";
import { trackClientEvent } from "@/lib/analytics/client";
import { captureRegistrationContext } from "@/lib/analytics/utm";
import { cn } from "@/lib/utils";

type AcquisitionCtaProps = Omit<ComponentProps<typeof Link>, "children" | "className" | "onClick"> & {
  children: ReactNode;
  location: string;
  variant?: "primary" | "secondary" | "dark";
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function AcquisitionCta({ children, location, variant = "primary", className, onClick, ...props }: AcquisitionCtaProps) {
  function handleClick(event: Parameters<MouseEventHandler<HTMLAnchorElement>>[0]) {
    if (typeof props.href === "string" && props.href.startsWith("/register")) {
      const landingPath = window.location.pathname;
      trackClientEvent("signup_started", { cta_location: location, landing_path: landingPath, landing_variant: "acquisition-v1" });
      captureRegistrationContext({ landing_path: landingPath, landing_variant: "acquisition-v1", cta_location: location });
    }
    onClick?.(event);
  }

  return (
    <Link
      {...props}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
        variant === "primary" && "bg-blue-600 text-white shadow-[0_16px_34px_-18px_rgba(37,99,235,0.8)] hover:bg-blue-700",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-900 shadow-sm hover:border-blue-200 hover:bg-blue-50",
        variant === "dark" && "border border-white/15 bg-white/10 text-white hover:bg-white/15",
        className,
      )}
    >
      {children}
    </Link>
  );
}
