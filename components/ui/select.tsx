"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractSelectOptions,
  partitionSelectOptions,
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
  defaultValue?: string;
  form?: string;
  name?: string;
  onChange?: (event: SelectValueChangeEvent) => void;
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

function mapRenderableOption(option: { disabled: boolean; label: string; value: string }, index: number) {
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
  defaultValue,
  disabled,
  form,
  id,
  name,
  onChange,
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
  const [viewMode, setViewMode] = React.useState<SelectViewMode>("modern");
  const hasSelectableEmptyValue = React.useMemo(
    () => rawRenderableOptions.some((option) => option.value === ""),
    [rawRenderableOptions],
  );
  const usesNativeFallbackFormControl = hasSelectableEmptyValue;

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

  return (
    <div ref={containerRef} className="ui-select relative">
      {usesNativeFallbackFormControl ? (
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
            <option key={`${option.value}-${option.label}`} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      <SelectPrimitive.Root
        value={selectedRadixValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        name={usesNativeFallbackFormControl ? undefined : name}
        required={usesNativeFallbackFormControl ? undefined : required}
        form={usesNativeFallbackFormControl ? undefined : form}
        autoComplete={usesNativeFallbackFormControl ? undefined : autoComplete}
      >
        <SelectPrimitive.Trigger
          {...triggerProps}
          autoFocus={autoFocus}
          disabled={disabled}
          id={id}
          className={cn(
            "ui-select-trigger flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 outline-none transition focus:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 data-[placeholder]:text-slate-500",
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
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            data-view-mode={viewMode}
            position="popper"
            sideOffset={6}
            className="ui-select-content z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <SelectPrimitive.Viewport className="p-1">
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
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
