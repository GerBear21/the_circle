import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AppLayout } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { SettingsIllustration } from '@/components/illustrations/SettingsIllustration';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserHrimsProfile } from '@/hooks/useUserHrimsProfile';
import dynamic from 'next/dynamic';
import BiometricSetupModal from '@/components/approvals/BiometricSetupModal';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), {
  ssr: false,
  loading: () => <div className="h-40 bg-gray-50 animate-pulse rounded-xl" />
});

interface SettingsProps {
  initialSignatureUrl: string | null;
}

export const getServerSideProps: GetServerSideProps<SettingsProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const user = session.user as any;
  const userId = user.id;
  let initialSignatureUrl: string | null = null;

  try {
    if (userId) {
      const { data } = supabaseAdmin.storage.from('signatures').getPublicUrl(`${userId}.png`);
      // Check if signature exists by making a HEAD request
      const res = await fetch(data.publicUrl, { method: 'HEAD' });
      if (res.ok) {
        initialSignatureUrl = `${data.publicUrl}?t=${Date.now()}`;
      }
    }
  } catch (e) {
    // No signature found or error fetching
  }

  return {
    props: {
      initialSignatureUrl,
    },
  };
};

export default function Settings({ initialSignatureUrl }: SettingsProps) {
    const { user, session, loading: userLoading, updateProfilePicture } = useCurrentUser();
    const { departmentName, businessUnitName, jobTitle: hrimsJobTitle } = useUserHrimsProfile();
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [signatureUrl, setSignatureUrl] = useState<string | null>(initialSignatureUrl);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Biometric credentials state
    const [biometricCredentials, setBiometricCredentials] = useState<any[]>([]);
    const [loadingBiometrics, setLoadingBiometrics] = useState(false);
    const [showBiometricSetup, setShowBiometricSetup] = useState(false);

    // Load profile picture when user data is available
    useEffect(() => {
        if (user?.id) {
            // Set profile picture from user data
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
            const extensions = ['png', 'jpg', 'jpeg', 'webp'];
            for (const ext of extensions) {
                const { data } = supabaseAdmin.storage.from('profile_pictures').getPublicUrl(`${userId}.${ext}`);
                try {
                    const res = await fetch(data.publicUrl, { method: 'HEAD' });
                    if (res.ok) {
                        setProfilePhoto(`${data.publicUrl}?t=${Date.now()}`);
                        return;
                    }
                } catch (e) {
                    // Continue to next extension
                }
            }
        } catch (err) {
            console.error("Error fetching profile picture from storage", err);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 4 * 1024 * 1024) {
            alert('Image size must be less than 4MB');
            return;
        }

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
                    // Update the global user context so header/sidebar update immediately
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
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            alert('Settings saved successfully!');
        }, 1500);
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

    // Load biometric credentials when security tab is active
    useEffect(() => {
        if (activeTab === 'security') {
            fetchBiometricCredentials();
        }
    }, [activeTab]);

    const handleDeleteCredential = async (id: string) => {
        if (!confirm('Remove this device? You will need to re-register it to use biometric verification.')) return;
        try {
            const res = await fetch(`/api/webauthn/credentials/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setBiometricCredentials(prev => prev.filter(c => c.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete credential:', err);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'security', label: 'Security' }
    ];

    return (
        <>
            <Head>
                <title>System Settings - The Circle</title>
            </Head>

            <AppLayout title="System Settings">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                    {/* Header Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900 font-heading">System Settings</h1>
                                <p className="text-gray-500 mt-2 text-lg">
                                    Manage your profile information, preferences, and integration settings.
                                </p>
                            </div>
                        </div>
                        <div className="hidden md:flex md:col-span-1 justify-center items-center">
                            <div className="w-full max-w-[280px]">
                                <SettingsIllustration />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Sidebar Navigation */}
                        <div className="w-full lg:w-64 flex-shrink-0">
                            <Card className="p-2 sticky top-6">
                                <nav className="space-y-1">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all ${activeTab === tab.id
                                                ? 'bg-brand-50 text-brand-700 shadow-sm'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </nav>
                            </Card>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 space-y-6">
                            {activeTab === 'profile' && (
                                <Card className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Profile Settings</h2>
                                        <p className="text-sm text-gray-500 mt-1">Manage your personal information and preferences.</p>
                                    </div>

                                    {/* Profile Photo Section */}
                                    <div className="flex items-center gap-6 pb-6 border-b border-gray-100">
                                        <div className="relative group">
                                            <div className="w-24 h-24 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 text-3xl font-bold overflow-hidden border-4 border-white shadow-md">
                                                {profilePhoto ? (
                                                    <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{user?.display_name?.charAt(0) || user?.email?.charAt(0) || 'U'}</span>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={uploadingPicture}
                                                className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                                            >
                                                {uploadingPicture ? (
                                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                                                ) : (
                                                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <input 
                                                ref={fileInputRef}
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={handlePhotoUpload} 
                                            />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">Profile Photo</h3>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {uploadingPicture ? 'Uploading...' : 'Click the camera icon to update.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* User Information - Read Only */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                            <p className="text-gray-900 font-medium bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                                {user?.display_name || session?.user?.name || 'Not set'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 capitalize">
                                                {hrimsJobTitle || user?.job_title || 'User'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                                {departmentName || 'Not assigned'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Business Unit</label>
                                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                                {businessUnitName || 'Not assigned'}
                                            </p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                                {user?.email || session?.user?.email || 'Not set'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Signature Section */}
                                    <div className="pt-6 border-t border-gray-100">
                                        <h3 className="font-medium text-gray-900 mb-2">Digital Signature</h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Draw your signature, upload an image, or sign from your mobile device.
                                        </p>
                                        <SignaturePad
                                            initialUrl={signatureUrl || undefined}
                                            onSave={(url) => setSignatureUrl(url)}
                                        />
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'security' && (
                                <Card className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Security Settings</h2>
                                        <p className="text-sm text-gray-500 mt-1">Manage biometric verification devices for high-risk approvals.</p>
                                    </div>

                                    {/* Biometric Credentials */}
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="font-medium text-gray-900">Biometric Devices</h3>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    Use Windows Hello, Touch ID, or Face ID for secure approval verification.
                                                </p>
                                            </div>
                                            <Button variant="outline" onClick={() => setShowBiometricSetup(true)}>
                                                Register device
                                            </Button>
                                        </div>

                                        {loadingBiometrics ? (
                                            <div className="text-sm text-gray-500 py-4 text-center">Loading devices...</div>
                                        ) : biometricCredentials.length === 0 ? (
                                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                                                <p className="text-sm text-gray-500">No biometric devices registered yet.</p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    You can register a device now or during your first high-risk approval.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {biometricCredentials.map((cred: any) => (
                                                    <div key={cred.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                                                <svg className="w-5 h-5 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.1.9-2 2-2s2 .9 2 2m-8 0c0-3.3 2.7-6 6-6s6 2.7 6 6v1c0 5-4 9-6 10-2-1-6-5-6-10v-1z" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium text-gray-900">{cred.device_name || 'Biometric Device'}</p>
                                                                <p className="text-xs text-gray-500">
                                                                    Added {new Date(cred.created_at).toLocaleDateString()}
                                                                    {cred.last_used_at ? ` • Last used ${new Date(cred.last_used_at).toLocaleDateString()}` : ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteCredential(cred.id)}
                                                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Authentication info */}
                                    <div className="pt-4 border-t border-gray-100">
                                        <h3 className="font-medium text-gray-900 mb-2">How verification works</h3>
                                        <div className="space-y-2 text-sm text-gray-600">
                                            <div className="flex items-start gap-2">
                                                <span className="inline-block w-2 h-2 mt-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                                <span><strong>Low risk:</strong> Standard session verification (one-click confirmation).</span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="inline-block w-2 h-2 mt-1.5 rounded-full bg-blue-400 shrink-0"></span>
                                                <span><strong>Medium risk:</strong> Microsoft re-authentication with MFA.</span>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <span className="inline-block w-2 h-2 mt-1.5 rounded-full bg-amber-400 shrink-0"></span>
                                                <span><strong>High risk:</strong> Biometric verification (Windows Hello, Touch ID, Face ID).</span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            
                            

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSave} isLoading={isLoading} className="w-full sm:w-auto">
                                    Save Changes
                                </Button>
                            </div>
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
            <style>{`
                .toggle-checkbox:checked {
                    right: 0;
                    border-color: #3B82F6;
                }
                .toggle-checkbox:checked + .toggle-label {
                    background-color: #3B82F6;
                }
                .toggle-checkbox {
                    right: 0;
                    z-index: 1;
                    border-color: #D1D5DB;
                    transition: all 0.3s;
                }
                .toggle-label {
                    width: 3rem;
                    height: 1.5rem;
                }
            `}</style>
        </>
    );
}
