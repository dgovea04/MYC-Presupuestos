"use client";

import Link from "next/link";
import { ChevronDown, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import type { FeatureKey } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

export type SidebarNavLink = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  requiredFeature?: FeatureKey;
};

export type SidebarNavGroup = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: SidebarNavLink[];
};

export type SidebarNavItem = SidebarNavLink | SidebarNavGroup;

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSidebarNavGroup(item: SidebarNavItem): item is SidebarNavGroup {
  return "children" in item;
}

function getActiveGroupIds(items: SidebarNavItem[], pathname: string) {
  return items
    .filter((item): item is SidebarNavGroup => isSidebarNavGroup(item))
    .filter((item) => item.children.some((child) => isActivePath(pathname, child.href)))
    .map((item) => item.id);
}

export function SidebarNav({
  mode,
  pathname,
  navigationId,
  items,
  unlockedFeatures = [],
}: {
  mode: "expanded" | "mini";
  pathname: string;
  navigationId: string;
  items: SidebarNavItem[];
  unlockedFeatures?: FeatureKey[];
}) {
  const isMini = mode === "mini";
  const navRef = useRef<HTMLElement>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>(() => getActiveGroupIds(items, pathname));
  const [floatingGroup, setFloatingGroup] = useState<{ id: string; pathname: string } | null>(null);
  const floatingGroupId = isMini && floatingGroup?.pathname === pathname ? floatingGroup.id : null;

  useEffect(() => {
    if (!floatingGroupId) {
      return;
    }

    const closeFloatingGroupOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node) || navRef.current?.contains(target)) {
        return;
      }

      setFloatingGroup(null);
    };

    document.addEventListener("pointerdown", closeFloatingGroupOnOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", closeFloatingGroupOnOutsidePointerDown);
    };
  }, [floatingGroupId]);

  const toggleGroup = (groupId: string) => {
    if (isMini) {
      setFloatingGroup((currentGroup) =>
        currentGroup?.id === groupId && currentGroup.pathname === pathname ? null : { id: groupId, pathname },
      );
      return;
    }

    setExpandedGroupIds((currentGroupIds) =>
      currentGroupIds.includes(groupId)
        ? currentGroupIds.filter((currentGroupId) => currentGroupId !== groupId)
        : [...currentGroupIds, groupId],
    );
  };

  return (
    <nav className={cn("mt-6 flex w-full flex-col gap-2", isMini && "mt-[50px] items-center")} id={navigationId} ref={navRef}>
      {items.map((item) => {
        const Icon = item.icon;

        if (isSidebarNavGroup(item)) {
          const active = item.children.some((child) => isActivePath(pathname, child.href));
          const expanded = !isMini && (active || expandedGroupIds.includes(item.id));
          const floatingOpen = isMini && floatingGroupId === item.id;
          const groupPanelId = `${navigationId}-${item.id}`;

          return (
            <div className={cn("w-full", isMini && "relative flex justify-center")} key={item.id}>
              <button
                aria-controls={groupPanelId}
                aria-expanded={isMini ? floatingOpen : expanded}
                className={cn(
                  "flex w-full items-center rounded-2xl px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                  active ? "bg-white/14 text-white" : "text-slate-200 hover:bg-white/10",
                  isMini ? "h-14 w-14 justify-center px-0" : "gap-3.5",
                )}
                onClick={() => toggleGroup(item.id)}
                title={isMini ? item.label : undefined}
                type="button"
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isMini ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")} />
                  </>
                )}
              </button>

              {isMini ? (
                <div
                  className={cn(
                    "absolute left-[calc(100%+0.75rem)] top-0 z-30 w-64 rounded-2xl border border-slate-700/70 bg-slate-950/98 p-2 text-white shadow-2xl shadow-slate-950/25 transition",
                    floatingOpen ? "visible translate-x-0 opacity-100" : "invisible translate-x-1 opacity-0",
                  )}
                  id={groupPanelId}
                >
                  <div className="px-3 py-2 text-xs font-medium uppercase text-slate-400">{item.label}</div>
                  <div className="flex flex-col gap-1">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = isActivePath(pathname, child.href);
                      const childLocked = child.requiredFeature ? !unlockedFeatures.includes(child.requiredFeature) : false;

                      return (
                        <Link
                          aria-current={childActive ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                            childActive ? "bg-white/14 text-white" : "text-slate-200 hover:bg-white/10 hover:text-white",
                            childLocked && "text-slate-500 hover:bg-white/[0.04] hover:text-slate-400",
                          )}
                          href={child.href}
                          key={child.href}
                          title={childLocked ? `${child.label} disponible en Pro` : undefined}
                        >
                          <ChildIcon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1">{child.label}</span>
                          {childLocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={cn("grid transition-[grid-template-rows] duration-200", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} id={groupPanelId}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="mt-1 flex flex-col gap-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = isActivePath(pathname, child.href);
                        const childLocked = child.requiredFeature ? !unlockedFeatures.includes(child.requiredFeature) : false;

                        return (
                          <Link
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                              childActive ? "bg-white/14 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
                              childLocked && "text-slate-500 hover:bg-white/[0.04] hover:text-slate-400",
                            )}
                            href={child.href}
                            key={child.href}
                            title={childLocked ? `${child.label} disponible en Pro` : undefined}
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1">{child.label}</span>
                            {childLocked ? <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }

        const active = isActivePath(pathname, item.href);
        const locked = item.requiredFeature ? !unlockedFeatures.includes(item.requiredFeature) : false;

        return (
          <Link
            key={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center rounded-2xl px-3 py-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
              active ? "bg-white/14 text-white" : "text-slate-200 hover:bg-white/10",
              locked && "text-slate-500 hover:bg-white/[0.04] hover:text-slate-400",
              isMini ? "w-14 justify-center px-0" : "gap-3.5",
            )}
            href={item.href}
            title={locked ? `${item.label} disponible en Pro` : isMini ? item.label : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {isMini ? (
              <>
                <span className="sr-only">{item.label}</span>
                {locked ? (
                  <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-400 shadow-sm">
                    <Lock className="h-3 w-3" />
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1">{item.label}</span>
                {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-slate-500" /> : null}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
