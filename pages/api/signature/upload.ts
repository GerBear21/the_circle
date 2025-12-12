import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb',
        },
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { sessionId, type } = req.body;
    console.log(`[Signature Upload] Starting upload for session: ${sessionId}, type: ${type}`);

    try {
        if (!supabaseAdmin) {
            console.error('[Signature Upload] Supabase admin client is not initialized. Check server-side environment variables.');
            return res.status(500).json({ message: 'Server configuration error: Supabase client not initialized' });
        }

        const session = await getServerSession(req, res, authOptions);

        // For mobile uploads (temp), we might not have a session cookie on the mobile device?
        // Actually, the mobile device will upload to a temp location using a session ID as the key.
        // The mobile page might not be authenticated if opened via QR code without login.
        // So we should allow unauthenticated uploads for 'mobile-temp' but maybe validate the session ID format.

        const { image } = req.body;

        if (!image) {
            console.error('[Signature Upload] No image provided');
            return res.status(400).json({ message: 'No image provided' });
        }

        console.log(`[Signature Upload] Image size: ${image.length} chars`);

        // Convert base64 to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        let filePath = '';
        let bucket = 'signatures'; // We assume this bucket exists

        if (type === 'mobile-temp' && sessionId) {
            // Temp storage for mobile handoff
            if (!/^[0-9a-fA-F-]{36}$/.test(sessionId) && sessionId.length < 10) {
                // Basic validation, uuid usually 36 chars.
                // But since we want to be safe, just ensure it's a string
                console.warn(`[Signature Upload] Suspicious sessionId format: ${sessionId}`);
            }
            filePath = `temp/${sessionId}.png`;
        } else {
            // Permanent storage for user profile
            if (!session) {
                console.warn('[Signature Upload] Unauthorized attempt (no session)');
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const userId = (session.user as any).id;
            filePath = `${userId}.png`;
        }

        console.log(`[Signature Upload] Uploading to ${bucket}/${filePath}`);

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(filePath, buffer, {
                contentType: 'image/png',
                upsert: true,
            });

        if (error) {
            console.error('[Signature Upload] Supabase storage error:', error);
            return res.status(500).json({ message: 'Failed to upload signature', error: error.message });
        }

        console.log('[Signature Upload] Upload success');

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(filePath);

        console.log(`[Signature Upload] Public URL generated: ${publicUrl}`);
        return res.status(200).json({ url: publicUrl });
    } catch (error: any) {
        console.error('[Signature Upload] Handler error:', error);
        return res.status(500).json({ message: 'Internal server error', details: error.message });
    }
}
