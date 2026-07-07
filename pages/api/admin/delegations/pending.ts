import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';

/**
 * GET /api/admin/delegations/pending?delegatorId=<uuid>
 *
 * The delegator's currently actionable (pending/waiting) approval steps on
 * live requests, de-duplicated per request — used to populate the optional
 * "redirect these in-flight requests now" checklist in the new-delegation form.
 */
async function canManageDelegations(userId: string): Promise<boolean> {
  const a = await requirePermission(userId, PERMISSIONS.ADMIN_SYSTEM_CONFIG);
  if (a.allowed) return true;
  const b = await requirePermission(userId, PERMISSIONS.USERS_MANAGE_ACCESS);
  return b.allowed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id;
  const orgId = (session.user as any).org_id;
  if (!orgId) return res.status(400).json({ error: 'No organization found' });

  if (!(await canManageDelegations(userId))) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { delegatorId } = req.query;
  if (typeof delegatorId !== 'string') {
    return res.status(400).json({ error: 'delegatorId is required' });
  }

  const { data: steps, error } = await supabaseAdmin
    .from('request_steps')
    .select(`
      id, step_index, status,
      request:requests!inner ( id, title, status, metadata, organization_id )
    `)
    .eq('approver_user_id', delegatorId)
    .in('status', ['pending', 'waiting'])
    .eq('request.status', 'pending');

  if (error) {
    console.error('delegations pending lookup failed:', error);
    return res.status(500).json({ error: 'Failed to load pending requests' });
  }

  // Collapse to one entry per request (a request may have >1 step on the delegator).
  const byRequest = new Map<string, any>();
  for (const step of (steps as any[]) || []) {
    const request = step.request;
    if (!request || request.organization_id !== orgId) continue;
    if (byRequest.has(request.id)) continue;
    byRequest.set(request.id, {
      requestId: request.id,
      title: request.title || 'Untitled request',
      referenceCode: request.metadata?.referenceCode || null,
      stepStatus: step.status,
    });
  }

  return res.status(200).json({ requests: Array.from(byRequest.values()) });
}
