import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback } from "react";
import { CircleUserRound } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";

export function SidebarUserCard({
  mode,
  user,
}: {
  mode: "expanded" | "mini";
  user: {
    avatarUrl?: string | null;
    initials: string;
    name: string;
    email: string;
  };
}) {
  const isMini = mode === "mini";
  const router = useRouter();
  const prefetchAccount = useCallback(() => {
    router.prefetch("/account");
  }, [router]);

  return (
    <div className={cn("mt-auto w-full rounded-2xl bg-white/10 text-slate-200", isMini ? "p-3" : "p-4")}>
      <div className={cn("flex items-center", isMini ? "relative left-[-5px] w-fit justify-center" : "gap-3")}>
        {user.avatarUrl ? (
          <Image
            alt={`Avatar de ${user.name}`}
            className={cn("shrink-0 rounded-full object-cover", isMini ? "h-8 w-8" : "h-10 w-10")}
            height={isMini ? 32 : 40}
            src={user.avatarUrl}
            width={isMini ? 32 : 40}
          />
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sm font-semibold text-sky-100",
              isMini ? "h-8 w-8" : "h-10 w-10",
            )}
          >
            {user.initials}
          </div>
        )}
        {!isMini ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-300">{user.email}</p>
            <p className="mt-2 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] font-medium text-emerald-200">
              Cuenta activa
            </p>
          </div>
        ) : null}
      </div>
      <div className={cn(isMini ? "mt-3 flex flex-col items-center gap-2" : "mt-4 space-y-2")}>
        <Link
          aria-label={isMini ? "Mi perfil" : undefined}
          className={cn(
            "inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/8 text-sm font-medium text-white transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
            isMini ? "h-10 w-10" : "w-full gap-2 px-3 py-2.5",
          )}
          href="/account"
          onMouseEnter={prefetchAccount}
          prefetch={true}
          title={isMini ? "Mi perfil" : undefined}
        >
          <CircleUserRound className="h-4 w-4 shrink-0" />
          {isMini ? <span className="sr-only">Mi perfil</span> : <span>Mi perfil</span>}
        </Link>
        <div
          className={cn(
            isMini &&
              "w-full max-w-12 overflow-hidden [&_button]:w-full [&_button]:justify-center [&_button]:px-0 [&_button]:text-[0px]",
          )}
        >
          <SignOutButton compact={isMini} />
        </div>
      </div>
    </div>
  );
}
