import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { generateAndStoreArchive } from '../../archives/generate-pdf';

/**
 * GET /api/requests/[id]/archive
 *
 * Returns a signed download URL for the auto-generated PDF archive of a
 * fully-approved request. If the archive doesn't exist yet (e.g. older
 * requests that were approved before auto-archiving was wired up, or a
 * race where the approval hook hasn't finished) we generate it on demand.
 *
 * Visibility mirrors /api/requests/[id]/pdf — creator, watchers, and
 * approvers who have had their turn may all download the archive.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
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
        const { id } = req.query;

        if (!organizationId) return res.status(400).json({ error: 'Organization ID not found' });
        if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Request ID is required' });

        // Verify the request exists in this org and is fully approved.
        const { data: request, error: requestError } = await supabaseAdmin
            .from('requests')
            .select(`
                id, creator_id, status, metadata,
                request_steps ( approver_user_id, status )
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();

        if (requestError || !request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'approved') {
            return res.status(400).json({ error: 'Approved-document archive is only available for fully-approved requests' });
        }

        const isCreator = request.creator_id === userId;
        const watchers = Array.isArray((request.metadata as any)?.watchers) ? (request.metadata as any).watchers : [];
        const isWatcher = watchers.some((w: any) => (typeof w === 'string' ? w : w?.id) === userId);
        const steps = (request as any).request_steps || [];
        const isApprover = steps.some((s: any) => s.approver_user_id === userId && s.status !== 'waiting');

        if (!isCreator && !isWatcher && !isApprover) {
            return res.status(403).json({ error: 'You do not have permission to download this archive' });
        }

        // Try to find an existing archive row first.
        let { data: archive, error: archiveError } = await supabaseAdmin
            .from('archived_documents')
            .select('id, storage_path, filename')
            .eq('request_id', id)
            .order('archived_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (archiveError && archiveError.code !== 'PGRST116') {
            console.error('archived_documents lookup error:', archiveError);
        }

        // Fall back to generating on demand if none exists yet.
        if (!archive) {
            const gen = await generateAndStoreArchive(id, organizationId, userId);
            if (!gen.success || !gen.archive) {
                return res.status(500).json({ error: gen.error || 'Failed to generate archive' });
            }
            archive = {
                id: gen.archive.id,
                storage_path: gen.archive.storage_path,
                filename: gen.archive.filename,
            };
        }

        const { data: signed, error: signedError } = await supabaseAdmin.storage
            .from('archives')
            .createSignedUrl(archive.storage_path, 3600);

        if (signedError || !signed?.signedUrl) {
            return res.status(500).json({ error: signedError?.message || 'Could not create download URL' });
        }

        return res.status(200).json({
            success: true,
            archive: {
                id: archive.id,
                filename: archive.filename,
                download_url: signed.signedUrl,
            },
        });
    } catch (error: any) {
        console.error('archive endpoint error:', error);
        return res.status(500).json({ error: error.message || 'Internal error' });
    }
}
