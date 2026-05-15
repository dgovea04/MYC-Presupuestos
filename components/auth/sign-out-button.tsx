"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={compact ? "Cerrar sesion" : undefined}
      className={cn("w-full border-white/20 bg-transparent text-white hover:bg-white/10", compact && "justify-center px-0")}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {compact ? <span className="sr-only">Cerrar sesion</span> : <span className="ml-2">Cerrar sesion</span>}
    </Button>
  );
}
