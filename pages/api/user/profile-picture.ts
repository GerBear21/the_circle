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
        if (!supabaseAdmin) {
            console.error('[Profile Picture] Supabase admin client is not initialized.');
            return res.status(500).json({ message: 'Server configuration error: Supabase client not initialized' });
        }

        const session = await getServerSession(req, res, authOptions);

        if (!session) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userId = (session.user as any).id;
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ message: 'No image provided' });
        }

        // Convert base64 to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Determine file extension from base64 header
        const mimeMatch = image.match(/^data:image\/(\w+);base64,/);
        const extension = mimeMatch ? mimeMatch[1] : 'png';
        const contentType = `image/${extension}`;

        const filePath = `${userId}.${extension}`;
        const bucket = 'profile_pictures';

        // Upload to Supabase storage
        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(filePath, buffer, {
                contentType,
                upsert: true,
            });

        if (error) {
            console.error('[Profile Picture] Supabase storage error:', error);
            return res.status(500).json({ message: 'Failed to upload profile picture', error: error.message });
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(filePath);

        // Update user profile with the new profile picture URL
        const { error: updateError } = await supabaseAdmin
            .from('app_users')
            .update({ profile_picture_url: publicUrl })
            .eq('id', userId);

        if (updateError) {
            console.error('[Profile Picture] Database update error:', updateError);
            // Still return success since the image was uploaded
        }

        return res.status(200).json({ url: publicUrl });
    } catch (error: any) {
        console.error('[Profile Picture] Handler error:', error);
        return res.status(500).json({ message: 'Internal server error', details: error.message });
    }
}
