import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const orgId = (session.user as any).org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (req.method === 'GET') {
      // Fetch departments for the organization
      const { data, error } = await supabaseAdmin
        .from('departments')
        .select('id, name, code, description')
        .eq('organization_id', orgId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching departments:', error);
        return res.status(500).json({ error: 'Failed to fetch departments' });
      }

      return res.status(200).json({ departments: data || [] });
    }

    if (req.method === 'POST') {
      // Create a new department
      const { name, code, description } = req.body;

      if (!name || typeof name !== 'string' || !code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Department name and code are required' });
      }

      const { data, error } = await supabaseAdmin
        .from('departments')
        .insert({
          organization_id: orgId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating department:', error);
        return res.status(500).json({ error: 'Failed to create department' });
      }

      return res.status(201).json({ department: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Departments API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
