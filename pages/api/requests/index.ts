import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (req.method === 'GET') {
      const { status: statusFilter, type, limit = 50 } = req.query;
      
      let query = supabaseAdmin
        .from('requests')
        .select(`
          id,
          title,
          description,
          status,
          metadata,
          created_at,
          updated_at,
          creator:app_users!requests_creator_id_fkey (
            id,
            display_name,
            email
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: requests, error } = await query;

      if (error) throw error;

      return res.status(200).json({ requests: requests || [] });
    }

    if (req.method === 'POST') {
      const { 
        title, 
        description, 
        priority = 'medium', 
        requestType,
        metadata = {},
        status: requestStatus
      } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      // Allow draft or pending status, default to draft
      const validStatuses = ['draft', 'pending'];
      const finalStatus = validStatuses.includes(requestStatus) ? requestStatus : 'draft';

      // Store priority and requestType in metadata
      const finalMetadata = { 
        ...metadata, 
        priority,
        requestType: requestType || 'general'
      };

      const { data, error } = await supabaseAdmin
        .from('requests')
        .insert({
          organization_id: organizationId,
          creator_id: userId,
          title,
          description: description || null,
          metadata: finalMetadata,
          status: finalStatus,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ request: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Requests API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
