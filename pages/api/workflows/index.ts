import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
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
        const creatorId = user.id;

        if (!creatorId) {
            return res.status(400).json({ error: 'User session invalid' });
        }

        const { name, description, steps, settings } = req.body || {};

        if (!name) {
            return res.status(400).json({ error: 'Workflow name is required' });
        }

        // Insert into workflows table
        const { data, error } = await supabaseAdmin
            .from('workflows')
            .insert({
                name,
                description,
                steps,
                settings,
                creator_id: creatorId,
                organization_id: organizationId || null,
            })
            .select('id')
            .single();

        if (error) {
            console.error('Database error creating workflow:', error);
            return res.status(500).json({ error: 'Failed to create workflow', details: error.message });
        }

        return res.status(201).json({ id: data.id, message: 'Workflow saved successfully' });
    } catch (err) {
        console.error('Server error creating workflow:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
