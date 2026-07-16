import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Onboarding reporting-line capture for users who are in Azure AD but NOT in
 * HRIMS. Saves their business unit, department, job title and who they report
 * to directly onto the Circle profile (`app_users`).
 *
 * No HRIMS write happens here. Once HR adds the user to HRIMS, every lookup
 * (`employee-by-email`, `resolve-approvers`) resolves from HRIMS first and these
 * Circle-stored values are simply ignored — so the switch is automatic and needs
 * no webhook.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = session.user as any;
  const organizationId = user.org_id;
  const userId = user.id as string;

  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID not found' });
  }

  const { business_unit_id, department_id, job_title, reports_to_user_id } = req.body || {};

  if (!business_unit_id) {
    return res.status(400).json({ error: 'business_unit_id is required' });
  }
  if (!department_id) {
    return res.status(400).json({ error: 'department_id is required' });
  }

  try {
    // Guard against self-selection as manager.
    const managerId = reports_to_user_id && reports_to_user_id !== userId ? reports_to_user_id : null;

    const { error } = await supabaseAdmin
      .from('app_users')
      .update({
        business_unit_id,
        department_id,
        job_title: job_title || null,
        reports_to_user_id: managerId,
      })
      .eq('id', userId);

    if (error) {
      console.error('reporting-line: failed to update profile', error.message);
      return res.status(500).json({ error: 'Failed to save your profile' });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('reporting-line API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
