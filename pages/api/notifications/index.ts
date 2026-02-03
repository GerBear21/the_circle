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
    const userId = user.id;
    const organizationId = user.org_id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (req.method === 'GET') {
      const { type, unread_only, limit = 50 } = req.query;
      
      let query = supabaseAdmin
        .from('notifications')
        .select(`
          id,
          type,
          title,
          message,
          is_read,
          metadata,
          created_at,
          sender:app_users!notifications_sender_id_fkey (
            id,
            display_name,
            email
          )
        `)
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (type) {
        query = query.eq('type', type);
      }

      if (unread_only === 'true') {
        query = query.eq('is_read', false);
      }

      const { data: notifications, error } = await query;

      if (error) throw error;

      // Get unread counts
      const { count: unreadMessages } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('type', 'message')
        .eq('is_read', false);

      const { count: unreadTasks } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('type', 'task')
        .eq('is_read', false);

      return res.status(200).json({ 
        notifications: notifications || [],
        unreadCounts: {
          messages: unreadMessages || 0,
          tasks: unreadTasks || 0,
        }
      });
    }

    if (req.method === 'POST') {
      const { recipient_id, type, title, message, metadata } = req.body;

      if (!recipient_id || !type || !title) {
        return res.status(400).json({ error: 'recipient_id, type, and title are required' });
      }

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert({
          organization_id: organizationId,
          recipient_id,
          sender_id: userId,
          type,
          title,
          message: message || null,
          metadata: metadata || {},
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ notification: data });
    }

    if (req.method === 'PATCH') {
      const { notification_ids, is_read } = req.body;

      if (!notification_ids || !Array.isArray(notification_ids)) {
        return res.status(400).json({ error: 'notification_ids array is required' });
      }

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: is_read ?? true })
        .in('id', notification_ids)
        .eq('recipient_id', userId)
        .select();

      if (error) throw error;

      return res.status(200).json({ notifications: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Notifications API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process notification request' });
  }
}
