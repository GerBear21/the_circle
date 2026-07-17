/**
 * Skeleton shown in a form's Approval Workflow section while approvers are still
 * being resolved from the HRIMS organogram. Replacing the role pickers with this
 * (rather than briefly showing empty "select manually" pickers) tells the user
 * the system is still working out who should sign off.
 */
export default function ApproverSectionLoader({ rows = 3 }: { rows?: number }) {
  return (
    <div>
      <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-xl flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500" />
        <span className="text-sm text-primary-700">Resolving approvers from the HRIMS organogram…</span>
      </div>
      <div className="space-y-4" aria-hidden="true">
        {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-neutral-200 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-neutral-200 rounded animate-pulse" />
              <div className="h-3 w-56 bg-neutral-100 rounded animate-pulse" />
              <div className="h-11 w-full bg-neutral-100 rounded-xl animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
