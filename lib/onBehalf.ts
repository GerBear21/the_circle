import { supabaseAdmin } from './supabaseAdmin';
import { canFileOnBehalfOf } from './assistantAssignments';

/**
 * "File on behalf of" server-side guard.
 *
 * A user may submit a form naming another person as the beneficiary ONLY when a
 * systems admin has assigned them as that person's assistant
 * (`assistant_assignments`). The filer remains the filer of record; the
 * beneficiary is stored on `metadata.onBehalfOf`.
 *
 * The client sends `metadata.onBehalfOf`, but it is never trusted — this
 * re-derives the relationship from `assistant_assignments`.
 */

export interface OnBehalfOf {
  userId: string;
  name?: string;
  positionTitle?: string;
  email?: string;
}

export interface OnBehalfResult {
  ok: boolean;
  error?: string;
  /** Server-verified, normalised value to persist (undefined when none). */
  normalized?: OnBehalfOf;
}

/**
 * Validate an incoming `onBehalfOf` beneficiary. Returns `{ ok: true }` with no
 * `normalized` value when the request isn't on-behalf-of anyone.
 */
export async function assertValidOnBehalf(
  organizationId: string,
  filerUserId: string,
  onBehalfOf: any
): Promise<OnBehalfResult> {
  if (!onBehalfOf || typeof onBehalfOf !== 'object' || !onBehalfOf.userId) {
    return { ok: true };
  }

  const beneficiaryId: string = onBehalfOf.userId;

  if (beneficiaryId === filerUserId) {
    // Filing "on behalf of" yourself is meaningless — just drop it.
    return { ok: true };
  }

  const allowed = await canFileOnBehalfOf(filerUserId, beneficiaryId, organizationId);
  if (!allowed) {
    return {
      ok: false,
      error: 'You are not assigned as an assistant for this person, so you cannot file on their behalf.',
    };
  }

  // Re-derive the display fields from app_users rather than trusting the client.
  const { data: principal } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, email, job_title')
    .eq('id', beneficiaryId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!principal) {
    return { ok: false, error: 'That person was not found in your organization.' };
  }

  return {
    ok: true,
    normalized: {
      userId: principal.id,
      name: principal.display_name || principal.email,
      positionTitle: principal.job_title || undefined,
      email: principal.email,
    },
  };
}
