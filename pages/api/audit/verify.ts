import { NextApiRequest, NextApiResponse } from 'next';
import { guardAuditApi } from '@/lib/auditAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { audit } from '@/lib/auditLog';

/**
 * POST /api/audit/verify — re-computes the SHA-256 hash chain across the
 * entire audit log (verify_audit_chain() in Postgres) and reports whether
 * any record has been tampered with. The verification run is itself logged
 * as a compliance event.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const guard = await guardAuditApi(req, res, ['audit.verify']);
  if (!guard) return;

  try {
    const { data, error } = await supabaseAdmin.rpc('verify_audit_chain');
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    await audit(req, guard.user, {
      category: 'compliance',
      action: 'audit.integrity_verified',
      severity: result?.is_valid ? 'notice' : 'critical',
      outcome: result?.is_valid ? 'success' : 'failure',
      details: {
        eventsChecked: result?.events_checked,
        firstBrokenSequence: result?.first_broken_sequence,
      },
    });

    return res.status(200).json({
      isValid: !!result?.is_valid,
      eventsChecked: result?.events_checked ?? 0,
      firstBrokenSequence: result?.first_broken_sequence ?? null,
      verifiedAt: result?.verified_at ?? new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Audit verify API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to verify audit chain' });
  }
}
