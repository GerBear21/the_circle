import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const session = await getServerSession(req, res, authOptions);
        if (!session) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = (session.user as any)?.id;
        if (!userId) {
            return res.status(400).json({ message: 'User ID not found' });
        }

        const { sessionId } = req.body as { sessionId?: string };
        if (!sessionId || typeof sessionId !== 'string') {
            return res.status(400).json({ message: 'Invalid sessionId' });
        }

        const bucket = 'signatures';
        const tempPath = `temp/${sessionId}.png`;
        const finalPath = `${userId}.png`;

        const { data: tempFile, error: downloadError } = await supabaseAdmin.storage
            .from(bucket)
            .download(tempPath);

        if (downloadError || !tempFile) {
            console.error('Temp signature download error:', downloadError);
            return res.status(404).json({ message: 'Temp signature not found' });
        }

        const arrayBuffer = await tempFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabaseAdmin.storage
            .from(bucket)
            .upload(finalPath, buffer, {
                contentType: 'image/png',
                upsert: true,
            });

        if (uploadError) {
            console.error('Final signature upload error:', uploadError);
            return res.status(500).json({ message: 'Failed to save signature' });
        }

        // Best-effort cleanup of temp file
        await supabaseAdmin.storage.from(bucket).remove([tempPath]);

        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(finalPath);

        return res.status(200).json({ url: publicUrl });
    } catch (error) {
        console.error('Claim temp handler error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
