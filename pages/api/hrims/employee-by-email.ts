import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { fetchHrimsEmployeeByEmail, hrimsClient } from '@/lib/hrimsClient';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Look a user up for profile autofill.
 *
 * HRIMS is the source of truth and is tried first. If the user is not in HRIMS
 * (e.g. an Azure-AD-only joiner who completed onboarding manually), we fall back
 * to the details they saved on their Circle profile so forms still autofill
 * their department, business unit, job title and reporting line.
 *
 * `found` always reflects HRIMS presence, so onboarding keeps treating these
 * users as "not in HRIMS". The moment HR adds them to HRIMS, this endpoint
 * returns the HRIMS record instead — no webhook needed.
 */

async function buildCircleFallback(email: string, organizationId: string) {
  const { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('id, first_name, last_name, display_name, email, job_title, department_id, business_unit_id, reports_to_user_id')
    .eq('organization_id', organizationId)
    .ilike('email', email)
    .maybeSingle();

  if (!appUser || (!appUser.department_id && !appUser.business_unit_id)) return null;

  // Resolve department + business unit names from HRIMS (the stored ids are HRIMS ids).
  let department: { id: string; name: string; code: string } | null = null;
  let businessUnit: { id: string; name: string; code: string } | null = null;
  if (hrimsClient && appUser.department_id) {
    const { data } = await hrimsClient
      .from('departments')
      .select('id, name, code')
      .eq('id', appUser.department_id)
      .maybeSingle();
    department = (data as any) || null;
  }
  if (hrimsClient && appUser.business_unit_id) {
    const { data } = await hrimsClient
      .from('business_units')
      .select('id, name, code')
      .eq('id', appUser.business_unit_id)
      .maybeSingle();
    businessUnit = (data as any) || null;
  }

  // Resolve the reporting line (a Circle app_user picked during onboarding).
  let reportsTo: { name: string; email: string | null; jobTitle: string | null } | null = null;
  if (appUser.reports_to_user_id) {
    const { data: mgr } = await supabaseAdmin
      .from('app_users')
      .select('display_name, email, job_title')
      .eq('id', appUser.reports_to_user_id)
      .maybeSingle();
    if (mgr) {
      reportsTo = { name: mgr.display_name || mgr.email, email: mgr.email || null, jobTitle: mgr.job_title || null };
    }
  }

  return {
    employee: {
      id: appUser.id,
      first_name: appUser.first_name,
      last_name: appUser.last_name,
      email: appUser.email,
      job_title: appUser.job_title,
      department_id: appUser.department_id,
      business_unit_id: appUser.business_unit_id,
    },
    department,
    businessUnit,
    position: null,
    reportsTo,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email } = req.query;

    // Use the provided email or fall back to the session user's email
    const targetEmail = (email as string) || session.user.email;

    if (!targetEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await fetchHrimsEmployeeByEmail(targetEmail);

    if (result) {
      return res.status(200).json({
        found: true,
        source: 'hrims',
        employee: result.employee,
        department: result.department,
        businessUnit: result.businessUnit,
        position: result.position,
        reportsTo: result.reportsTo,
      });
    }

    // Not in HRIMS — fall back to the details saved on the Circle profile.
    const organizationId = (session.user as any).org_id;
    const fallback = organizationId ? await buildCircleFallback(targetEmail, organizationId) : null;

    if (fallback) {
      return res.status(200).json({
        found: false,
        source: 'circle',
        employee: fallback.employee,
        department: fallback.department,
        businessUnit: fallback.businessUnit,
        position: fallback.position,
        reportsTo: fallback.reportsTo,
      });
    }

    return res.status(404).json({
      found: false,
      message: 'Employee not found in HRIMS database',
    });
  } catch (error: any) {
    console.error('HRIMS Employee by Email API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch employee from HRIMS' });
  }
}
