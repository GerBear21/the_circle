// Visibility banner — tells the user exactly which slice of the
// organization's data they are looking at, as resolved by the server
// (lib/accessScope.ts). Rendered on scoped list pages (CAPEX tracker,
// requests, finance views).

export interface ResponseScope {
  level: 'own' | 'department' | 'business_unit' | 'custom' | 'organization';
  isOrgWide: boolean;
  businessUnits: string[];
  department: string | null;
  label: string;
}

const LEVEL_TEXT: Record<ResponseScope['level'], string> = {
  own: 'your own records only',
  department: 'your department',
  business_unit: 'your business unit',
  custom: 'selected business units',
  organization: 'the entire organization',
};

export default function ScopeBanner({ scope, className = '' }: { scope: ResponseScope | null | undefined; className?: string }) {
  if (!scope) return null;

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border border-[#C9B896] bg-[#FAF7F0] px-4 py-2.5 ${className}`}
      title="Your administrator controls how much data you can see. Contact them if you need wider access."
    >
      <svg className="h-4 w-4 flex-shrink-0 text-[#9A7545]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      <p className="text-sm text-[#5E4426] min-w-0">
        <span className="font-semibold">Viewing {LEVEL_TEXT[scope.level] || 'your data'}:</span>{' '}
        <span className="truncate">{scope.label}</span>
      </p>
    </div>
  );
}
