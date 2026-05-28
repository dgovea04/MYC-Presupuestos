import { heroMetrics, terminalPanes } from "@/components/landing-v2/landing-v2-content";

export function TerminalWorkbench() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-6xl">
      <div className="absolute inset-x-8 top-1/2 h-52 -translate-y-1/2 rounded-full bg-[#1a26ff]/35 blur-3xl" />
      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-[#222222] bg-black p-3 sm:p-5 lg:p-8">
        <div className="mb-4 flex min-w-0 items-center justify-between gap-4 border-b border-[#1a1a1a] pb-4">
          <div className="flex shrink-0 items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff4d4d]" />
            <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
            <span className="h-3 w-3 rounded-full bg-[#33d17a]" />
          </div>
          <p className="min-w-0 truncate text-right font-mono text-xs text-[#666666]">obra/miraflores-12/presupuesto</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {terminalPanes.map((pane) => (
            <article key={pane.title} className="min-h-56 min-w-0 rounded-xl border border-[#222222] bg-[#181818] p-5">
              <div className="flex min-w-0 items-center justify-between gap-4">
                <p className="shrink-0 font-mono text-xs text-[#888888]">{pane.eyebrow}</p>
                <p className="min-w-0 truncate text-right font-mono text-xs text-white">{pane.title}</p>
              </div>
              <pre className="mt-5 overflow-x-auto whitespace-pre-wrap text-left font-mono text-[13px] leading-6 text-[#a8a8a8]">
                {pane.lines.join("\n")}
              </pre>
            </article>
          ))}
        </div>
        <div className="mt-4 grid gap-3 border-t border-[#1a1a1a] pt-4 md:grid-cols-3">
          {heroMetrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-[#222222] bg-[#0f0f0f] px-4 py-3">
              <p className="text-xs text-[#888888]">{metric.label}</p>
              <p className="mt-2 text-sm font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
