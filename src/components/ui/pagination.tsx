import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  buildPageUrl: (page: number) => string;
}

function getPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

const ChevronLeft = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRight = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const ChevronsLeft = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const ChevronsRight = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

export function Pagination({ page, totalPages, buildPageUrl }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageRange = getPageRange(page, totalPages);

  return (
    <div className="border-t border-slate-100">
      {/* Mobile: Prev / Page X of Y / Next */}
      <div className="flex md:hidden items-center justify-between px-5 py-4">
        {page > 1 ? (
          <Link
            href={buildPageUrl(page - 1)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft />
            Previous
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
            <ChevronLeft />
            Previous
          </span>
        )}
        <span className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link
            href={buildPageUrl(page + 1)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Next
            <ChevronRight />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
            Next
            <ChevronRight />
          </span>
        )}
      </div>

      {/* Desktop: First / Prev / [pages] / Next / Last */}
      <div className="hidden md:flex items-center justify-center gap-1 px-5 py-4">
        {/* First */}
        {page > 1 ? (
          <Link
            href={buildPageUrl(1)}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="First page"
          >
            <ChevronsLeft />
          </Link>
        ) : (
          <span
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300"
            aria-hidden
          >
            <ChevronsLeft />
          </span>
        )}

        {/* Prev */}
        {page > 1 ? (
          <Link
            href={buildPageUrl(page - 1)}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Link>
        ) : (
          <span
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300"
            aria-hidden
          >
            <ChevronLeft />
          </span>
        )}

        {/* Page numbers */}
        {pageRange.map((pageNum, i) =>
          pageNum === "..." ? (
            <span
              key={`el-${i}`}
              className="h-9 w-9 flex items-center justify-center text-slate-400 text-sm select-none"
            >
              …
            </span>
          ) : (
            <Link
              key={pageNum}
              href={buildPageUrl(pageNum as number)}
              aria-current={pageNum === page ? "page" : undefined}
              className={
                pageNum === page
                  ? "h-9 w-9 flex items-center justify-center rounded-xl bg-brand-500 text-white text-sm font-semibold"
                  : "h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
              }
            >
              {pageNum}
            </Link>
          )
        )}

        {/* Next */}
        {page < totalPages ? (
          <Link
            href={buildPageUrl(page + 1)}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Next page"
          >
            <ChevronRight />
          </Link>
        ) : (
          <span
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300"
            aria-hidden
          >
            <ChevronRight />
          </span>
        )}

        {/* Last */}
        {page < totalPages ? (
          <Link
            href={buildPageUrl(totalPages)}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Last page"
          >
            <ChevronsRight />
          </Link>
        ) : (
          <span
            className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300"
            aria-hidden
          >
            <ChevronsRight />
          </span>
        )}
      </div>
    </div>
  );
}
