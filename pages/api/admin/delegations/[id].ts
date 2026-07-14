import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { audit } from '@/lib/auditLog';

/**
 * Revoke a delegation (PATCH or DELETE). Revoking stops future auto-routing;
 * approvals already handed to the delegate stay with them (they may be
 * mid-review) — the admin UI documents this.
 */
async function canManageDelegations(userId: string): Promise<boolean> {
  const a = await requirePermission(userId, PERMISSIONS.ADMIN_SYSTEM_CONFIG);
  if (a.allowed) return true;
  const b = await requirePermission(userId, PERMISSIONS.USERS_MANAGE_ACCESS);
  return b.allowed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;
  const orgId = (session.user as any).org_id;
  if (!orgId) return res.status(400).json({ error: 'No organization found' });

  if (!(await canManageDelegations(userId))) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid delegation id' });

  const { data: delegation, error: fetchError } = await supabaseAdmin
    .from('approval_delegations')
    .select('id, organization_id, delegator_id, delegate_id, status')
    .eq('id', id)
    .single();

  if (fetchError || !delegation) {
    return res.status(404).json({ error: 'Delegation not found' });
  }
  if (delegation.organization_id !== orgId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (delegation.status !== 'active') {
    return res.status(400).json({ error: 'Only active delegations can be revoked' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('approval_delegations')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoked_by: userId })
    .eq('id', id);

  if (updateError) {
    console.error('delegation revoke failed:', updateError);
    return res.status(500).json({ error: 'Failed to revoke delegation' });
  }

  await audit(req, session.user, {
    category: 'workflow',
    action: 'delegation.revoked',
    severity: 'notice',
    targetType: 'user',
    targetId: delegation.delegator_id,
    details: { delegationId: id, delegateId: delegation.delegate_id },
  });

  return res.status(200).json({ success: true });
}
