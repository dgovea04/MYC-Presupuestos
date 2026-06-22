"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { useDisableBodyScrollLockCompensation } from "@/hooks/use-disable-body-scroll-lock-compensation";
import { cn } from "@/lib/utils";
import {
  extractSelectOptions,
  partitionSelectOptions,
  type SelectOptionRecord,
  type SelectOptionChildren,
} from "@/lib/ui/select-options";

type SelectTriggerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "defaultValue" | "name" | "onChange" | "required" | "value"
>;

type SelectChangeTarget = {
  id: string | undefined;
  name: string | undefined;
  value: string;
};

export type SelectValueChangeEvent = {
  currentTarget: SelectChangeTarget;
  target: SelectChangeTarget;
};

export type SelectProps = SelectTriggerProps & {
  autoComplete?: string;
  children: SelectOptionChildren;
  contentClassName?: string;
  contentPosition?: "popper" | "item-aligned";
  contentSideOffset?: number;
  defaultValue?: string;
  disableBodyScrollLockCompensation?: boolean;
  form?: string;
  name?: string;
  onChange?: (event: SelectValueChangeEvent) => void;
  portalContainer?: HTMLElement | null;
  portal?: boolean;
  required?: boolean;
  value?: string;
};

type SelectViewMode = "modern" | "excel";
type SelectRenderableOption = ReturnType<typeof mapRenderableOption>;

const EMPTY_OPTION_RADIX_PREFIX = "__myc_select_empty__";
const VISUALLY_HIDDEN_SELECT_STYLES: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  appearance: "none",
  border: 0,
  background: "transparent",
  opacity: 0,
  pointerEvents: "none",
};

function mapRenderableOption(option: SelectOptionRecord, index: number) {
  return {
    ...option,
    radixValue: option.value === "" ? `${EMPTY_OPTION_RADIX_PREFIX}${index}` : option.value,
  };
}

export function Select({
  autoFocus,
  autoComplete,
  children,
  className,
  contentClassName,
  contentPosition = "popper",
  contentSideOffset = 6,
  defaultValue,
  disableBodyScrollLockCompensation = false,
  disabled,
  form,
  id,
  name,
  onChange,
  portalContainer,
  portal = true,
  required,
  title,
  tabIndex,
  value,
  ...triggerProps
}: SelectProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const fallbackSelectRef = React.useRef<HTMLSelectElement | null>(null);
  const pendingFallbackUserChangeRef = React.useRef<string | null>(null);
  const pendingFallbackResetTimeoutRef = React.useRef<number | null>(null);
  const options = React.useMemo(() => extractSelectOptions(children), [children]);
  const { placeholderOption, renderableOptions: rawRenderableOptions } = React.useMemo(
    () => partitionSelectOptions(options),
    [options],
  );
  const renderableOptions = React.useMemo<SelectRenderableOption[]>(
    () => rawRenderableOptions.map((option, index) => mapRenderableOption(option, index)),
    [rawRenderableOptions],
  );

  const fallbackValue = React.useMemo(
    () => String(defaultValue ?? value ?? renderableOptions.find((option) => !option.disabled)?.value ?? ""),
    [defaultValue, renderableOptions, value],
  );

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(() => fallbackValue);
  const [open, setOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<SelectViewMode>("modern");
  const usesNativeFallbackFormControl = true;

  useDisableBodyScrollLockCompensation(disableBodyScrollLockCompensation && open);

  const selectedValue = isControlled ? String(value ?? "") : internalValue;
  const selectedOption = renderableOptions.find((option) => option.value === selectedValue) ?? null;
  const selectedRadixValue = selectedOption?.radixValue ?? selectedValue;

  const clearPendingFallbackUserChange = React.useCallback(() => {
    pendingFallbackUserChangeRef.current = null;

    if (pendingFallbackResetTimeoutRef.current !== null) {
      window.clearTimeout(pendingFallbackResetTimeoutRef.current);
      pendingFallbackResetTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const modeSource = container.parentElement?.closest<HTMLElement>("[data-view-mode]");

    const syncViewMode = () => {
      const nextMode = modeSource?.dataset.viewMode === "excel" ? "excel" : "modern";
      setViewMode(nextMode);
    };

    syncViewMode();

    if (!modeSource) {
      return;
    }

    const observer = new MutationObserver(syncViewMode);
    observer.observe(modeSource, { attributes: true, attributeFilter: ["data-view-mode"] });

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    return () => {
      clearPendingFallbackUserChange();
    };
  }, [clearPendingFallbackUserChange]);

  React.useEffect(() => {
    const nativeSelect = fallbackSelectRef.current;

    if (!nativeSelect) {
      return;
    }

    const selectProto = window.HTMLSelectElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(selectProto, "value");
    const setValue = descriptor?.set;

    if (!setValue) {
      clearPendingFallbackUserChange();
      return;
    }

    if (nativeSelect.value === selectedValue) {
      if (pendingFallbackUserChangeRef.current === selectedValue) {
        clearPendingFallbackUserChange();
      }

      return;
    }

    setValue.call(nativeSelect, selectedValue);

    if (pendingFallbackUserChangeRef.current === selectedValue) {
      nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    clearPendingFallbackUserChange();
  }, [clearPendingFallbackUserChange, selectedValue]);

  function handleValueChange(nextValue: string) {
    const nextOption = renderableOptions.find((option) => option.radixValue === nextValue);
    const externalValue = nextOption?.value ?? nextValue;

    if (usesNativeFallbackFormControl) {
      clearPendingFallbackUserChange();
      pendingFallbackUserChangeRef.current = externalValue;
      pendingFallbackResetTimeoutRef.current = window.setTimeout(() => {
        clearPendingFallbackUserChange();
      }, 0);
    }

    if (!isControlled) {
      setInternalValue(externalValue);
    }

    if (onChange) {
      const target = { value: externalValue, name, id };
      onChange({ target, currentTarget: target });
    }
  }

  const content = (
    <SelectPrimitive.Content
      data-view-mode={viewMode}
      position={contentPosition}
      sideOffset={contentSideOffset}
      className={cn(
        "ui-select-content z-50 max-h-96 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-xl",
        contentClassName,
      )}
    >
      <SelectPrimitive.Viewport className="max-h-96 overflow-y-auto p-1">
        {renderableOptions.map((option) => (
          <SelectPrimitive.Item
            data-view-mode={viewMode}
            key={`${option.value}-${option.label}`}
            value={option.radixValue}
            disabled={option.disabled}
            className={cn(
              "ui-select-item relative flex min-h-9 cursor-default select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm text-slate-700 outline-none",
              "data-[highlighted]:bg-slate-900 data-[highlighted]:text-white",
              "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
              option.tone === "warning" &&
                "bg-amber-50 font-medium text-amber-800 data-[highlighted]:bg-amber-500 data-[highlighted]:text-white",
            )}
          >
            <span className="absolute left-2 inline-flex h-4 w-4 items-center justify-center">
              <SelectPrimitive.ItemIndicator>
                <Check className="h-4 w-4" />
              </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
          </SelectPrimitive.Item>
        ))}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  );

  return (
    <div ref={containerRef} className="ui-select relative">
      <select
        ref={fallbackSelectRef}
        aria-hidden="true"
        autoComplete={autoComplete}
        defaultValue={selectedValue}
        disabled={disabled}
        form={form}
        name={name}
        required={required}
        style={VISUALLY_HIDDEN_SELECT_STYLES}
        tabIndex={-1}
        onChange={() => undefined}
      >
        {rawRenderableOptions.map((option) => (
          <option
            key={`${option.value}-${option.label}`}
            value={option.value}
            disabled={option.disabled}
            className={option.tone === "warning" ? "bg-amber-50 text-amber-800" : undefined}
          >
            {option.label}
          </option>
        ))}
      </select>

      <SelectPrimitive.Root
        open={open}
        onOpenChange={setOpen}
        value={selectedRadixValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        name={undefined}
        required={undefined}
        form={undefined}
        autoComplete={undefined}
      >
        <SelectPrimitive.Trigger
          {...triggerProps}
          autoFocus={autoFocus}
          disabled={disabled}
          id={id}
          className={cn(
            "ui-select-trigger flex h-10 w-full items-center justify-between rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 py-2 text-left text-sm text-[var(--app-text)] outline-none transition focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--app-surface-muted)] disabled:text-[var(--app-text-subtle)] data-[placeholder]:text-[var(--app-text-muted)]",
            className,
          )}
          aria-required={required}
          tabIndex={tabIndex}
          title={title}
        >
          <SelectPrimitive.Value placeholder={placeholderOption?.label ?? "Selecciona una opcion"}>
            {selectedOption?.label}
          </SelectPrimitive.Value>
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--app-text-muted)]" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        {portal ? <SelectPrimitive.Portal container={portalContainer ?? undefined}>{content}</SelectPrimitive.Portal> : content}
      </SelectPrimitive.Root>
    </div>
  );
}
