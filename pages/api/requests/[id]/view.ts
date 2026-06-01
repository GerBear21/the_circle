import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

// POST /api/requests/[id]/view
// Records that the current user (assumed to be an assigned approver on this
// request) just opened the details page. Updates `first_viewed_at` only if
// it's null, and always refreshes `last_viewed_at`. Silently no-ops when
// the user isn't a step approver — we don't want this called constantly
// from the requester's own page to be noisy in the logs.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = session.user as any;
        const organizationId = user.org_id;
        const userId = user.id;
        const { id: requestId } = req.query;

        if (!organizationId || !requestId || typeof requestId !== 'string') {
            return res.status(400).json({ error: 'Missing organization or request ID' });
        }

        // Confirm the request belongs to this user's org. Avoids accidentally
        // touching a step from a different tenant if IDs ever collide.
        const { data: request, error: requestError } = await supabaseAdmin
            .from('requests')
            .select('id, organization_id')
            .eq('id', requestId)
            .eq('organization_id', organizationId)
            .single();

        if (requestError || !request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Find the step(s) this user is assigned to on this request.
        const { data: steps, error: stepsError } = await supabaseAdmin
            .from('request_steps')
            .select('id, first_viewed_at')
            .eq('request_id', requestId)
            .eq('approver_user_id', userId);

        if (stepsError) {
            return res.status(500).json({ error: 'Failed to load steps' });
        }

        // Not an approver — no-op success so the page can call this
        // unconditionally without branching on role.
        if (!steps || steps.length === 0) {
            return res.status(200).json({ tracked: false });
        }

        const now = new Date().toISOString();
        const updates = steps.map((step) => ({
            id: step.id,
            first_viewed_at: step.first_viewed_at || now,
            last_viewed_at: now,
        }));

        // Upsert one row at a time — request_steps has a primary key on id,
        // and there are usually only 1–2 rows per call so a bulk upsert isn't
        // worth the complexity here.
        for (const update of updates) {
            await supabaseAdmin
                .from('request_steps')
                .update({
                    first_viewed_at: update.first_viewed_at,
                    last_viewed_at: update.last_viewed_at,
                })
                .eq('id', update.id);
        }

        return res.status(200).json({ tracked: true, steps: updates.length });
    } catch (error: any) {
        console.error('Request view tracking error:', error);
        return res.status(500).json({ error: error.message || 'Failed to track view' });
    }
}
