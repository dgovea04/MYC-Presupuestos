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
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
      <span className="mr-auto text-xs text-slate-500">
        Página {currentPage} de {totalPages}
      </span>
      <MinimalPaginationItem
        disabled={currentPage <= 1}
        {...(isLinkMode
          ? { href: props.previousHref }
          : { onClick: props.onPrevious })}
      >
        Anterior
      </MinimalPaginationItem>
      <MinimalPaginationItem
        disabled={currentPage >= totalPages}
        {...(isLinkMode
          ? { href: props.nextHref }
          : { onClick: props.onNext })}
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
    "inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition";

  if (disabled) {
    return (
      <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-400">
        {children}
      </span>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className={`${className} bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700`}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} cursor-pointer bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700`}
    >
      {children}
    </button>
  );
}
