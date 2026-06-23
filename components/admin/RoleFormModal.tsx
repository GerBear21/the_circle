import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input } from '../ui';
import { useToast } from '../ui/ToastProvider';

interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
}

interface RoleLike {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  is_system: boolean;
  permissions: Permission[];
}

interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Provide a role to edit; omit to create. For "duplicate", pass a role with no id. */
  role?: RoleLike | null;
  permissions: Permission[];
  onCreate: (payload: { name: string; slug: string; description?: string; color?: string; permissions?: string[] }) => Promise<any>;
  onUpdate: (payload: { id: string; name?: string; description?: string; color?: string; permissions?: string[] }) => Promise<any>;
  onSaved?: () => void;
}

const COLORS = ['gray', 'blue', 'green', 'purple', 'teal', 'orange', 'indigo', 'red', 'pink', 'cyan'];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function RoleFormModal({
  isOpen,
  onClose,
  role,
  permissions,
  onCreate,
  onUpdate,
  onSaved,
}: RoleFormModalProps) {
  const { addToast } = useToast();
  const isEdit = !!role?.id;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('gray');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Hydrate from the role being edited/duplicated whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setName(role?.name || '');
    setSlug(role?.slug || '');
    setSlugTouched(!!role?.slug);
    setDescription(role?.description || '');
    setColor(role?.color || 'gray');
    setSelected(new Set((role?.permissions || []).map((p) => p.code)));
  }, [isOpen, role]);

  // Auto-derive slug from name until the user edits it manually (create only).
  useEffect(() => {
    if (!isEdit && !slugTouched) setSlug(slugify(name));
  }, [name, slugTouched, isEdit]);

  const grouped = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    for (const p of permissions) {
      (g[p.category] ||= []).push(p);
    }
    return g;
  }, [permissions]);

  const togglePermission = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const toggleCategory = (cat: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of grouped[cat] || []) on ? next.add(p.code) : next.delete(p.code);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      addToast({ type: 'error', message: 'Role name is required' });
      return;
    }
    if (!isEdit && !slug.trim()) {
      addToast({ type: 'error', message: 'Slug is required' });
      return;
    }
    setSaving(true);
    try {
      const perms = Array.from(selected);
      if (isEdit && role) {
        await onUpdate({ id: role.id, name, description, color, permissions: perms });
        addToast({ type: 'success', message: `Role "${name}" updated` });
      } else {
        await onCreate({ name, slug, description, color, permissions: perms });
        addToast({ type: 'success', message: `Role "${name}" created` });
      }
      onSaved?.();
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to save role' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Role' : 'Create Role'} size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Input label="Role name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finance Reviewer" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <Input
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
            placeholder="finance_reviewer"
            disabled={isEdit}
          />
          {isEdit && <p className="mt-1 text-xs text-gray-400">The slug cannot be changed after creation.</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What is this role for?"
            className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`px-3 py-1 rounded-lg text-xs capitalize border transition-colors ${
                  color === c ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Permissions</label>
            <span className="text-xs text-gray-400">{selected.size} selected</span>
          </div>
          <div className="space-y-3">
            {Object.entries(grouped).map(([cat, perms]) => {
              const allOn = perms.every((p) => selected.has(p.code));
              return (
                <div key={cat} className="border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-800">{titleCase(cat)}</h4>
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat, !allOn)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {allOn ? 'Clear all' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(p.code)}
                          onChange={() => togglePermission(p.code)}
                          className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-gray-700" title={p.description || ''}>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create role'}
        </Button>
      </div>
    </Modal>
  );
}
