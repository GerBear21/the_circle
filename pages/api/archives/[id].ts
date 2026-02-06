import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Archive ID is required' });
    }

    // Fetch the archive
    const { data: archive, error } = await supabaseAdmin
      .from('archived_documents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Archive not found' });
      }
      throw error;
    }

    // Generate signed URL for the archive document
    const { data: signedUrl } = await supabaseAdmin.storage
      .from('archives')
      .createSignedUrl(archive.storage_path, 3600);

    // Generate signed URLs for attached documents
    const attachedDocsWithUrls = await Promise.all(
      (archive.attached_documents || []).map(async (doc: any) => {
        try {
          const { data: docSignedUrl } = await supabaseAdmin.storage
            .from('quotations')
            .createSignedUrl(doc.storage_path, 3600);
          return {
            ...doc,
            download_url: docSignedUrl?.signedUrl || null,
          };
        } catch (e) {
          return { ...doc, download_url: null };
        }
      })
    );

    return res.status(200).json({
      archive: {
        ...archive,
        download_url: signedUrl?.signedUrl || null,
        attached_documents: attachedDocsWithUrls,
      },
    });
  } catch (error: any) {
    console.error('Archive API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch archive' });
  }
}
