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

    try {
        const session = await getServerSession(req, res, authOptions);

        // For mobile uploads (temp), we might not have a session cookie on the mobile device?
        // Actually, the mobile device will upload to a temp location using a session ID as the key.
        // The mobile page might not be authenticated if opened via QR code without login.
        // So we should allow unauthenticated uploads for 'mobile-temp' but maybe validate the session ID format.

        const { image, sessionId, type } = req.body;

        if (!image) {
            return res.status(400).json({ message: 'No image provided' });
        }

        // Convert base64 to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        let filePath = '';
        let bucket = 'signatures'; // We assume this bucket exists

        if (type === 'mobile-temp' && sessionId) {
            // Temp storage for mobile handoff
            filePath = `temp/${sessionId}.png`;
        } else {
            // Permanent storage for user profile
            if (!session) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const userId = (session.user as any).id;
            filePath = `${userId}.png`;
        }

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(filePath, buffer, {
                contentType: 'image/png',
                upsert: true,
            });

        if (error) {
            console.error('Supabase storage error:', error);
            return res.status(500).json({ message: 'Failed to upload signature', error: error.message });
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return res.status(200).json({ url: publicUrl });
    } catch (error) {
        console.error('Upload handler error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
