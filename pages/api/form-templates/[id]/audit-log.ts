import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.query;

  try {
    // Fetch audit log entries for this form template
    const { data: logs, error } = await supabase
      .from('form_template_audit_log')
      .select(`
        *,
        editor:edited_by (
          id,
          display_name,
          email
        )
      `)
      .eq('form_template_id', id)
      .order('edited_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({ logs });
  } catch (error: any) {
    console.error('Error fetching audit log:', error);
    return res.status(500).json({ error: error.message });
  }
}
