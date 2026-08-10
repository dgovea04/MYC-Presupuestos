import { SkeletonBlock } from "@/components/ui/loading/skeleton-block";
import { SkeletonCard } from "@/components/ui/loading/skeleton-card";
import { SkeletonText } from "@/components/ui/loading/skeleton-text";
import { cn } from "@/lib/utils";

export function SkeletonForm({
  "aria-label": ariaLabel = "Cargando formulario",
  className,
  fieldsPerSection = 3,
  sections = 2,
}: {
  "aria-label"?: string;
  className?: string;
  fieldsPerSection?: number;
  sections?: number;
}) {
  return (
    <div aria-busy="true" aria-label={ariaLabel} className={cn("space-y-4", className)} role="status">
      {Array.from({ length: sections }).map((_, sectionIndex) => (
        <SkeletonCard key={sectionIndex} className="min-h-[190px]">
          <div className="space-y-5">
            <SkeletonText lines={2} widths={["w-44", "w-72"]} />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: fieldsPerSection }).map((_, fieldIndex) => (
                <div key={fieldIndex} className="space-y-2">
                  <SkeletonBlock className="h-3 w-24" radius="md" />
                  <SkeletonBlock className="h-10 w-full" radius="xl" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
