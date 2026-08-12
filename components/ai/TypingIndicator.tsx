"use client";

/**
 * Animated typing indicator — three bouncing dots that stagger,
 * shown while Khipu is loading/consulting.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--app-border-soft)] bg-gradient-to-r from-sky-50/70 to-cyan-50/40 px-4 py-3 shadow-sm">
      <span className="text-xs font-medium text-slate-500">Khipu está escribiendo</span>
      <span className="flex items-center gap-1 pb-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--khipu-cyan)] animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
          />
        ))}
      </span>
    </div>
  );
}
