import { useEffect, useState } from 'react';
import { Modal, Button, Input } from '../ui';
import { useToast } from '../ui/ToastProvider';

interface RoleLite {
  id: string;
  name: string;
}

interface DemoAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: RoleLite[];
  onCreated?: () => void;
}

interface Dept { id: string; name: string }
interface Pos { id: string; position_title: string; employee?: { first_name?: string; last_name?: string } | null }

interface CreatedResult {
  email: string;
  password: string;
  displayName: string;
  positionTitle: string;
}

const DEFAULT_PASSWORD = 'Demo@2026!';

export default function DemoAccountModal({ isOpen, onClose, roles, onCreated }: DemoAccountModalProps) {
  const { addToast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [parentPositionId, setParentPositionId] = useState('');
  const [appRoleId, setAppRoleId] = useState('');

  const [departments, setDepartments] = useState<Dept[]>([]);
  const [positions, setPositions] = useState<Pos[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreatedResult | null>(null);

  const reset = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPassword(DEFAULT_PASSWORD);
    setJobTitle(''); setDepartmentId(''); setParentPositionId(''); setAppRoleId('');
    setResult(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    reset();
    Promise.all([
      fetch('/api/hrims/departments').then((r) => r.json()).catch(() => ({ departments: [] })),
      fetch('/api/hrims/organogram').then((r) => r.json()).catch(() => ({ positions: [] })),
    ]).then(([d, p]) => {
      setDepartments(d.departments || []);
      setPositions(p.positions || []);
    });
  }, [isOpen]);

  const derivedEmail = `${(firstName.trim()[0] || '').toLowerCase()}${lastName.trim().toLowerCase().replace(/[^a-z0-9.]/g, '')}@rtg.demo`;

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim() || !jobTitle.trim()) {
      addToast({ type: 'error', message: 'First name, last name and position title are required' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/demo/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          password: password || undefined,
          jobTitle: jobTitle.trim(),
          departmentId: departmentId || undefined,
          parentPositionId: parentPositionId || undefined,
          appRoleId: appRoleId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create demo account');
      setResult({ email: data.email, password: data.password, displayName: data.displayName, positionTitle: data.positionTitle });
      addToast({ type: 'success', message: `Demo account created for ${data.displayName}` });
      onCreated?.();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add demo account" size="lg">
      {result ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {result.displayName} is ready to sign in
            </div>
            <dl className="text-sm text-gray-700 space-y-1">
              <div className="flex gap-2"><dt className="w-24 text-gray-500">Email</dt><dd className="font-mono">{result.email}</dd></div>
              <div className="flex gap-2"><dt className="w-24 text-gray-500">Password</dt><dd className="font-mono">{result.password}</dd></div>
              <div className="flex gap-2"><dt className="w-24 text-gray-500">Position</dt><dd>{result.positionTitle}</dd></div>
            </dl>
            <p className="text-xs text-green-700 mt-3">
              They can sign in on the landing page via the &quot;Demo access&quot; form. Their position auto-detects on the CAPEX form.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={reset}>Add another</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Anesu" />
            <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Moyo" />
          </div>

          <div>
            <Input
              label="Login email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={firstName || lastName ? derivedEmail : 'auto-generated from name'}
            />
            <p className="mt-1 text-xs text-gray-400">Leave blank to auto-generate a short @rtg.demo address.</p>
          </div>

          <Input label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <Input label="Position / job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Internal Auditor" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— None —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reports to (position)</label>
              <select
                value={parentPositionId}
                onChange={(e) => setParentPositionId(e.target.value)}
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— Top of chart —</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.position_title}
                    {p.employee?.first_name ? ` — ${p.employee.first_name} ${p.employee.last_name || ''}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">App role (optional)</label>
            <select
              value={appRoleId}
              onChange={(e) => setAppRoleId(e.target.value)}
              className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— No special role (requester) —</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create demo account'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
