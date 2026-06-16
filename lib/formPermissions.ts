import { supabaseAdmin } from './supabaseAdmin';

// ============================================================
// Dynamic per-form permissions
// ============================================================
// Every user-designed form template gets its own permission row
// (`form.access.<templateId>`, category 'custom_forms') the moment it is
// created. These show up automatically in the role editor and the per-user
// override editor, so admins can grant/deny individual forms to roles or
// individual users. Holding the permission grants access to a form even
// when its scope/audience wouldn't otherwise include the user.
// ============================================================

export function formPermissionCode(templateId: string): string {
  return `form.access.${templateId}`;
}

export async function ensureFormPermission(templateId: string, formName: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('permissions')
      .upsert(
        {
          code: formPermissionCode(templateId),
          name: `Access Form: ${String(formName).slice(0, 120)}`,
          description: `Use the "${String(formName).slice(0, 200)}" custom form`,
          category: 'custom_forms',
        },
        { onConflict: 'code' }
      );
    if (error) console.error('[formPermissions] ensure failed:', error, templateId);
  } catch (err) {
    console.error('[formPermissions] ensure threw:', err);
  }
}

export async function removeFormPermission(templateId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('permissions')
      .delete()
      .eq('code', formPermissionCode(templateId));
    if (error) console.error('[formPermissions] remove failed:', error, templateId);
  } catch (err) {
    console.error('[formPermissions] remove threw:', err);
  }
}
