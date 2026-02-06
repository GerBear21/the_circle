import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateAndStoreArchive } from './generate-pdf';

// Backfill archives for all approved requests that don't have an archive yet
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
    const organizationId = user.org_id;
    const { force } = req.body || {};

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    // Find all approved requests
    const { data: approvedRequests, error: fetchError } = await supabaseAdmin
      .from('requests')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('status', 'approved');

    if (fetchError) {
      throw fetchError;
    }

    if (!approvedRequests || approvedRequests.length === 0) {
      return res.status(200).json({ success: true, message: 'No approved requests found', generated: 0 });
    }

    // Check which ones already have archives
    const { data: existingArchives } = await supabaseAdmin
      .from('archived_documents')
      .select('request_id')
      .in('request_id', approvedRequests.map(r => r.id));

    const existingIds = new Set((existingArchives || []).map(a => a.request_id));
    const targetRequests = force
      ? approvedRequests
      : approvedRequests.filter(r => !existingIds.has(r.id));

    if (targetRequests.length === 0) {
      return res.status(200).json({ success: true, message: force ? 'No approved requests found' : 'All approved requests already archived', generated: 0 });
    }

    // Generate archives for target requests
    let generated = 0;
    const errors: string[] = [];

    for (const request of targetRequests) {
      try {
        console.log(`Backfill: generating archive for request ${request.id}...`);
        const result = await generateAndStoreArchive(request.id, organizationId, user.id, !!force);
        console.log(`Backfill result for ${request.id}:`, JSON.stringify(result));
        if (result.success) {
          generated++;
        } else {
          errors.push(`${request.id}: ${result.error}`);
        }
      } catch (err: any) {
        console.error(`Backfill exception for ${request.id}:`, err);
        errors.push(`${request.id}: ${err.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Generated ${generated} archive(s) out of ${targetRequests.length} ${force ? 'total' : 'missing'}`,
      generated,
      total: targetRequests.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return res.status(500).json({ error: error.message || 'Failed to backfill archives' });
  }
}
