import type { ReactNode } from "react";
import { SkeletonButton, SkeletonText } from "@/components/ui/loading";

export function PageSkeletonFrame({
  "aria-label": ariaLabel = "Cargando pagina",
  actions = 1,
  children,
  descriptionWidth = "w-96",
  titleWidth = "w-56",
}: {
  "aria-label"?: string;
  actions?: number;
  children: ReactNode;
  descriptionWidth?: string;
  titleWidth?: string;
}) {
  return (
    <section aria-busy="true" aria-label={ariaLabel} className="space-y-5" role="status">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <SkeletonText lines={2} widths={[titleWidth, descriptionWidth]} />
        {actions > 0 ? (
          <div className="flex flex-wrap gap-2 md:justify-end">
            {Array.from({ length: actions }).map((_, index) => (
              <SkeletonButton key={index} size={index === 0 ? "md" : "sm"} />
            ))}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
