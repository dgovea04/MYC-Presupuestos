import { SkeletonForm } from "@/components/ui/loading";

export function SettingsPageSkeleton({ kind = "settings" }: { kind?: "settings" | "account" }) {
  const ariaLabel = kind === "account" ? "Cargando cuenta" : "Cargando configuracion";

  return (
    <section aria-busy="true" aria-label={ariaLabel} className="space-y-4" role="status">
      <SkeletonForm aria-label={ariaLabel} fieldsPerSection={3} sections={kind === "account" ? 2 : 3} />
    </section>
  );
}
