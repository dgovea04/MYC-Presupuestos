import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SidebarBrand({
  mode,
  navigationId,
  onToggle,
}: {
  mode: "expanded" | "mini";
  navigationId: string;
  onToggle: () => void;
}) {
  const isMini = mode === "mini";

  return (
    <div className={cn("flex w-full items-start gap-3", isMini ? "flex-col items-center" : "justify-between")}>
      <div className={cn("flex items-center gap-3", isMini && "flex-col")}>
        <div className={cn("relative overflow-hidden", isMini ? "h-10 w-10" : "h-10 w-[120px]")}>
          <Image
            src="/myc-logo-tr-300px-v1.png"
            alt="MYC Presupuestos"
            priority
            width={120}
            height={40}
            className={cn("object-contain object-left", isMini && "h-full w-full object-contain object-center")}
          />
        </div>
        {!isMini ? <p className="max-w-[11rem] text-sm leading-5 text-slate-300">Costos y presupuestos de obra</p> : null}
      </div>

      <Button
        aria-controls={navigationId}
        aria-expanded={!isMini}
        aria-label={isMini ? "Expandir sidebar" : "Contraer sidebar"}
        className={cn("border-white/10 bg-white/10 text-white hover:bg-white/15", isMini && "self-center")}
        size="sm"
        variant="ghost"
        onClick={onToggle}
      >
        {isMini ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </div>
  );
}
