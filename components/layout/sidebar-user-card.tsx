import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";

export function SidebarUserCard({
  mode,
  user,
}: {
  mode: "expanded" | "mini";
  user: {
    initials: string;
    name: string;
    email: string;
  };
}) {
  const isMini = mode === "mini";

  return (
    <div className={cn("mt-auto w-full rounded-2xl bg-white/10 text-slate-200", isMini ? "p-3" : "p-4")}>
      <div className={cn("flex items-center", isMini ? "justify-center" : "gap-3")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sm font-semibold text-sky-100">
          {user.initials}
        </div>
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
      <div className={cn(isMini ? "mt-3 flex justify-center" : "mt-4")}>
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
