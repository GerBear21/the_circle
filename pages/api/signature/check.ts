import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { sessionId } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ message: 'Invalid session ID' });
    }

    try {
        // Check if the temp file exists in storage
        // using list() on the folder
        const { data, error } = await supabaseAdmin.storage
            .from('signatures')
            .list('temp', {
                limit: 1,
                search: `${sessionId}.png`,
            });

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            const { data: { publicUrl } } = supabaseAdmin.storage
                .from('signatures')
                .getPublicUrl(`temp/${sessionId}.png`);

            return res.status(200).json({ found: true, url: publicUrl });
        }

        return res.status(200).json({ found: false });
    } catch (error) {
        console.error('Check handler error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
