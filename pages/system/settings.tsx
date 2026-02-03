import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { AppLayout } from '@/components/layout';
import { Card, Button } from '@/components/ui';
import { SettingsIllustration } from '@/components/illustrations/SettingsIllustration';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import dynamic from 'next/dynamic';

const SignaturePad = dynamic(() => import('@/components/SignaturePad'), {
  ssr: false,
  loading: () => <div className="h-40 bg-gray-50 animate-pulse rounded-xl" />
});

export default function Settings() {
    const { user, session, loading: userLoading, updateProfilePicture } = useCurrentUser();
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
    const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load signature and profile picture when user data is available
    useEffect(() => {
        if (user?.id && isSupabaseConfigured) {
            // Fetch signature from storage
            const { data } = supabase.storage.from('signatures').getPublicUrl(`${user.id}.png`);
            checkSignature(data.publicUrl);

            // Set profile picture from user data
            if (user.profile_picture_url) {
                const url = user.profile_picture_url;
                setProfilePhoto(url.includes('?') ? url : `${url}?t=${Date.now()}`);
            } else {
                fetchProfilePictureFromStorage(user.id);
            }
        }
    }, [user]);

    const checkSignature = async (url: string) => {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok) {
                setSignatureUrl(`${url}?t=${Date.now()}`);
            }
        } catch (e) {
            // No signature found
        }
    };

    const fetchProfilePictureFromStorage = async (userId: string) => {
        if (!isSupabaseConfigured) return;
        try {
            const extensions = ['png', 'jpg', 'jpeg', 'webp'];
            for (const ext of extensions) {
                const { data } = supabase.storage.from('profile_pictures').getPublicUrl(`${userId}.${ext}`);
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

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'notifications', label: 'Notifications' },
        { id: 'appearance', label: 'Appearance' },
        { id: 'integrations', label: 'Integrations' },
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 capitalize">
                                                {user?.role || 'User'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                                {user?.department?.name || 'Not assigned'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Business Unit</label>
                                            <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                                {user?.business_unit?.name || 'Not assigned'}
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

                            {activeTab === 'notifications' && (
                                <Card className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
                                        <p className="text-sm text-gray-500 mt-1">Choose what you want to be notified about.</p>
                                    </div>
                                    <div className="space-y-4">
                                        {['New User Registration', 'System Updates', 'Security Alerts', 'Weekly Reports'].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <input type="checkbox" id={`notif-${i}`} className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-gray-300" defaultChecked />
                                                <label htmlFor={`notif-${i}`} className="text-gray-700 font-medium">{item}</label>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'appearance' && (
                                <Card className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Appearance</h2>
                                        <p className="text-sm text-gray-500 mt-1">Customize the look and feel of the application.</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="border-2 border-brand-500 rounded-xl p-4 bg-white cursor-pointer hover:shadow-md transition-all">
                                            <div className="h-20 bg-gray-100 rounded-lg mb-3 border border-gray-200"></div>
                                            <p className="font-medium text-center text-brand-600">Light</p>
                                        </div>
                                        <div className="border border-gray-200 rounded-xl p-4 bg-gray-900 cursor-pointer hover:shadow-md transition-all opacity-60 hover:opacity-100">
                                            <div className="h-20 bg-gray-800 rounded-lg mb-3 border border-gray-700"></div>
                                            <p className="font-medium text-center text-white">Dark</p>
                                        </div>
                                        <div className="border border-gray-200 rounded-xl p-4 bg-white cursor-pointer hover:shadow-md transition-all opacity-60 hover:opacity-100">
                                            <div className="h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg mb-3 border border-gray-200"></div>
                                            <p className="font-medium text-center text-gray-700">System</p>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'integrations' && (
                                <Card className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Integrations</h2>
                                        <p className="text-sm text-gray-500 mt-1">Manage external services and API keys.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold">S</div>
                                                <div>
                                                    <h3 className="font-medium text-gray-900">Stripe</h3>
                                                    <p className="text-xs text-gray-500">Payment processing</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm">Configure</Button>
                                        </div>
                                        <div className="p-4 border border-gray-200 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold">S</div>
                                                <div>
                                                    <h3 className="font-medium text-gray-900">Slack</h3>
                                                    <p className="text-xs text-gray-500">Team communication</p>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm">Connect</Button>
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
