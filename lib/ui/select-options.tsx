import { Children, isValidElement, type OptionHTMLAttributes, type ReactElement, type ReactNode } from "react";

export type SelectOptionRecord = {
  value: string;
  label: string;
  disabled: boolean;
  tone: "default" | "warning";
};

export type SelectOptionElement = ReactElement<OptionHTMLAttributes<HTMLOptionElement>, "option">;
export type SelectOptionChild = SelectOptionElement | null | undefined | false;
export type SelectOptionChildren = ReactNode;

export type SelectOptionsPartition = {
  placeholderOption: SelectOptionRecord | null;
  renderableOptions: SelectOptionRecord[];
};

export function extractSelectOptions(children: SelectOptionChildren): SelectOptionRecord[] {
  return Children.toArray(children).flatMap(extractSelectOptionsFromNode);
}

export function partitionSelectOptions(options: ReadonlyArray<SelectOptionRecord>): SelectOptionsPartition {
  const placeholderOption = options.find((option) => option.value === "" && option.disabled) ?? null;

  return {
    placeholderOption,
    renderableOptions: options.filter((option) => option !== placeholderOption),
  };
}

function flattenOptionLabel(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement(child)) {
        const element = child as React.ReactElement<{ children?: ReactNode }>;
        return flattenOptionLabel(element.props.children);
      }

      return "";
    })
    .join("")
    .trim();
}

function extractSelectOptionsFromNode(node: ReactNode): SelectOptionRecord[] {
  if (!isValidElement(node)) {
    return [];
  }

  if (node.type === "option") {
    const { value, disabled, children: optionChildren, "data-tone": tone } = node.props as {
      value?: string;
      disabled?: boolean;
      children?: ReactNode;
      "data-tone"?: string;
    };

    return [
      {
        value: typeof value === "string" ? value : String(value ?? ""),
        label: flattenOptionLabel(optionChildren),
        disabled: Boolean(disabled),
        tone: tone === "warning" ? "warning" : "default",
      },
    ];
  }

  return Children.toArray((node.props as { children?: ReactNode }).children).flatMap(extractSelectOptionsFromNode);
}
