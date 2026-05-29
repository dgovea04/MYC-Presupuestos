import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_VERSION = "20260529b";

export function LandingLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-11 w-[132px] sm:h-12 sm:w-[148px]">
        <Image
          src={`/myc-logo-tr-300px-v1.png?v=${LOGO_VERSION}`}
          alt="MYC Presupuestos"
          fill
          priority
          sizes="148px"
          className="object-contain object-left"
        />
      </div>
    </div>
  );
}
