import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { tempSignatureProxyUrl } from '../../../lib/signatureStorage';
import { validateQuery, z } from '../../../lib/validate';

const CheckSchema = z.object({ sessionId: z.string().min(8).max(128) });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const query = validateQuery(req, res, CheckSchema);
    if (!query) return;
    const { sessionId } = query;

    try {
        console.log(`[Signature Check] Checking for session: ${sessionId}`);

        // Check if the temp file exists in storage
        // using list() on the folder
        const { data, error } = await supabaseAdmin.storage
            .from('signatures')
            .list('temp', {
                limit: 1,
                search: `${sessionId}.png`,
            });

        if (error) {
            console.error('[Signature Check] Storage list error:', error);
            throw error;
        }

        console.log(`[Signature Check] List result for ${sessionId}:`, data);

        if (data && data.length > 0) {
            // Precise match check because 'search' is fuzzy
            const exactMatch = data.find(f => f.name === `${sessionId}.png`);

            if (exactMatch) {
                console.log(`[Signature Check] Found exact match for ${sessionId}.png`);
                // Private bucket: return the capability-scoped proxy URL.
                return res.status(200).json({ found: true, url: tempSignatureProxyUrl(sessionId) });
            } else {
                console.log(`[Signature Check] No exact match found in results for ${sessionId}.png`);
            }
        } else {
            console.log(`[Signature Check] Empty data returned for ${sessionId}`);
        }

        return res.status(200).json({ found: false });
    } catch (error) {
        console.error('Check handler error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
