"use client";

import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

type ImportProgressPanelStatus = "running" | "success" | "error";

export type ImportProgressPanelStep = {
  label: string;
};

type ImportProgressPanelProps = {
  status: ImportProgressPanelStatus;
  title: string;
  detail: string;
  progress: number;
  steps: ImportProgressPanelStep[];
  activeStepIndex: number;
  fileName?: string;
  fileSize?: number;
};

export function ImportProgressPanel({
  status,
  title,
  detail,
  progress,
  steps,
  activeStepIndex,
  fileName,
  fileSize,
}: ImportProgressPanelProps) {
  const normalizedProgress = clampProgress(progress);
  const isRunning = status === "running";

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/60 shadow-sm">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-white text-sky-700 shadow-sm">
            {status === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : isRunning ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-1 text-sm text-slate-600">{detail}</p>
            {fileName ? (
              <p className="mt-2 truncate text-xs text-slate-500">
                {fileName}
                {fileSize ? ` · ${formatFileSize(fileSize)}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 rounded-full border border-white/80 bg-white px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
          {normalizedProgress}%
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="h-2 overflow-hidden rounded-full bg-white shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-500 ${status === "error" ? "bg-rose-500" : "bg-sky-600"}`}
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {steps.map((step, index) => {
            const isComplete = index < activeStepIndex || status === "success";
            const isActive = index === activeStepIndex && isRunning;

            return (
              <div
                key={step.label}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  isComplete
                    ? "border-emerald-100 bg-white text-emerald-700"
                    : isActive
                      ? "border-sky-200 bg-white text-sky-700"
                      : "border-slate-100 bg-white/60 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isComplete ? "bg-emerald-500" : isActive ? "animate-pulse bg-sky-500" : "bg-slate-300"
                    }`}
                  />
                  <span className="truncate font-medium">{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {isRunning ? (
          <p className="mt-3 text-xs text-slate-500">
            Los archivos grandes pueden tardar varios minutos. Mantén esta pantalla abierta hasta que termine la importación.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
