import { supabaseAdmin } from './supabaseAdmin';

export type CapexTrackerStatus =
  | 'Pending Approval'
  | 'CAPEX Approval in Progress'
  | 'CAPEX Approved – Awaiting Funding'
  | 'Procurement in Progress'
  | 'Funding Partially Allocated'
  | 'Fully Funded'
  | 'Completed'
  | 'CAPEX Rejected'
  | 'On Hold';

export const CAPEX_STATUSES: CapexTrackerStatus[] = [
  'Pending Approval',
  'CAPEX Approval in Progress',
  'CAPEX Approved – Awaiting Funding',
  'Procurement in Progress',
  'Funding Partially Allocated',
  'Fully Funded',
  'Completed',
  'CAPEX Rejected',
  'On Hold',
];

function resolveSupplier(metadata: any): string | null {
  const quotations = Array.isArray(metadata?.quotations) ? metadata.quotations : [];
  if (quotations.length === 0) return null;
  const selected = quotations.find((q: any) => q?.isSelectedSupplier === true);
  const picked = selected || quotations[0];
  const name = picked?.supplierName;
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : null;
}

function deriveFinancialYear(metadata: any, submittedAt: Date): number {
  const startDate = metadata?.startDate;
  if (typeof startDate === 'string' && startDate.length >= 4) {
    const parsed = new Date(startDate);
    if (!isNaN(parsed.getTime())) return parsed.getFullYear();
  }
  return submittedAt.getFullYear();
}

function deriveCapexDate(metadata: any, submittedAt: Date): string {
  const startDate = metadata?.startDate;
  if (typeof startDate === 'string' && startDate.length >= 4) {
    const parsed = new Date(startDate);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return submittedAt.toISOString().slice(0, 10);
}

export async function createCapexTrackerRow(
  requestId: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  try {
    const { data: request, error: reqErr } = await supabaseAdmin
      .from('requests')
      .select('id, creator_id, organization_id, metadata, created_at')
      .eq('id', requestId)
      .single();

    if (reqErr || !request) {
      console.error('[capexTrackerHooks] request not found for tracker creation:', requestId, reqErr);
      return;
    }

    const metadata: any = request.metadata || {};
    const type = metadata.type || metadata.requestType;
    if (type !== 'capex') return;

    const { data: existing } = await supabaseAdmin
      .from('capex_tracker')
      .select('id')
      .eq('request_id', requestId)
      .maybeSingle();
    if (existing) return;

    const submittedAt = request.created_at ? new Date(request.created_at) : new Date();
    const cost = Number(metadata.amount || 0);
    if (!Number.isFinite(cost) || cost < 0) {
      console.error('[capexTrackerHooks] invalid cost on request', requestId, metadata.amount);
      return;
    }

    const row = {
      request_id: requestId,
      organization_id: organizationId,
      ranking: null,
      supplier: resolveSupplier(metadata),
      description: (metadata.projectName || metadata.description || 'CAPEX Request').toString().slice(0, 500),
      capex_date: deriveCapexDate(metadata, submittedAt),
      cost,
      funded: 0,
      champion_user_id: request.creator_id,
      status_update: 'CAPEX Approval in Progress' as CapexTrackerStatus,
      department: metadata.department || null,
      financial_year: deriveFinancialYear(metadata, submittedAt),
      is_budgeted: metadata.isBudgeted !== false,
      created_by: actorId,
      last_updated_by: actorId,
    };

    const { error: insertErr } = await supabaseAdmin.from('capex_tracker').insert(row);
    if (insertErr) {
      console.error('[capexTrackerHooks] failed to insert tracker row:', insertErr, row);
    }
  } catch (err) {
    console.error('[capexTrackerHooks] createCapexTrackerRow unexpected error:', err);
  }
}

async function updateCapexTrackerStatus(
  requestId: string,
  newStatus: CapexTrackerStatus,
  actorId: string
): Promise<void> {
  try {
    const { data: request } = await supabaseAdmin
      .from('requests')
      .select('id, metadata')
      .eq('id', requestId)
      .single();

    if (!request) return;
    const metadata: any = request.metadata || {};
    const type = metadata.type || metadata.requestType;
    if (type !== 'capex') return;

    const { error } = await supabaseAdmin
      .from('capex_tracker')
      .update({
        status_update: newStatus,
        last_updated_by: actorId,
        last_updated_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    if (error) {
      console.error('[capexTrackerHooks] failed to update tracker status:', error, { requestId, newStatus });
    }
  } catch (err) {
    console.error('[capexTrackerHooks] updateCapexTrackerStatus unexpected error:', err);
  }
}

export async function onCapexApproved(requestId: string, actorId: string): Promise<void> {
  await updateCapexTrackerStatus(requestId, 'CAPEX Approved – Awaiting Funding', actorId);
}

export async function onCapexRejected(requestId: string, actorId: string): Promise<void> {
  await updateCapexTrackerStatus(requestId, 'CAPEX Rejected', actorId);
}
