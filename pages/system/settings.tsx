import { useState } from 'react';
import Head from 'next/head';
import { AppLayout } from '@/components/layout';
import { Card, Input, Button } from '@/components/ui';
import { SettingsIllustration } from '@/components/illustrations/SettingsIllustration';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('general');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = () => {
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            alert('Settings saved successfully!');
        }, 1500);
    };

    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'security', label: 'Security' },
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
                                    Manage your application preferences, security configurations, and integration settings.
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
                            {activeTab === 'general' && (
                                <Card className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">General Settings</h2>
                                        <p className="text-sm text-gray-500 mt-1">Configure basic site information.</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6">
                                        <Input label="Site Name" defaultValue="The Circle" />
                                        <Input label="Support Email" type="email" defaultValue="support@thecircle.app" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                                                <select className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                                                    <option>English (US)</option>
                                                    <option>Spanish</option>
                                                    <option>French</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                                                <select className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                                                    <option>UTC</option>
                                                    <option>EST</option>
                                                    <option>PST</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {activeTab === 'security' && (
                                <Card className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Security Settings</h2>
                                        <p className="text-sm text-gray-500 mt-1">Manage password policies and access controls.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                                            <div>
                                                <h3 className="font-medium text-gray-900">Two-Factor Authentication</h3>
                                                <p className="text-sm text-gray-500">Enforce 2FA for all admin users.</p>
                                            </div>
                                            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                                <input type="checkbox" name="toggle" id="toggle-2fa" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" />
                                                <label htmlFor="toggle-2fa" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                                            </div>
                                        </div>

                                        <Input label="Password Expiry (days)" type="number" defaultValue="90" />
                                        <Input label="Session Timeout (minutes)" type="number" defaultValue="30" />
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
