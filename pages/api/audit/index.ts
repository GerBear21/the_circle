import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const session = await getServerSession(req, res, authOptions);

        if (!session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = session.user as any;
        const organizationId = user.org_id;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID not found' });
        }

        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { requestId } = req.query;

        let queryModifications = supabaseAdmin
            .from('request_modifications')
            .select(`
        id,
        created_at,
        modification_type,
        field_name,
        old_value,
        new_value,
        request_id,
        modified_by,
        requests (
          title,
          metadata
        ),
        app_users!request_modifications_modified_by_fkey (
          display_name,
          email,
          profile_picture_url
        )
      `)
            .order('created_at', { ascending: false });

        let queryApprovals = supabaseAdmin
            .from('approvals')
            .select(`
        id,
        signed_at,
        decision,
        comment,
        request_id,
        approver_id,
        requests (
          title
        ),
        app_users!approvals_approver_id_fkey (
          display_name,
          email,
          profile_picture_url
        )
      `)
            .order('signed_at', { ascending: false });

        if (requestId) {
            queryModifications = queryModifications.eq('request_id', requestId);
            queryApprovals = queryApprovals.eq('request_id', requestId);
        } else {
            queryModifications = queryModifications.limit(100);
            queryApprovals = queryApprovals.limit(100);
        }

        // 1. Fetch Request Modifications (Changes)
        const { data: modifications, error: modError } = await queryModifications;
        if (modError) throw modError;

        // 2. Fetch Approvals (Decisions)
        const { data: approvals, error: appError } = await queryApprovals;
        if (appError) throw appError;

        // 3. Normalize and Combine
        const modificationLogs = (modifications || []).map((mod: any) => ({
            id: mod.id,
            timestamp: mod.created_at,
            actor: {
                name: mod.app_users?.display_name || 'Unknown User',
                email: mod.app_users?.email,
                avatar: mod.app_users?.profile_picture_url
            },
            action: `Changed ${mod.field_name || 'Field'}`,
            details: {
                field: mod.field_name,
                old: mod.old_value,
                new: mod.new_value,
                type: mod.modification_type
            },
            entity: {
                type: 'Request',
                id: mod.request_id,
                title: mod.requests?.title || 'Unknown Request',
                ref: mod.requests?.metadata?.reference_number
            },
            type: 'modification'
        }));

        const approvalLogs = (approvals || []).map((app: any) => ({
            id: app.id,
            timestamp: app.signed_at,
            actor: {
                name: app.app_users?.display_name || 'Unknown Approver',
                email: app.app_users?.email,
                avatar: app.app_users?.profile_picture_url
            },
            action: app.decision === 'approved' ? 'Approved Request' : 'Rejected Request',
            details: {
                comment: app.comment
            },
            entity: {
                type: 'Request',
                id: app.request_id,
                title: app.requests?.title || 'Unknown Request'
            },
            type: 'approval'
        }));

        // Combine and Sort
        const allLogs = [...modificationLogs, ...approvalLogs].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return res.status(200).json({ logs: allLogs });

    } catch (error: any) {
        console.error('Audit API error:', error);
        return res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
}
