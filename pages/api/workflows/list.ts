import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ error: 'Database configuration missing' });
        }

        const session = await getServerSession(req, res, authOptions);

        if (!session?.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = session.user as any;
        const organizationId = user.org_id;

        // Fetch workflows for the user's organization
        let query = supabaseAdmin
            .from('workflows')
            .select('id, name, description, steps, settings, created_at')
            .order('created_at', { ascending: false });

        // If user has an organization, filter by it
        if (organizationId) {
            query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching workflows:', error);
            return res.status(500).json({ error: 'Failed to fetch workflows', details: error.message });
        }

        return res.status(200).json({ workflows: data || [] });
    } catch (err) {
        console.error('List workflows error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
