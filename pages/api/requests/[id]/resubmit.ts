import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ApprovalEngine } from '@/lib/approvalEngine';
import { audit } from '@/lib/auditLog';
import { validateBody, z } from '@/lib/validate';

/**
 * POST /api/requests/[id]/resubmit
 *
 * Lets the requester edit and resubmit a previously REJECTED request.
 *
 *   1. Authorize: caller must be the request creator and the request must
 *      currently be rejected.
 *   2. Persist any field edits into metadata (mirrors the approver-edit merge)
 *      and record them in request_modifications so the timeline reflects them.
 *   3. Hand off to ApprovalEngine.resubmitRequest, which snapshots the
 *      rejection history, versions the reference (<base>-R{n}), rebuilds the
 *      approval steps, returns the request to `pending`, and re-notifies the
 *      approver(s).
 *   4. Record a `resubmission` modification (timeline) and a
 *      `request.resubmitted` audit event — separate from the original
 *      submission, so the audit log carries both with their own timestamps.
 */

const FieldChangeSchema = z.object({
  fieldName: z.string().min(1).max(255),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
});

const ResubmitSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(20000).optional().nullable(),
    fieldChanges: z.array(FieldChangeSchema).max(200).optional(),
    approvers: z.array(z.string().uuid()).max(50).optional(),
  })
  .strip();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    const parsed = validateBody(req, res, ResubmitSchema);
    if (!parsed) return;

    // --- Load + authorize ---------------------------------------------
    const { data: request, error: loadError } = await supabaseAdmin
      .from('requests')
      .select('id, creator_id, title, description, status, metadata, request_steps(status)')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (loadError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the requester can resubmit this request' });
    }

    const steps = (request.request_steps as any[]) || [];
    const isRejected =
      request.status === 'rejected' || steps.some((s) => s.status === 'rejected');
    if (!isRejected) {
      return res.status(400).json({ error: 'Only rejected requests can be resubmitted' });
    }

    // --- Merge field edits into metadata (mirror approver-edit) -------
    const updatedMetadata: Record<string, any> = { ...(request.metadata || {}) };
    const fieldModifications: any[] = [];
    const formTypes = ['capex', 'leave', 'travel', 'expense', 'approval'];

    for (const change of parsed.fieldChanges || []) {
      const { fieldName, oldValue, newValue } = change;
      if (!fieldName) continue;
      // Only record genuine changes.
      if (String(newValue ?? '') === String(oldValue ?? '')) continue;

      let found = false;
      for (const ft of formTypes) {
        if (updatedMetadata[ft] && typeof updatedMetadata[ft] === 'object') {
          updatedMetadata[ft] = { ...updatedMetadata[ft], [fieldName]: newValue };
          found = true;
          break;
        }
      }
      if (!found) {
        updatedMetadata[fieldName] = newValue;
      }

      fieldModifications.push({
        request_id: id,
        modified_by: userId,
        modification_type: 'field_edit',
        field_name: fieldName,
        old_value: oldValue !== undefined && oldValue !== null ? String(oldValue) : null,
        new_value: newValue !== undefined && newValue !== null ? String(newValue) : null,
      });
    }

    // Allow the requester to adjust the approver chain on resubmission.
    if (Array.isArray(parsed.approvers) && parsed.approvers.length > 0) {
      updatedMetadata.approvers = parsed.approvers;
    }

    // Persist metadata + title/description edits BEFORE the engine resets the
    // workflow, so the engine picks up the edited approvers and merges its
    // versioning into the same metadata object.
    const updates: any = {
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    };
    if (parsed.title !== undefined) updates.title = parsed.title;
    if (parsed.description !== undefined) updates.description = parsed.description;

    const { error: updateError } = await supabaseAdmin
      .from('requests')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (updateError) {
      console.error('Failed to persist resubmission edits:', updateError);
      return res.status(500).json({ error: 'Failed to save your changes' });
    }

    if (fieldModifications.length > 0) {
      const { error: modErr } = await supabaseAdmin
        .from('request_modifications')
        .insert(fieldModifications);
      if (modErr) {
        // Non-fatal: the edits are already persisted, history is best-effort.
        console.error('Failed to record field modifications on resubmit:', modErr);
      }
    }

    // --- Reset the workflow + version the reference -------------------
    // The engine records the `resubmission` modification + CAPEX tracker reset.
    const result = await ApprovalEngine.resubmitRequest(id, userId);

    await audit(req, session.user, {
      category: 'workflow',
      action: 'request.resubmitted',
      severity: 'notice',
      outcome: result.success ? 'success' : 'failure',
      targetType: 'request',
      targetId: id,
      requestId: id,
      targetLabel: result.newReference || request.title || null,
      details: result.success
        ? {
            newReference: result.newReference || null,
            previousReference: (request.metadata as any)?.referenceCode || null,
            version: result.version || null,
            fieldChanges: fieldModifications.length,
          }
        : { error: result.error },
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: 'Request resubmitted for approval',
      newReference: result.newReference || null,
      version: result.version || null,
    });
  } catch (error: any) {
    console.error('Resubmit request error:', error);
    return res.status(500).json({ error: error.message || 'Failed to resubmit request' });
  }
}
