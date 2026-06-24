"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppBackButton() {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/dashboard");
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={cn(
        "theme-back-button inline-flex h-10 items-center gap-2 rounded-full px-1 text-sm font-medium transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
      )}
    >
      <span className="theme-back-button-icon inline-flex h-8 w-8 items-center justify-center rounded-full">
        <ArrowLeft className="h-4 w-4" />
      </span>
      <span>Ir atras</span>
    </button>
  );
}
