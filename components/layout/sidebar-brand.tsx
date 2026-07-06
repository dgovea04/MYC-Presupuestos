import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOGO_VERSION = "20260529b";

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
    <div className={cn("relative flex w-full items-start gap-3", isMini ? "flex-col items-center pt-2" : "justify-between")}>
      <div className={cn("flex", isMini ? "flex-col items-center" : "flex-col items-start gap-2")}>
        <div className={cn("relative overflow-hidden", isMini ? "w-10" : "w-[140px]")}>
          <Image
            src={isMini ? `/myc-logo-tr-mini.svg?v=${LOGO_VERSION}` : "/nuevo-logo-white-300-v3.png"}
            alt="MC Presupuestos"
            priority
            width={isMini ? 40 : 140}
            height={isMini ? 40 : 40}
            className={cn("object-contain object-left", isMini && "h-full w-full object-contain object-center")}
          />
        </div>
      </div>

      {isMini ? (
        <Button
          aria-controls={navigationId}
          aria-expanded={!isMini}
          aria-label="Expandir sidebar"
          className="absolute top-[55px] h-[20px] w-[40px] rounded-full border border-white/15 bg-slate-800 p-0 text-white shadow-lg shadow-slate-950/30 hover:bg-slate-700"
          size="sm"
          variant="ghost"
          onClick={onToggle}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          aria-controls={navigationId}
          aria-expanded={!isMini}
          aria-label="Contraer sidebar"
          className="border-white/10 bg-white/10 text-white hover:bg-white/15"
          size="sm"
          variant="ghost"
          onClick={onToggle}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
