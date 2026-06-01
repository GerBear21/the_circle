import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/requests/lookup-by-reference?code=XXX&onlyApproved=true
 *
 * Used by the petty-cash form (and any future form that wants to attach a
 * back-reference to another in-system request). Looks up requests whose
 * metadata.referenceCode begins with the supplied prefix, or — if the prefix
 * is long — matches exactly. Restricted to the caller's organisation.
 *
 * Defaults to "fully approved only" so the typical petty-cash use case
 * (linking a paid invoice to its approved CAPEX, travel auth, etc.) just
 * works without the caller having to filter client-side.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = session.user as any;
        const organizationId = user.org_id;
        if (!organizationId) return res.status(400).json({ error: 'Organization ID not found' });

        const codeParam = req.query.code;
        const code = typeof codeParam === 'string' ? codeParam.trim() : '';
        if (!code) return res.status(200).json({ requests: [] });

        const onlyApproved = req.query.onlyApproved !== 'false';

        // Postgres JSONB filter — supabase-js exposes `->>` via the standard
        // builder. We need a wildcard match on metadata.referenceCode.
        let query = supabaseAdmin
            .from('requests')
            .select(`
                id,
                title,
                description,
                status,
                created_at,
                updated_at,
                metadata,
                creator:app_users!requests_creator_id_fkey ( id, display_name, email )
            `)
            .eq('organization_id', organizationId)
            .ilike('metadata->>referenceCode', `${code}%`)
            .order('updated_at', { ascending: false })
            .limit(15);

        if (onlyApproved) {
            query = query.eq('status', 'approved');
        }

        const { data, error } = await query;
        if (error) {
            console.error('lookup-by-reference error:', error);
            return res.status(500).json({ error: error.message });
        }

        const results = (data || []).map((r: any) => {
            const md = r.metadata || {};
            const creator = Array.isArray(r.creator) ? r.creator[0] : r.creator;
            return {
                id: r.id,
                title: r.title,
                description: r.description,
                status: r.status,
                requestType: md.type || md.requestType || 'request',
                referenceCode: md.referenceCode || null,
                approvedAt: r.status === 'approved' ? r.updated_at : null,
                createdAt: r.created_at,
                creator: creator ? { id: creator.id, display_name: creator.display_name, email: creator.email } : null,
            };
        });

        return res.status(200).json({ requests: results });
    } catch (error: any) {
        console.error('lookup-by-reference exception:', error);
        return res.status(500).json({ error: error.message || 'Internal error' });
    }
}
