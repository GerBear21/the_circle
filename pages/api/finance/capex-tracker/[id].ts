import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAnyPermission } from '../../../../lib/rbac';
import { CAPEX_STATUSES } from '../../../../lib/capexTrackerHooks';

const ALLOWED_FIELDS = new Set(['funded', 'status_update', 'ranking']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Tracker entry id is required' });
    }

    if (req.method !== 'PATCH') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { allowed } = await requireAnyPermission(userId, ['finance.edit_tracker']);
    if (!allowed) {
      return res.status(403).json({ error: 'You do not have permission to edit CAPEX tracker entries.' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const bodyKeys = Object.keys(body);
    const invalidKeys = bodyKeys.filter((k) => !ALLOWED_FIELDS.has(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        error: `Cannot modify protected fields: ${invalidKeys.join(', ')}. Only funded, status_update, and ranking are editable.`,
      });
    }

    const update: Record<string, any> = {
      last_updated_by: userId,
      last_updated_at: new Date().toISOString(),
    };

    if ('funded' in body) {
      const funded = Number(body.funded);
      if (!Number.isFinite(funded) || funded < 0) {
        return res.status(400).json({ error: 'funded must be a non-negative number' });
      }
      update.funded = funded;
    }
    if ('status_update' in body) {
      const status = body.status_update;
      if (typeof status !== 'string' || !CAPEX_STATUSES.includes(status as any)) {
        return res.status(400).json({ error: 'Invalid status_update value' });
      }
      update.status_update = status;
    }
    if ('ranking' in body) {
      if (body.ranking === null) {
        update.ranking = null;
      } else {
        const ranking = Number(body.ranking);
        if (!Number.isFinite(ranking) || ranking < 0) {
          return res.status(400).json({ error: 'ranking must be a non-negative integer' });
        }
        update.ranking = Math.floor(ranking);
      }
    }

    if (Object.keys(update).length <= 2) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    // Guard funded <= cost to prevent negative balances (balance is generated column)
    if ('funded' in update) {
      const { data: current, error: curErr } = await supabaseAdmin
        .from('capex_tracker')
        .select('cost, organization_id')
        .eq('id', id)
        .single();
      if (curErr || !current) {
        return res.status(404).json({ error: 'Tracker entry not found' });
      }
      if (current.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Not authorized for this organization' });
      }
      if (Number(update.funded) > Number(current.cost)) {
        return res.status(400).json({ error: 'funded cannot exceed cost' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('capex_tracker')
      .update(update)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Tracker entry not found' });
    }

    return res.status(200).json({ entry: data });
  } catch (error: any) {
    console.error('capex-tracker patch error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update tracker' });
  }
}
