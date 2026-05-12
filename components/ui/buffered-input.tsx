import * as React from "react";
import { Input } from "@/components/ui/input";

type BufferedInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "value"> & {
  onCommit: (value: string) => void;
  onValueChange?: (value: string) => void;
  value: number | string | null | undefined;
};

export const BufferedInput = React.forwardRef<HTMLInputElement, BufferedInputProps>(function BufferedInput(
  { onBlur, onCommit, onFocus, onValueChange, value, ...props },
  ref,
) {
  const [draft, setDraft] = React.useState(() => stringifyValue(value));
  const isFocusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(stringifyValue(value));
    }
  }, [value]);

  function commit(nextValue: string) {
    if (nextValue !== stringifyValue(value)) {
      onCommit(nextValue);
    }
  }

  return (
    <Input
      {...props}
      ref={ref}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        onValueChange?.(event.target.value);
      }}
      onFocus={(event) => {
        isFocusedRef.current = true;
        onFocus?.(event);
      }}
      onBlur={(event) => {
        isFocusedRef.current = false;
        commit(event.target.value);
        onBlur?.(event);
      }}
    />
  );
});

function stringifyValue(value: number | string | null | undefined) {
  if (value == null) return "";
  return String(value);
}
