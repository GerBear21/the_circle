import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabaseAdmin
        .from('app_users')
        .select(`
          *,
          organization:organizations(id, name),
          department:departments(id, name, code),
          business_unit:business_units(id, name)
        `)
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to basic query if joins fail
        const { data: basicData, error: basicError } = await supabaseAdmin
          .from('app_users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (basicError) {
          return res.status(500).json({ error: 'Failed to fetch user profile' });
        }
        return res.status(200).json(basicData);
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error('Error in profile API:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { department_id, business_unit_id } = req.body;

      if (!department_id || !business_unit_id) {
        return res.status(400).json({ error: 'department_id and business_unit_id are required' });
      }

      const { data, error } = await supabaseAdmin
        .from('app_users')
        .update({
          department_id,
          business_unit_id
        })
        .eq('id', session.user.id)
        .select(`
          *,
          organization:organizations(id, name),
          department:departments(id, name, code),
          business_unit:business_units(id, name)
        `)
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error('Error in profile update API:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
