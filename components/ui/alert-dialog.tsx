"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

export function AlertDialog({
  open,
  title,
  description,
  confirmLabel = "Continuar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl outline-none">
          <Dialog.Title className="text-base font-semibold text-[var(--app-text-strong)]">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">{description}</Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>{cancelLabel}</Button>
            <Button type="button" onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
