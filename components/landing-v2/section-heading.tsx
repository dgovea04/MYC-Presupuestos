import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  badge: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  badge,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      <span className="inline-flex rounded-full bg-[#222222] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-white uppercase">
        {badge}
      </span>
      <h2 className="mt-5 text-3xl font-medium tracking-[-0.015em] text-white sm:text-4xl lg:text-[44px] lg:leading-[1.1]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-[#a8a8a8]">{description}</p>
      ) : null}
    </div>
  );
}
