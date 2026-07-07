import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import { audit } from '@/lib/auditLog';
import { sendUserNotificationEmail, escapeHtml } from '@/lib/notificationEmail';

/**
 * Admin delegation management.
 *
 *   GET  — list this org's delegations (active + past), newest first.
 *   POST — create a delegation (delegatorId, delegateId, reason, startsAt,
 *          endsAt, redirectRequestIds?). Optionally redirects the delegator's
 *          currently-pending steps on the named requests straight away.
 *
 * Gated by admin.system_config OR users.manage_access. Every delegation
 * action is sealed into the immutable audit log.
 */

/** Allow either the system-config admin or a user-access manager. */
async function canManageDelegations(userId: string): Promise<boolean> {
  const a = await requirePermission(userId, PERMISSIONS.ADMIN_SYSTEM_CONFIG);
  if (a.allowed) return true;
  const b = await requirePermission(userId, PERMISSIONS.USERS_MANAGE_ACCESS);
  return b.allowed;
}

/** Derive the effective status shown to the client (active rows past their end are 'expired'). */
function effectiveStatus(row: { status: string; ends_at: string }): string {
  if (row.status === 'active' && new Date(row.ends_at).getTime() <= Date.now()) return 'expired';
  return row.status;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  // ---- GET: list -----------------------------------------------------------
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('approval_delegations')
      .select(`
        id, reason, starts_at, ends_at, status, created_at, revoked_at, documents,
        delegator:app_users!delegator_id ( id, display_name, email, job_title ),
        delegate:app_users!delegate_id ( id, display_name, email, job_title ),
        created_by_user:app_users!created_by ( id, display_name )
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('delegations list failed:', error);
      return res.status(500).json({ error: 'Failed to load delegations' });
    }

    // Attach a short-lived signed URL to each supporting document so the admin
    // UI can render thumbnails without a second round-trip.
    const delegations = await Promise.all(
      (data || []).map(async (d: any) => {
        const docs = Array.isArray(d.documents) ? d.documents : [];
        const documents = await Promise.all(
          docs.map(async (doc: any) => {
            try {
              const { data: signed } = await supabaseAdmin.storage
                .from('quotations')
                .createSignedUrl(doc.storage_path, 3600);
              return { ...doc, download_url: signed?.signedUrl || null };
            } catch {
              return { ...doc, download_url: null };
            }
          })
        );
        return { ...d, documents, status: effectiveStatus(d) };
      })
    );
    return res.status(200).json({ delegations });
  }

  // ---- POST: create --------------------------------------------------------
  if (req.method === 'POST') {
    const { delegatorId, delegateId, reason, startsAt, endsAt, redirectRequestIds } = req.body || {};

    const trimmedReason = (reason || '').trim();
    if (!delegatorId || !delegateId || !trimmedReason || !endsAt) {
      return res.status(400).json({ error: 'delegatorId, delegateId, reason and endsAt are required' });
    }
    if (delegatorId === delegateId) {
      return res.status(400).json({ error: 'The delegate must be a different person' });
    }

    const starts = startsAt ? new Date(startsAt) : new Date();
    const ends = new Date(endsAt);
    if (isNaN(ends.getTime()) || ends.getTime() <= starts.getTime()) {
      return res.status(400).json({ error: 'End date must be after the start date' });
    }

    // Both users must belong to the caller's organization.
    const { data: users, error: usersError } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name, email, organization_id')
      .in('id', [delegatorId, delegateId]);
    if (usersError || !users || users.length !== 2) {
      return res.status(404).json({ error: 'Delegator or delegate not found' });
    }
    if (users.some((u) => u.organization_id !== orgId)) {
      return res.status(400).json({ error: 'Both users must be in your organization' });
    }
    const delegator = users.find((u) => u.id === delegatorId)!;
    const delegate = users.find((u) => u.id === delegateId)!;

    // Guard against overlapping active delegations for the same delegator.
    const { data: existing } = await supabaseAdmin
      .from('approval_delegations')
      .select('id')
      .eq('delegator_id', delegatorId)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .limit(1);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'This person already has an active delegation. Revoke it first.' });
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from('approval_delegations')
      .insert({
        organization_id: orgId,
        delegator_id: delegatorId,
        delegate_id: delegateId,
        reason: trimmedReason,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: 'active',
        created_by: userId,
      })
      .select('id')
      .single();

    if (insertError || !created) {
      console.error('delegation insert failed:', insertError);
      return res.status(500).json({ error: 'Failed to create delegation' });
    }
    const delegationId = created.id;

    // Optionally redirect the delegator's currently-pending steps on the
    // named in-flight requests to the delegate right away.
    let redirectedRequestIds: string[] = [];
    if (Array.isArray(redirectRequestIds) && redirectRequestIds.length > 0) {
      redirectedRequestIds = await redirectExistingRequests({
        requestIds: redirectRequestIds,
        delegatorId,
        delegateId,
        adminId: userId,
        orgId,
        reason: trimmedReason,
        delegationId,
        delegatorName: delegator.display_name || 'the original approver',
        delegateName: delegate.display_name || 'the delegate',
      });
    }

    // Audit (immutable log).
    await audit(req, session.user, {
      category: 'workflow',
      action: 'delegation.created',
      severity: 'notice',
      targetType: 'user',
      targetId: delegatorId,
      targetLabel: delegator.display_name || delegator.email || delegatorId,
      details: {
        delegationId,
        delegateId,
        delegateName: delegate.display_name || delegate.email,
        reason: trimmedReason,
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
        redirectedRequestIds,
      },
    });

    // Notify the delegate (in-app task + email, best-effort).
    try {
      await supabaseAdmin.from('notifications').insert({
        organization_id: orgId,
        recipient_id: delegateId,
        sender_id: userId,
        type: 'task',
        title: 'You are now an approval delegate',
        message: `You will handle ${delegator.display_name || 'another approver'}'s approvals until ${ends.toLocaleDateString('en-GB')}. Reason: ${trimmedReason}`,
        metadata: { action_label: 'View my approvals', action_url: '/approvals', delegation_id: delegationId },
        is_read: false,
      });
      await sendUserNotificationEmail({
        userId: delegateId,
        kind: 'approval_tasks',
        subject: 'You are now an approval delegate — The Circle',
        heading: 'Approval delegation assigned to you',
        bodyHtml: `<p>You have been asked to handle <strong>${escapeHtml(delegator.display_name || 'another approver')}</strong>'s approvals until <strong>${escapeHtml(ends.toLocaleDateString('en-GB'))}</strong>.</p><p>Reason: ${escapeHtml(trimmedReason)}</p>`,
        actionUrl: '/approvals',
        actionLabel: 'View my approvals',
      });
    } catch (e) {
      console.error('delegation notify failed (non-fatal):', e);
    }

    return res.status(201).json({ success: true, id: delegationId, redirectedRequestIds });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Redirect the delegator's pending/waiting steps on specific requests to the
 * delegate, recording each in approval_redirections and notifying both people.
 * Returns the request ids that had at least one step redirected.
 */
async function redirectExistingRequests(args: {
  requestIds: string[];
  delegatorId: string;
  delegateId: string;
  adminId: string;
  orgId: string;
  reason: string;
  delegationId: string;
  delegatorName: string;
  delegateName: string;
}): Promise<string[]> {
  const redirected: string[] = [];
  const nowIso = new Date().toISOString();

  for (const requestId of args.requestIds) {
    // Only steps still on the delegator and still actionable.
    const { data: steps } = await supabaseAdmin
      .from('request_steps')
      .select('id, request_id, requests!inner(title, organization_id)')
      .eq('request_id', requestId)
      .eq('approver_user_id', args.delegatorId)
      .in('status', ['pending', 'waiting']);

    if (!steps || steps.length === 0) continue;

    let didRedirect = false;
    for (const step of steps as any[]) {
      if (step.requests?.organization_id !== args.orgId) continue;
      const { error: updErr } = await supabaseAdmin
        .from('request_steps')
        .update({
          approver_user_id: args.delegateId,
          is_redirected: true,
          original_approver_id: args.delegatorId,
          redirected_by_id: args.adminId,
          redirected_at: nowIso,
          redirect_reason: args.reason,
          delegation_id: args.delegationId,
        })
        .eq('id', step.id);
      if (updErr) {
        console.error('delegation redirect step failed:', updErr);
        continue;
      }
      await supabaseAdmin.from('approval_redirections').insert({
        request_id: requestId,
        step_id: step.id,
        original_approver_id: args.delegatorId,
        new_approver_id: args.delegateId,
        redirected_by_id: args.adminId,
        redirect_reason: args.reason,
      });
      didRedirect = true;

      // Notify the delegate that an approval was handed to them.
      await supabaseAdmin.from('notifications').insert({
        organization_id: args.orgId,
        recipient_id: args.delegateId,
        sender_id: args.adminId,
        type: 'task',
        title: 'Approval delegated to you',
        message: `An approval for "${step.requests?.title || 'a request'}" has been delegated to you (covering ${args.delegatorName}). Reason: ${args.reason}`,
        metadata: { request_id: requestId, action_label: 'Review Request', action_url: `/requests/${requestId}`, delegation_id: args.delegationId },
        is_read: false,
      });
    }

    if (didRedirect) {
      redirected.push(requestId);
      // Let the original approver know their pending item moved.
      await supabaseAdmin.from('notifications').insert({
        organization_id: args.orgId,
        recipient_id: args.delegatorId,
        sender_id: args.adminId,
        type: 'system',
        title: 'Your approval was delegated',
        message: `Your pending approval was delegated to ${args.delegateName}. Reason: ${args.reason}`,
        metadata: { request_id: requestId, action_label: 'View Request', action_url: `/requests/${requestId}`, delegation_id: args.delegationId },
        is_read: false,
      });
    }
  }

  return redirected;
}
