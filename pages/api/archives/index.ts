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

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    // Parse query parameters
    const { limit = '50', offset = '0', search, category, dateRange } = req.query;

    // Build query
    let query = supabaseAdmin
      .from('archived_documents')
      .select(`
        id,
        request_id,
        filename,
        storage_path,
        file_size,
        archived_at,
        request_title,
        request_reference,
        requester_name,
        requester_department,
        total_amount,
        currency,
        approval_completed_at,
        approver_count,
        attached_documents
      `)
      .eq('organization_id', organizationId)
      .order('archived_at', { ascending: false });

    // Apply search filter
    if (search && typeof search === 'string') {
      query = query.or(`request_title.ilike.%${search}%,request_reference.ilike.%${search}%,requester_name.ilike.%${search}%`);
    }

    // Apply date range filter
    if (dateRange && typeof dateRange === 'string') {
      const now = new Date();
      let startDate: Date | null = null;

      switch (dateRange) {
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last_3_months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case 'this_year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      if (startDate) {
        query = query.gte('archived_at', startDate.toISOString());
      }
    }

    // Apply pagination
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data: archives, error, count } = await query;

    if (error) {
      console.error('Error fetching archives:', error);
      throw error;
    }

    // Generate signed URLs for each archive
    const archivesWithUrls = await Promise.all(
      (archives || []).map(async (archive) => {
        try {
          const { data: signedUrl } = await supabaseAdmin.storage
            .from('archives')
            .createSignedUrl(archive.storage_path, 3600); // 1 hour expiry

          return {
            ...archive,
            download_url: signedUrl?.signedUrl || null,
          };
        } catch (e) {
          return { ...archive, download_url: null };
        }
      })
    );

    return res.status(200).json({ 
      archives: archivesWithUrls,
      total: count || archivesWithUrls.length
    });
  } catch (error: any) {
    console.error('Archives API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch archives' });
  }
}
