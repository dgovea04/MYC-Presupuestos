import type { ReactNode } from "react";
import { ExternalLink, Pencil, Trash2, Copy, Save, X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionKind = "open" | "edit" | "delete" | "duplicate" | "save" | "cancel";

const actionIconMap: Record<ActionKind, ReactNode> = {
  open: <ExternalLink className="h-4 w-4" />,
  edit: <Pencil className="h-4 w-4" />,
  delete: <Trash2 className="h-4 w-4" />,
  duplicate: <Copy className="h-4 w-4" />,
  save: <Save className="h-4 w-4" />,
  cancel: <X className="h-4 w-4" />,
};

type ActionButtonProps = ButtonProps & {
  action: ActionKind;
  label: string;
  iconOnly?: boolean;
};

export function ActionButton({ action, label, iconOnly = false, className, children, ...props }: ActionButtonProps) {
  return (
    <Button
      {...props}
      title={label}
      aria-label={label}
      className={cn(
        "gap-2",
        iconOnly ? "h-8 w-8 rounded-lg px-0" : undefined,
        className,
      )}
    >
      {actionIconMap[action]}
      {iconOnly ? <span className="sr-only">{label}</span> : (children ?? label)}
    </Button>
  );
}
