"use client";

interface Props {
  personId: string;
}

export function ExportDataButton({ personId }: Props) {
  return (
    <a
      href={`/api/people/${personId}/export`}
      download
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export data
    </a>
  );
}
