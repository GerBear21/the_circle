import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AppLayout } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserHrimsProfile } from '@/hooks/useUserHrimsProfile';
import dynamic from 'next/dynamic';
import BiometricSetupModal from '@/components/approvals/BiometricSetupModal';
import {
  Pencil,
  SlidersHorizontal,
  Bell,
  ShieldCheck,
  PenLine,
  Fingerprint,
  Check,
} from 'lucide-react';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), {
  ssr: false,
  loading: () => <div className="h-40 bg-neutral-100 animate-pulse rounded-xl" />,
});

interface SettingsProps {
  initialSignatureUrl: string | null;
}

interface Preferences {
  landingPage: string;
  itemsPerPage: string;
  defaultPriority: string;
  density: string;
  emailNotifications: boolean;
  approvalReminders: boolean;
  weeklyDigest: boolean;
}

const DEFAULT_PREFS: Preferences = {
  landingPage: '/dashboard',
  itemsPerPage: '25',
  defaultPriority: 'normal',
  density: 'comfortable',
  emailNotifications: true,
  approvalReminders: true,
  weeklyDigest: false,
};

const PREFS_KEY = 'circle:preferences';

export const getServerSideProps: GetServerSideProps<SettingsProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session?.user) {
    return { redirect: { destination: '/', permanent: false } };
  }

  const user = session.user as any;
  const userId = user.id;
  let initialSignatureUrl: string | null = null;

  try {
    if (userId) {
      const { data } = supabaseAdmin.storage.from('signatures').getPublicUrl(`${userId}.png`);
      const res = await fetch(data.publicUrl, { method: 'HEAD' });
      if (res.ok) initialSignatureUrl = `${data.publicUrl}?t=${Date.now()}`;
    }
  } catch (e) {
    // No signature found
  }

  return { props: { initialSignatureUrl } };
};

// ---- Small building blocks ----

function SectionCard({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-3 mb-5">
        <span className="text-neutral-700 mt-0.5">
          <Icon className="w-5 h-5" strokeWidth={1.5} />
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <>{children}</>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const selectCls =
  'w-full h-11 px-3.5 bg-white border border-border rounded-xl text-sm text-text-primary focus:border-primary-300 focus:ring-2 focus:ring-primary-100 outline-none transition-all';

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-primary-500' : 'bg-neutral-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary font-medium text-right truncate capitalize">{value}</span>
    </div>
  );
}

export default function Settings({ initialSignatureUrl }: SettingsProps) {
  const { user, session, updateProfilePicture } = useCurrentUser();
  const { departmentName, businessUnitName, jobTitle: hrimsJobTitle } = useUserHrimsProfile();

  const [signatureUrl, setSignatureUrl] = useState<string | null>(initialSignatureUrl);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  const [biometricCredentials, setBiometricCredentials] = useState<any[]>([]);
  const [loadingBiometrics, setLoadingBiometrics] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);

  // Load preferences (stored locally per device)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const setPref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  // Load profile picture
  useEffect(() => {
    if (user?.id) {
      if (user.profile_picture_url) {
        const url = user.profile_picture_url;
        setProfilePhoto(url.includes('?') ? url : `${url}?t=${Date.now()}`);
      } else {
        fetchProfilePictureFromStorage(user.id);
      }
    }
  }, [user]);

  const fetchProfilePictureFromStorage = async (userId: string) => {
    try {
      for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
        const { data } = supabaseAdmin.storage.from('profile_pictures').getPublicUrl(`${userId}.${ext}`);
        try {
          const res = await fetch(data.publicUrl, { method: 'HEAD' });
          if (res.ok) { setProfilePhoto(`${data.publicUrl}?t=${Date.now()}`); return; }
        } catch {}
      }
    } catch (err) {
      console.error('Error fetching profile picture from storage', err);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    if (file.size > 4 * 1024 * 1024) { alert('Image size must be less than 4MB'); return; }

    setUploadingPicture(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const res = await fetch('/api/user/profile-picture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });
        const data = await res.json();
        if (data.url) {
          const urlWithCache = `${data.url}?t=${Date.now()}`;
          setProfilePhoto(urlWithCache);
          updateProfilePicture(urlWithCache);
        } else {
          alert('Failed to upload profile picture');
        }
      } catch (err) {
        console.error('Upload error', err);
        alert('Failed to upload profile picture');
      } finally {
        setUploadingPicture(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
  };

  const fetchBiometricCredentials = async () => {
    setLoadingBiometrics(true);
    try {
      const res = await fetch('/api/webauthn/credentials');
      if (res.ok) {
        const data = await res.json();
        setBiometricCredentials(data.credentials || []);
      }
    } catch (err) {
      console.error('Failed to load biometric credentials:', err);
    } finally {
      setLoadingBiometrics(false);
    }
  };

  useEffect(() => { fetchBiometricCredentials(); }, []);

  const handleDeleteCredential = async (id: string) => {
    if (!confirm('Remove this device? You will need to re-register it to use biometric verification.')) return;
    try {
      const res = await fetch(`/api/webauthn/credentials/${id}`, { method: 'DELETE' });
      if (res.ok) setBiometricCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete credential:', err);
    }
  };

  const displayName = user?.display_name || session?.user?.name || 'User';
  const email = user?.email || session?.user?.email || '—';

  return (
    <>
      <Head>
        <title>My Settings - The Circle</title>
      </Head>

      <AppLayout title="My Settings">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto">
          {/* Page header with save action */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">My Settings</h1>
              <p className="text-text-secondary mt-1.5 text-sm sm:text-base">
                Configure how the system works for you. Personal details are managed in HRIMS.
              </p>
            </div>
            <Button variant="primary" onClick={handleSave} className="shrink-0 flex items-center gap-2">
              {saved ? <Check className="w-4 h-4" strokeWidth={2} /> : null}
              {saved ? 'Saved' : 'Save Changes'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: configurable preferences */}
            <div className="lg:col-span-2 space-y-6">
              <SectionCard icon={SlidersHorizontal} title="Preferences" subtitle="Tune the interface and defaults to suit how you work.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field label="Default landing page">
                    <select className={selectCls} value={prefs.landingPage} onChange={(e) => setPref('landingPage', e.target.value)}>
                      <option value="/dashboard">Dashboard</option>
                      <option value="/requests/my-requests">Track Requests</option>
                      <option value="/requests/drafts">My Drafts</option>
                      <option value="/approvals">My Approval Tasks</option>
                      <option value="/notifications">Notifications</option>
                    </select>
                  </Field>
                  <Field label="Default request priority">
                    <select className={selectCls} value={prefs.defaultPriority} onChange={(e) => setPref('defaultPriority', e.target.value)}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </Field>
                  <Field label="Items per page">
                    <select className={selectCls} value={prefs.itemsPerPage} onChange={(e) => setPref('itemsPerPage', e.target.value)}>
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                    </select>
                  </Field>
                  <Field label="List density">
                    <select className={selectCls} value={prefs.density} onChange={(e) => setPref('density', e.target.value)}>
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </Field>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 border border-border px-3.5 py-3">
                  <span className="text-sm text-text-secondary">Date format</span>
                  <span className="text-sm font-medium text-text-primary">DD/MM/YYYY</span>
                </div>
              </SectionCard>

              <SectionCard icon={Bell} title="Notifications" subtitle="Choose what you want to be notified about.">
                <div className="divide-y divide-border">
                  <Toggle
                    checked={prefs.emailNotifications}
                    onChange={(v) => setPref('emailNotifications', v)}
                    label="Email notifications"
                    description="Receive updates about your requests and approvals by email."
                  />
                  <Toggle
                    checked={prefs.approvalReminders}
                    onChange={(v) => setPref('approvalReminders', v)}
                    label="Approval reminders"
                    description="Get nudged when an approval task is waiting on you."
                  />
                  <Toggle
                    checked={prefs.weeklyDigest}
                    onChange={(v) => setPref('weeklyDigest', v)}
                    label="Weekly summary digest"
                    description="A weekly recap of your activity across the workspace."
                  />
                </div>
              </SectionCard>

              <SectionCard icon={PenLine} title="Digital signature" subtitle="Used to authorise your requests and approvals.">
                <SignaturePad initialUrl={signatureUrl || undefined} onSave={(url) => setSignatureUrl(url)} />
              </SectionCard>

              <SectionCard icon={ShieldCheck} title="Security" subtitle="Manage biometric verification for high-risk approvals.">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-text-secondary">Use Windows Hello, Touch ID, or Face ID to verify sensitive approvals.</p>
                  <Button variant="outline" onClick={() => setShowBiometricSetup(true)} className="shrink-0">Register device</Button>
                </div>

                {loadingBiometrics ? (
                  <div className="text-sm text-text-secondary py-4 text-center">Loading devices…</div>
                ) : biometricCredentials.length === 0 ? (
                  <div className="p-4 bg-neutral-50 rounded-xl border border-border text-center">
                    <p className="text-sm text-text-secondary">No biometric devices registered yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {biometricCredentials.map((cred: any) => (
                      <div key={cred.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-border">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-neutral-700 shrink-0">
                            <Fingerprint className="w-5 h-5" strokeWidth={1.5} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{cred.device_name || 'Biometric Device'}</p>
                            <p className="text-xs text-text-secondary">
                              Added {new Date(cred.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              {cred.last_used_at ? ` • Last used ${new Date(cred.last_used_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteCredential(cred.id)} className="text-sm text-danger hover:text-danger-600 font-medium shrink-0">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            {/* Right: profile photo + HRIMS identity (read-only) */}
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-base font-semibold text-text-primary mb-5">Profile photo</h2>
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 text-3xl font-bold overflow-hidden ring-1 ring-border">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span>{displayName.charAt(0)}</span>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPicture}
                      className="absolute bottom-0 right-0 bg-primary-500 text-white rounded-full p-2 shadow-sm hover:bg-primary-600 transition-colors"
                      aria-label="Change photo"
                    >
                      {uploadingPicture ? (
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Pencil className="w-4 h-4" strokeWidth={1.5} />
                      )}
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  </div>
                  <p className="mt-4 font-semibold text-text-primary">{displayName}</p>
                  <p className="text-sm text-text-secondary">{email}</p>
                  <p className="mt-1 text-xs text-text-muted">{uploadingPicture ? 'Uploading…' : 'JPG or PNG, up to 4MB'}</p>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-text-primary">Identity</h2>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-neutral-100 px-2 py-0.5 rounded-full">From HRIMS</span>
                </div>
                <div className="space-y-0">
                  <ReadOnlyRow label="Full name" value={displayName} />
                  <ReadOnlyRow label="Job title" value={hrimsJobTitle || user?.job_title || 'User'} />
                  <ReadOnlyRow label="Department" value={departmentName || 'Not assigned'} />
                  <ReadOnlyRow label="Business unit" value={businessUnitName || 'Not assigned'} />
                  <ReadOnlyRow label="Email" value={email} />
                </div>
                <p className="mt-3 text-xs text-text-muted">Personal details are sourced from HRIMS and can't be edited here.</p>
              </Card>
            </div>
          </div>
        </div>

        <BiometricSetupModal
          isOpen={showBiometricSetup}
          onClose={() => setShowBiometricSetup(false)}
          onSuccess={() => {
            setShowBiometricSetup(false);
            fetchBiometricCredentials();
          }}
        />
      </AppLayout>
    </>
  );
}
