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
      // Fetch user profile - department and business_unit data comes from HRIMS, not local tables
      const { data, error } = await supabaseAdmin
        .from('app_users')
        .select(`
          *,
          organization:organizations(id, name)
        `)
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({ error: 'Failed to fetch user profile' });
      }

      return res.status(200).json(data);
    } catch (err) {
      console.error('Error in profile API:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { 
        department_id, 
        business_unit_id, 
        hrims_employee_id, 
        job_title, 
        first_name, 
        last_name 
      } = req.body;

      if (!business_unit_id) {
        return res.status(400).json({ error: 'business_unit_id is required' });
      }

      // Build update payload - include HRIMS fields if provided
      const updatePayload: Record<string, any> = {
        department_id: department_id || null,
        business_unit_id,
      };

      // Add HRIMS-specific fields if provided
      if (hrims_employee_id !== undefined) {
        updatePayload.hrims_employee_id = hrims_employee_id;
      }
      if (job_title !== undefined) {
        updatePayload.job_title = job_title;
      }
      if (first_name !== undefined) {
        updatePayload.first_name = first_name;
      }
      if (last_name !== undefined) {
        updatePayload.last_name = last_name;
      }

      const { data, error } = await supabaseAdmin
        .from('app_users')
        .update(updatePayload)
        .eq('id', session.user.id)
        .select('*')
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
