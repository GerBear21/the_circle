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
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    if (req.method === 'GET') {
      const { data: request, error } = await supabaseAdmin
        .from('requests')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          category,
          request_type,
          metadata,
          created_at,
          updated_at,
          creator:app_users!requests_creator_id_fkey (
            id,
            display_name,
            email
          ),
          template:approval_templates (
            id,
            name
          )
        `)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Request not found' });
        }
        throw error;
      }

      return res.status(200).json({ request });
    }

    if (req.method === 'PUT') {
      const { title, description, priority, category, status, metadata } = req.body;

      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (priority !== undefined) updates.priority = priority;
      if (category !== undefined) updates.category = category;
      if (status !== undefined) updates.status = status;
      if (metadata !== undefined) updates.metadata = metadata;

      const { data, error } = await supabaseAdmin
        .from('requests')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Request not found' });
        }
        throw error;
      }

      return res.status(200).json({ request: data });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabaseAdmin
        .from('requests')
        .delete()
        .eq('id', id)
        .eq('organization_id', organizationId);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Request API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
