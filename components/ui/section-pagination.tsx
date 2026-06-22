import Link from "next/link";
import type { ReactNode } from "react";

type CommonPaginationProps = {
  currentPage: number;
  totalPages: number;
};

type LinkPaginationProps = CommonPaginationProps & {
  previousHref: string;
  nextHref: string;
  onPrevious?: never;
  onNext?: never;
};

type ClientPaginationProps = CommonPaginationProps & {
  onPrevious: () => void;
  onNext: () => void;
  previousHref?: never;
  nextHref?: never;
};

type SectionPaginationProps = LinkPaginationProps | ClientPaginationProps;

export function SectionPagination(props: SectionPaginationProps) {
  const { currentPage, totalPages } = props;
  const isLinkMode = "previousHref" in props;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2 border-t border-[var(--app-border-soft)] pt-2">
      <span className="mr-auto text-xs text-[var(--app-text-muted)]">
        Pagina {currentPage} de {totalPages}
      </span>
      <MinimalPaginationItem
        disabled={currentPage <= 1}
        {...(isLinkMode ? { href: props.previousHref } : { onClick: props.onPrevious })}
      >
        Anterior
      </MinimalPaginationItem>
      <MinimalPaginationItem
        disabled={currentPage >= totalPages}
        {...(isLinkMode ? { href: props.nextHref } : { onClick: props.onNext })}
      >
        Siguiente
      </MinimalPaginationItem>
    </div>
  );
}

function MinimalPaginationItem({
  href,
  onClick,
  disabled,
  children,
}: {
  href?: string;
  onClick?: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  const className =
    "inline-flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] transition hover:border-[color:rgba(37,99,235,0.28)] hover:text-[var(--app-primary-soft)]";

  if (disabled) {
    return (
      <span className="inline-flex items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)] px-3 py-1.5 text-sm text-[var(--app-text-subtle)]">
        {children}
      </span>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${className} cursor-pointer`}>
      {children}
    </button>
  );
}
