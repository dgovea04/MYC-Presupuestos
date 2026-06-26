import Image from "next/image";
import { cn } from "@/lib/utils";

export function LandingLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-13 w-[132px] sm:h-14 sm:w-[148px]">
        <Image
          src="/nuevo-logo-300-v3.png"
          alt="MC Presupuestos"
          fill
          priority
          sizes="148px"
          className="object-contain object-left"
        />
      </div>
    </div>
  );
}
