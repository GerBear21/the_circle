import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncApprovedPdfToMicrosoft, isDocumentUploadConfigured } from '@/lib/graphDocumentUpload';
import { audit } from '@/lib/auditLog';

/**
 * POST /api/archives/sync-microsoft { archiveId }
 *
 * User-triggered Microsoft 365 sync for an archived approval document:
 * saves the signed PDF into the caller's OneDrive and emails it to them via
 * Outlook (plus the org Teams/SharePoint targets when configured).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = session.user as any;
    const { archiveId } = req.body || {};
    if (!archiveId) {
      return res.status(400).json({ error: 'archiveId is required' });
    }

    if (!isDocumentUploadConfigured()) {
      return res.status(200).json({ teams: false, sharepoint: false, onedrive: false, email: false, configured: false });
    }

    const { data: archive, error } = await supabaseAdmin
      .from('archived_documents')
      .select('id, organization_id, storage_path, request_title, request_reference, request_id')
      .eq('id', archiveId)
      .single();

    if (error || !archive) {
      return res.status(404).json({ error: 'Archived document not found' });
    }
    if (archive.organization_id !== user.org_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await syncApprovedPdfToMicrosoft({
      storagePath: archive.storage_path,
      referenceCode: archive.request_reference,
      title: archive.request_title,
      recipientEmail: user.email || null,
    });

    await audit(req, user, {
      category: 'activity',
      action: 'archive.synced_to_microsoft',
      outcome: result.teams || result.sharepoint || result.onedrive || result.email ? 'success' : 'failure',
      targetType: 'archive',
      targetId: archive.id,
      targetLabel: archive.request_title,
      requestId: archive.request_id,
      details: { ...result },
    });

    return res.status(200).json({ ...result, configured: true });
  } catch (error: any) {
    console.error('Archive Microsoft sync error:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync to Microsoft 365' });
  }
}
