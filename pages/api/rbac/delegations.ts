import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePermission, logRBACAction, PERMISSIONS, ROLE_SLUGS } from '@/lib/rbac';

/**
 * Get all system admins and super admins who can approve delegations
 */
async function getAdminUsersForNotification(organizationId: string): Promise<string[]> {
  const { data: adminRoles, error: rolesError } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('organization_id', organizationId)
    .in('slug', [ROLE_SLUGS.SUPER_ADMIN, ROLE_SLUGS.SYSTEM_ADMIN]);

  if (rolesError || !adminRoles || adminRoles.length === 0) {
    console.error('Error fetching admin roles:', rolesError);
    return [];
  }

  const roleIds = adminRoles.map(r => r.id);

  const { data: adminUsers, error: usersError } = await supabaseAdmin
    .from('user_roles')
    .select('user_id')
    .in('role_id', roleIds)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

  if (usersError) {
    console.error('Error fetching admin users:', usersError);
    return [];
  }

  // Return unique user IDs
  return [...new Set(adminUsers?.map(u => u.user_id) || [])];
}

/**
 * Send notification to admins about a new delegation request
 */
async function notifyAdminsOfDelegationRequest(
  delegationId: string,
  organizationId: string,
  delegatorName: string,
  delegateName: string,
  senderId: string
): Promise<void> {
  try {
    const adminUserIds = await getAdminUsersForNotification(organizationId);

    if (adminUserIds.length === 0) {
      console.warn('No admin users found to notify about delegation request');
      return;
    }

    const notifications = adminUserIds.map(adminId => ({
      organization_id: organizationId,
      recipient_id: adminId,
      sender_id: senderId,
      type: 'task',
      title: 'Delegation Approval Required',
      message: `${delegatorName} has requested to delegate their approval authority to ${delegateName}. Your review is required.`,
      metadata: {
        delegation_id: delegationId,
        action_label: 'Review Delegation',
        action_url: `/admin/settings?tab=delegations`,
        notification_type: 'delegation_request',
      },
      is_read: false,
    }));

    const { error } = await supabaseAdmin.from('notifications').insert(notifications);

    if (error) {
      console.error('Error sending delegation notifications to admins:', error);
    } else {
      console.log(`Sent delegation request notifications to ${adminUserIds.length} admins`);
    }
  } catch (error) {
    console.error('Failed to notify admins of delegation request:', error);
  }
}

/**
 * Send notification to delegator about approval/rejection
 */
async function notifyDelegatorOfDecision(
  delegationId: string,
  organizationId: string,
  delegatorId: string,
  delegateName: string,
  action: 'approved' | 'rejected',
  reviewComment: string | null,
  reviewerName: string
): Promise<void> {
  try {
    const title = action === 'approved' ? 'Delegation Request Approved' : 'Delegation Request Rejected';
    const message = action === 'approved'
      ? `Your delegation request to ${delegateName} has been approved by ${reviewerName}. The delegation is now active.`
      : `Your delegation request to ${delegateName} has been rejected by ${reviewerName}.${reviewComment ? ` Reason: ${reviewComment}` : ''}`;

    const { error } = await supabaseAdmin.from('notifications').insert({
      organization_id: organizationId,
      recipient_id: delegatorId,
      type: action === 'approved' ? 'info' : 'warning',
      title,
      message,
      metadata: {
        delegation_id: delegationId,
        action_label: 'View Details',
        action_url: `/approvals?tab=delegations`,
        notification_type: 'delegation_decision',
        decision: action,
        review_comment: reviewComment,
      },
      is_read: false,
    });

    if (error) {
      console.error('Error sending delegation decision notification:', error);
    }
  } catch (error) {
    console.error('Failed to notify delegator of decision:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = session.user as any;
  const organizationId = user.org_id;

  console.log('[Delegations API] User:', { id: user.id, org_id: organizationId });

  // GET — list delegations
  if (req.method === 'GET') {
    try {
      const { user_id, status, user_ids } = req.query;

      let query = supabaseAdmin
        .from('approval_delegations')
        .select(`
          *,
          delegator:app_users!approval_delegations_delegator_id_fkey(id, display_name, email),
          delegate:app_users!approval_delegations_delegate_id_fkey(id, display_name, email),
          initiator:app_users!approval_delegations_created_by_fkey(id, display_name, email, role),
          reviewer:app_users!approval_delegations_reviewed_by_fkey(id, display_name, email, role)
        `)
        .order('created_at', { ascending: false });

      if (user_id) {
        query = query.or(`delegator_id.eq.${user_id},delegate_id.eq.${user_id}`);
      }

      // Support filtering by multiple user IDs (for request detail page)
      if (user_ids && typeof user_ids === 'string') {
        const ids = user_ids.split(',').filter(Boolean);
        if (ids.length > 0) {
          query = query.in('delegator_id', ids);
        }
      }

      if (status && typeof status === 'string') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching delegations:', error);
        return res.status(500).json({ error: 'Failed to fetch delegations' });
      }

      return res.status(200).json(data || []);
    } catch (err) {
      console.error('Error in delegations GET:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST — request a delegation (any authenticated user can request for themselves)
  if (req.method === 'POST') {
    try {
      const { delegator_id, delegate_id, reason, department_id, business_unit_id, starts_at, ends_at } = req.body;

      if (!delegator_id || !delegate_id) {
        return res.status(400).json({ error: 'delegator_id and delegate_id are required' });
      }

      if (delegator_id === delegate_id) {
        return res.status(400).json({ error: 'Cannot delegate to yourself' });
      }

      // Users can only request delegation for themselves (delegator_id must be their own ID)
      // Admins with configure_delegation permission can create for anyone
      const { allowed: isAdmin } = await requirePermission(session.user.id, PERMISSIONS.APPROVALS_CONFIGURE_DELEGATION);
      if (!isAdmin && delegator_id !== session.user.id) {
        return res.status(403).json({ error: 'You can only request delegation for yourself' });
      }

      const { data, error } = await supabaseAdmin
        .from('approval_delegations')
        .insert({
          delegator_id,
          delegate_id,
          reason: reason || null,
          department_id: department_id || null,
          business_unit_id: business_unit_id || null,
          starts_at: starts_at || new Date().toISOString(),
          ends_at: ends_at || null,
          is_active: false,
          status: 'pending',
          created_by: session.user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating delegation request:', error);
        return res.status(400).json({ error: error.message });
      }

      await logRBACAction(session.user.id, 'delegation_requested', 'approval_delegation', data.id, {
        delegator_id, delegate_id, department_id, business_unit_id,
      });

      // Fetch delegator and delegate names for notification (non-blocking)
      try {
        const { data: delegatorData } = await supabaseAdmin
          .from('app_users')
          .select('display_name')
          .eq('id', delegator_id)
          .single();
        const { data: delegateData } = await supabaseAdmin
          .from('app_users')
          .select('display_name')
          .eq('id', delegate_id)
          .single();

        // Notify system admins about the new delegation request
        if (organizationId && delegatorData && delegateData) {
          console.log('[Delegations API] Sending notifications to admins for org:', organizationId);
          await notifyAdminsOfDelegationRequest(
            data.id,
            organizationId,
            delegatorData.display_name || delegator_id,
            delegateData.display_name || delegate_id,
            session.user.id
          );
        } else {
          console.warn('[Delegations API] Skipping notifications - missing org or user data:', {
            hasOrg: !!organizationId,
            hasDelegator: !!delegatorData,
            hasDelegate: !!delegateData
          });
        }
      } catch (notifyErr) {
        console.error('[Delegations API] Notification error (non-fatal):', notifyErr);
      }

      return res.status(201).json(data);
    } catch (err) {
      console.error('Error creating delegation request:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT — admin approve/reject delegation OR deactivate an existing delegation
  if (req.method === 'PUT') {
    try {
      const { id, action, review_comment, is_active, ends_at } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Delegation ID is required' });
      }

      // Admin approve/reject action
      if (action === 'approve' || action === 'reject') {
        const { allowed } = await requirePermission(session.user.id, PERMISSIONS.APPROVALS_CONFIGURE_DELEGATION);
        if (!allowed) {
          return res.status(403).json({ error: 'Only admins can approve or reject delegation requests' });
        }

        // Verify the delegation is pending
        const { data: existing } = await supabaseAdmin
          .from('approval_delegations')
          .select('status')
          .eq('id', id)
          .single();

        if (!existing || existing.status !== 'pending') {
          return res.status(400).json({ error: 'Delegation is not in pending status' });
        }

        const updatePayload: Record<string, any> = {
          status: action === 'approve' ? 'approved' : 'rejected',
          is_active: action === 'approve',
          reviewed_by: session.user.id,
          reviewed_at: new Date().toISOString(),
          review_comment: review_comment || null,
        };

        const { data, error } = await supabaseAdmin
          .from('approval_delegations')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error reviewing delegation:', error);
          return res.status(400).json({ error: error.message });
        }

        const auditAction = action === 'approve' ? 'delegation_approved' : 'delegation_rejected';
        await logRBACAction(session.user.id, auditAction, 'approval_delegation', id, {
          review_comment: review_comment || null,
        });

        // Get delegator and delegate info for notification (non-blocking)
        try {
          const { data: delegationData } = await supabaseAdmin
            .from('approval_delegations')
            .select(`
              delegator_id,
              delegate_id,
              delegator:app_users!approval_delegations_delegator_id_fkey(organization_id),
              delegate:app_users!approval_delegations_delegate_id_fkey(display_name)
            `)
            .eq('id', id)
            .single();

          const { data: reviewerData } = await supabaseAdmin
            .from('app_users')
            .select('display_name')
            .eq('id', session.user.id)
            .single();

          // Notify the delegator of the decision
          if (delegationData && reviewerData) {
            // Supabase returns FK relations as arrays even with .single()
          const delegateArray = delegationData.delegate as unknown as Array<{ display_name: string }> | null;
          const delegatorArray = delegationData.delegator as unknown as Array<{ organization_id: string }> | null;
          const delegateName = delegateArray?.[0]?.display_name || delegationData.delegate_id;
          const organizationId = delegatorArray?.[0]?.organization_id;
            
            console.log('[Delegations API] Sending decision notification to delegator:', {
              delegatorId: delegationData.delegator_id,
              organizationId,
              action
            });
            
            await notifyDelegatorOfDecision(
              id,
              organizationId || '',
              delegationData.delegator_id,
              delegateName,
              action,
              review_comment || null,
              reviewerData.display_name || session.user.id
            );
          } else {
            console.warn('[Delegations API] Skipping decision notification - missing data:', {
              hasDelegation: !!delegationData,
              hasReviewer: !!reviewerData
            });
          }
        } catch (notifyErr) {
          console.error('[Delegations API] Decision notification error (non-fatal):', notifyErr);
        }

        return res.status(200).json(data);
      }

      // Deactivate/update an existing approved delegation (admin only)
      const { allowed } = await requirePermission(session.user.id, PERMISSIONS.APPROVALS_CONFIGURE_DELEGATION);
      if (!allowed) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const updatePayload: Record<string, any> = {};
      if (is_active !== undefined) updatePayload.is_active = is_active;
      if (ends_at !== undefined) updatePayload.ends_at = ends_at;

      const { data, error } = await supabaseAdmin
        .from('approval_delegations')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating delegation:', error);
        return res.status(400).json({ error: error.message });
      }

      await logRBACAction(session.user.id, 'delegation_updated', 'approval_delegation', id, updatePayload);

      return res.status(200).json(data);
    } catch (err) {
      console.error('Error updating delegation:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
