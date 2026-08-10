import { PageSkeletonFrame } from "@/components/loading/page-skeleton-frame";
import { SkeletonForm } from "@/components/ui/loading";

export function SettingsPageSkeleton({ kind = "settings" }: { kind?: "settings" | "account" }) {
  return (
    <PageSkeletonFrame
      aria-label={kind === "account" ? "Cargando cuenta" : "Cargando configuracion"}
      actions={0}
      descriptionWidth="w-72"
      titleWidth={kind === "account" ? "w-40" : "w-48"}
    >
      <SkeletonForm
        aria-label={kind === "account" ? "Cargando cuenta" : "Cargando configuracion"}
        fieldsPerSection={3}
        sections={kind === "account" ? 2 : 3}
      />
    </PageSkeletonFrame>
  );
}
