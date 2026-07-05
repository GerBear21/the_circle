import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { SIGNATURE_BUCKET, userSignatureProxyUrl, tempSignatureProxyUrl } from '../../../lib/signatureStorage';
import { validateBody, z } from '../../../lib/validate';
import { audit } from '../../../lib/auditLog';

const UploadSchema = z.object({
  image: z.string().min(1).startsWith('data:image'),
  type: z.enum(['mobile-temp', 'profile']).optional(),
  sessionId: z.string().min(8).max(128).optional(),
});

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
        if (!supabaseAdmin) {
            console.error('[Signature Upload] Supabase admin client is not initialized. Check server-side environment variables.');
            return res.status(500).json({ message: 'Server configuration error: Supabase client not initialized' });
        }

        const body = validateBody(req, res, UploadSchema);
        if (!body) return;
        const { sessionId, type, image } = body;
        console.log(`[Signature Upload] Starting upload for session: ${sessionId}, type: ${type}`);

        const session = await getServerSession(req, res, authOptions);

        // For mobile uploads (temp), we might not have a session cookie on the mobile device?
        // Actually, the mobile device will upload to a temp location using a session ID as the key.
        // The mobile page might not be authenticated if opened via QR code without login.
        // So we should allow unauthenticated uploads for 'mobile-temp' but maybe validate the session ID format.

        console.log(`[Signature Upload] Image size: ${image.length} chars`);

        // Convert base64 to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        let filePath = '';
        let proxyUrl = '';
        const bucket = SIGNATURE_BUCKET;

        if (type === 'mobile-temp' && sessionId) {
            // Temp storage for mobile handoff (capability = high-entropy sessionId)
            filePath = `temp/${sessionId}.png`;
            proxyUrl = tempSignatureProxyUrl(sessionId);
        } else {
            // Permanent storage for user profile
            if (!session) {
                console.warn('[Signature Upload] Unauthorized attempt (no session)');
                return res.status(401).json({ message: 'Unauthorized' });
            }
            const userId = (session.user as any).id;
            filePath = `${userId}.png`;
            proxyUrl = userSignatureProxyUrl(userId);
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

        // Security event: the user registered (or replaced) their saved
        // signature. Mobile-temp uploads are only staged handoffs — they are
        // audited when claimed (see claim-temp.ts).
        if (!(type === 'mobile-temp' && sessionId) && session) {
            await audit(req, session.user, {
                category: 'security',
                action: 'security.signature_registered',
                severity: 'notice',
                targetType: 'user',
                targetId: (session.user as any).id,
                details: { method: 'upload', sizeBytes: buffer.length },
            });
        }

        // Private bucket: return the authenticated proxy URL, not a public URL.
        return res.status(200).json({ url: proxyUrl });
    } catch (error: any) {
        console.error('[Signature Upload] Handler error:', error);
        return res.status(500).json({ message: 'Internal server error', details: error.message });
    }
}
