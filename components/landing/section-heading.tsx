import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  badge: string;
  title: string;
  description: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
};

export function SectionHeading({ badge, title, description, align = "left", tone = "light" }: SectionHeadingProps) {
  const isCentered = align === "center";
  const isDark = tone === "dark";

  return (
    <div
      className={cn(
        isCentered ? "mx-auto flex max-w-[56rem] flex-col items-center text-center" : "max-w-[52rem]",
      )}
    >
      <span
        data-slot="badge"
        className={cn(
          "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.22em] uppercase",
          isDark
            ? "border border-white/10 bg-white/10 text-sky-300"
            : "border border-blue-100 bg-blue-50 text-blue-700",
        )}
      >
        {badge}
      </span>
      <h2
        className={cn(
          "font-display mt-4 text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-[2.4rem] xl:text-[2.65rem]",
          isDark ? "text-white" : "text-slate-950",
        )}
      >
        {title}
      </h2>
      <p className={cn("mt-3 max-w-[44rem] text-[0.97rem] leading-7 sm:text-base", isDark ? "text-slate-300" : "text-slate-600")}>
        {description}
      </p>
    </div>
  );
}
