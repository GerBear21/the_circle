/**
 * Per-user notification + auto-archiving preferences (user_preferences table).
 *
 * Read/written only through the service role. Every reader falls back to the
 * defaults below when the row (or even the table) is missing, so preference
 * checks can never break a workflow action.
 */

import { supabaseAdmin } from './supabaseAdmin';

export interface UserPreferences {
  /** Email me when my request is approved/rejected at a review step. */
  emailRequestUpdates: boolean;
  /** Email me when a request is waiting on my approval. */
  emailApprovalTasks: boolean;
  /** Email me the signed PDF when my request completes review. */
  emailCompletionPdf: boolean;
  /** Remind me by email while an approval task sits pending with me. */
  approvalReminders: boolean;
  /** Weekly summary of my activity. */
  weeklyDigest: boolean;
  /** Auto-save my approved PDFs into my OneDrive. */
  autoArchiveOneDrive: boolean;
  /** Custom OneDrive folder name (null = deployment default). */
  oneDriveFolder: string | null;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  emailRequestUpdates: true,
  emailApprovalTasks: true,
  emailCompletionPdf: true,
  approvalReminders: true,
  weeklyDigest: false,
  autoArchiveOneDrive: true,
  oneDriveFolder: null,
};

function rowToPrefs(row: any): UserPreferences {
  if (!row) return { ...DEFAULT_USER_PREFERENCES };
  return {
    emailRequestUpdates: row.email_request_updates ?? true,
    emailApprovalTasks: row.email_approval_tasks ?? true,
    emailCompletionPdf: row.email_completion_pdf ?? true,
    approvalReminders: row.approval_reminders ?? true,
    weeklyDigest: row.weekly_digest ?? false,
    autoArchiveOneDrive: row.auto_archive_onedrive ?? true,
    oneDriveFolder: row.onedrive_folder || null,
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('userPreferences: read failed, using defaults:', error.message);
      return { ...DEFAULT_USER_PREFERENCES };
    }
    return rowToPrefs(data);
  } catch (e) {
    console.warn('userPreferences: read threw, using defaults:', e);
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

/** Batch variant for cron jobs — returns defaults for users without a row. */
export async function getPreferencesForUsers(userIds: string[]): Promise<Map<string, UserPreferences>> {
  const map = new Map<string, UserPreferences>();
  for (const id of userIds) map.set(id, { ...DEFAULT_USER_PREFERENCES });
  if (userIds.length === 0) return map;
  try {
    const { data } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .in('user_id', userIds);
    for (const row of data || []) map.set(row.user_id, rowToPrefs(row));
  } catch (e) {
    console.warn('userPreferences: batch read failed, using defaults:', e);
  }
  return map;
}

export async function saveUserPreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<{ success: boolean; error?: string }> {
  const row: Record<string, any> = { user_id: userId, updated_at: new Date().toISOString() };
  if (prefs.emailRequestUpdates !== undefined) row.email_request_updates = !!prefs.emailRequestUpdates;
  if (prefs.emailApprovalTasks !== undefined) row.email_approval_tasks = !!prefs.emailApprovalTasks;
  if (prefs.emailCompletionPdf !== undefined) row.email_completion_pdf = !!prefs.emailCompletionPdf;
  if (prefs.approvalReminders !== undefined) row.approval_reminders = !!prefs.approvalReminders;
  if (prefs.weeklyDigest !== undefined) row.weekly_digest = !!prefs.weeklyDigest;
  if (prefs.autoArchiveOneDrive !== undefined) row.auto_archive_onedrive = !!prefs.autoArchiveOneDrive;
  if (prefs.oneDriveFolder !== undefined) {
    const folder = (prefs.oneDriveFolder || '').trim();
    row.onedrive_folder = folder ? folder.slice(0, 120) : null;
  }

  const { error } = await supabaseAdmin
    .from('user_preferences')
    .upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.error('userPreferences: save failed:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
