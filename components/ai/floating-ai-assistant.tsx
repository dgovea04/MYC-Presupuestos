"use client";

import { BotMessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type FloatingAiAssistantProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FloatingAiAssistant({ open, onOpenChange }: FloatingAiAssistantProps) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex items-end justify-end">
      {open ? (
        <Card className="pointer-events-auto w-[min(420px,calc(100vw-2rem))] rounded-3xl border-slate-200 shadow-xl">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Khipu</p>
              <h2 className="text-base font-semibold text-slate-950">Asistente tecnico</h2>
            </div>
            <Button
              data-khipu-close
              type="button"
              variant="ghost"
              className="h-9 w-9 rounded-xl p-0"
              aria-label="Cerrar Khipu"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Button
        data-khipu-launcher
        type="button"
        className="pointer-events-auto ml-3 h-14 rounded-2xl px-4 shadow-lg"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <BotMessageSquare className="mr-2 h-5 w-5" />
        Khipu
      </Button>
    </div>
  );
}
