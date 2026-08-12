import {
  SkeletonBlock,
  SkeletonButton,
  SkeletonCard,
  SkeletonIcon,
  SkeletonText,
} from "@/components/ui/loading";

export function SettingsPageSkeleton({ kind = "settings" }: { kind?: "settings" | "account" }) {
  const ariaLabel = kind === "account" ? "Cargando cuenta" : "Cargando configuracion";

  return (
    <section aria-busy="true" aria-label={ariaLabel} className="space-y-6" role="status">
      {kind === "account" ? <AccountSkeletonContent /> : <SettingsSkeletonContent />}
    </section>
  );
}

function SettingsSkeletonContent() {
  return (
    <>
      <SkeletonCard className="rounded-2xl" contentClassName="space-y-5">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-48" radius="md" />
          <SkeletonBlock className="h-4 w-[min(38rem,80vw)]" radius="md" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2 rounded-2xl border border-[var(--app-border-soft)] px-4 py-3">
              <SkeletonBlock className="h-4 w-32" radius="md" />
              <SkeletonBlock className="h-3 w-full" radius="md" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      <div className="grid items-start gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SkeletonCard className="rounded-2xl" contentClassName="space-y-5">
            <SettingsSectionHeading titleWidth="w-48" descriptionWidth="w-80" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <SkeletonBlock className="h-3 w-24" radius="md" />
                  <SkeletonBlock className="h-10 w-full" radius="xl" />
                </div>
              ))}
            </div>
            <SkeletonButton className="ml-auto w-36" size="sm" />
          </SkeletonCard>
          <SkeletonCard className="rounded-2xl" contentClassName="space-y-5">
            <SettingsSectionHeading titleWidth="w-64" descriptionWidth="w-96" />
            <SkeletonBlock className="h-32 w-full rounded-3xl" />
            <div className="grid gap-3 md:grid-cols-2">
              <SkeletonBlock className="h-28 rounded-2xl" />
              <SkeletonBlock className="h-28 rounded-2xl" />
            </div>
          </SkeletonCard>
        </div>
        <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
          <SettingsSectionHeading titleWidth="w-40" descriptionWidth="w-full" />
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--app-border-soft)] px-4 py-3">
              <SkeletonBlock className="h-4 w-28" radius="md" />
              <SkeletonBlock className="h-4 w-24" radius="md" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </>
  );
}

function AccountSkeletonContent() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <SkeletonCard className="rounded-2xl" contentClassName="space-y-6">
        <div className="flex items-center gap-3">
          <SkeletonIcon className="h-10 w-10 rounded-2xl" rounded={false} />
          <SettingsSectionHeading titleWidth="w-32" descriptionWidth="w-80" />
        </div>
        <SkeletonFormSection fields={4} />
        <SkeletonFormSection fields={2} />
        <SkeletonFormSection fields={3} />
      </SkeletonCard>

      <div className="space-y-6">
        <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
          <SettingsSectionHeading titleWidth="w-48" descriptionWidth="w-full" />
          <SkeletonBlock className="h-24 w-full rounded-2xl" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-12 rounded-2xl" />
            ))}
          </div>
          <SkeletonButton className="w-40" size="sm" />
        </SkeletonCard>
        <SkeletonCard className="rounded-2xl" contentClassName="space-y-4">
          <SettingsSectionHeading titleWidth="w-44" descriptionWidth="w-full" />
          <SkeletonBlock className="h-20 w-full rounded-2xl" />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--app-border-soft)] px-4 py-3">
              <SkeletonBlock className="h-4 w-24" radius="md" />
              <SkeletonBlock className="h-4 w-32" radius="md" />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </div>
  );
}

function SkeletonFormSection({ fields }: { fields: number }) {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--app-border-soft)] p-5">
      <SkeletonText lines={2} widths={["w-40", "w-72"]} />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <SkeletonBlock className="h-3 w-24" radius="md" />
            <SkeletonBlock className="h-10 w-full" radius="xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsSectionHeading({
  descriptionWidth,
  titleWidth,
}: {
  descriptionWidth: string;
  titleWidth: string;
}) {
  return (
    <div className="space-y-2">
      <SkeletonBlock className={`h-5 ${titleWidth}`} radius="md" />
      <SkeletonText lines={1} width={descriptionWidth} />
    </div>
  );
}
