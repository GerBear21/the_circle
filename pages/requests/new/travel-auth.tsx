import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';

export default function TravelAuthPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        travelerName: '',
        destination: '',
        startDate: '',
        endDate: '',
        purpose: '',
        estimatedCost: '',
        modeOfTransport: 'Car',
        department: '',
    });

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
        // Pre-fill name if available
        if (session?.user?.name) {
            setFormData(prev => ({ ...prev, travelerName: session.user.name || '' }));
        }
    }, [status, router, session]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Simulate API submission
        setTimeout(() => {
            setLoading(false);
            router.push('/requests/all');
        }, 1000);
    };

    const formatCurrency = (value: string) => {
        const num = value.replace(/[^0-9.]/g, '');
        if (!num) return '';
        return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    if (status === 'loading') {
        return (
            <AppLayout title="Travel Authorization" showBack onBack={() => router.back()}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
            </AppLayout>
        );
    }

    if (!session) return null;

    return (
        <AppLayout title="Travel Authorization" showBack onBack={() => router.back()} hideNav>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto pb-28">
                <div className="mb-2">
                    <h1 className="text-xl font-bold text-text-primary font-heading">Local Travel Authorization</h1>
                    <p className="text-sm text-text-secondary mt-1">Request approval for local business travel</p>
                </div>

                <Card>
                    <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Traveler Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="Traveler Name"
                            placeholder="Full Name"
                            value={formData.travelerName}
                            onChange={(e) => setFormData({ ...formData, travelerName: e.target.value })}
                            required
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Department
                            </label>
                            <select
                                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                required
                            >
                                <option value="">Select Department</option>
                                <option value="Engineering">Engineering</option>
                                <option value="Sales">Sales</option>
                                <option value="Marketing">Marketing</option>
                                <option value="HR">HR</option>
                                <option value="Finance">Finance</option>
                                <option value="Operations">Operations</option>
                            </select>
                        </div>
                    </div>
                </Card>

                <Card>
                    <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Trip Details
                    </h3>
                    <div className="space-y-4">
                        <Input
                            label="Destination"
                            placeholder="City, State, or specific location"
                            value={formData.destination}
                            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                            required
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Purpose of Travel
                            </label>
                            <textarea
                                className="w-full px-4 py-3 min-h-[100px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                placeholder="Meeting client X, attending conference Y..."
                                value={formData.purpose}
                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Primary Mode of Transport
                                </label>
                                <select
                                    className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    value={formData.modeOfTransport}
                                    onChange={(e) => setFormData({ ...formData, modeOfTransport: e.target.value })}
                                >
                                    <option value="Car">Company Car / Personal Car</option>
                                    <option value="Rental">Rental Car</option>
                                    <option value="Flight">Flight</option>
                                    <option value="Train">Train</option>
                                    <option value="Bus">Bus</option>
                                    <option value="Rideshare">Uber/Lyft/Taxi</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Estimated Total Cost
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                        type="text"
                                        className="w-full pl-8 pr-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        placeholder="0.00"
                                        value={formData.estimatedCost}
                                        onChange={(e) => setFormData({ ...formData, estimatedCost: formatCurrency(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64">
                    <div className="flex gap-3 max-w-4xl mx-auto">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            isLoading={loading}
                            disabled={!formData.travelerName || !formData.destination || !formData.startDate || !formData.department}
                        >
                            Submit Authorization
                        </Button>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
