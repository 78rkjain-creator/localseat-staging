import Link from "next/link";

interface ListRowProps {
  href: string;
  avatar?: { initials: string };
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  chevron?: boolean;
}

export function ListRow({
  href,
  avatar,
  title,
  subtitle,
  meta,
  badge,
  chevron = true,
}: ListRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
    >
      {avatar && (
        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-slate-500">
            {avatar.initials}
          </span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900 truncate">{title}</p>
        {subtitle && (
          <p className="text-sm text-slate-500 truncate">{subtitle}</p>
        )}
      </div>

      {meta && (
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {meta}
        </div>
      )}

      {badge && <div className="flex-shrink-0 ml-2">{badge}</div>}

      {chevron && (
        <svg
          className="h-4 w-4 text-slate-300 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </Link>
  );
}
