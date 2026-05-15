import Link from "next/link";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type SidebarNavLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  mode,
  pathname,
  navigationId,
  links,
}: {
  mode: "expanded" | "mini";
  pathname: string;
  navigationId: string;
  links: SidebarNavLink[];
}) {
  const isMini = mode === "mini";

  return (
    <nav className={cn("mt-6 flex w-full flex-col gap-2", isMini && "items-center")} id={navigationId}>
      {links.map((link) => {
        const Icon = link.icon;
        const active = isActivePath(pathname, link.href);

        return (
          <Link
            key={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center rounded-2xl px-3 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
              active ? "bg-white/14 text-white" : "text-slate-200 hover:bg-white/10",
              isMini ? "w-12 justify-center px-0" : "gap-3",
            )}
            href={link.href}
            title={isMini ? link.label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {isMini ? <span className="sr-only">{link.label}</span> : <span>{link.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
