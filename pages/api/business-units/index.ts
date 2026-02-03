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
      // Business units to exclude from the list
      const excludedUnits = [
        'Gateway Stream',
        'Heritage Expeditions Africa',
        'Corporate Office',
        'RTG Head Office'
      ];

      // Fetch business units for the organization
      const { data, error } = await supabaseAdmin
        .from('business_units')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching business units:', error);
        return res.status(500).json({ error: 'Failed to fetch business units' });
      }

      // Filter out excluded business units
      const filteredData = (data || []).filter(
        (unit) => !excludedUnits.includes(unit.name)
      );

      return res.status(200).json({ businessUnits: filteredData });
    }

    if (req.method === 'POST') {
      // Create a new business unit
      const { name } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Business unit name is required' });
      }

      const { data, error } = await supabaseAdmin
        .from('business_units')
        .insert({
          organization_id: orgId,
          name: name.trim(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating business unit:', error);
        return res.status(500).json({ error: 'Failed to create business unit' });
      }

      return res.status(201).json({ businessUnit: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Business units API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
