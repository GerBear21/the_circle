import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';
import Link from 'next/link';

interface CapexRequest {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected' | 'in_review' | 'withdrawn';
    created_at: string;
    amount: number;
    currency: string;
    requester: {
        id: string;
        display_name: string;
        email: string;
        avatar?: string;
    };
    current_approver?: {
        id: string;
        display_name: string;
        email: string;
    } | null;
    metadata?: any;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; ring: string }> = {
    pending: { label: 'Pending', bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-600/20' },
    in_review: { label: 'In Review', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20' },
    approved: { label: 'Approved', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20' },
    rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20' },
    withdrawn: { label: 'Withdrawn', bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-500/10' },
};

export default function CapexTrackerPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [requests, setRequests] = useState<CapexRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        async function fetchCapex() {
            if (status !== 'authenticated') return;

            try {
                const response = await fetch('/api/requests/capex');
                if (!response.ok) throw new Error('Failed to fetch CAPEX requests');
                const data = await response.json();
                setRequests(data.requests);
            } catch (err: any) {
                console.error('Error fetching CAPEX:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchCapex();
    }, [status]);

    const formatCurrency = (amount: number, currency: string = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const stats = {
        totalValue: requests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
        approvedValue: requests
            .filter(r => r.status === 'approved')
            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
        pendingValue: requests
            .filter(r => r.status === 'pending' || r.status === 'in_review')
            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
        count: requests.length
    };

    if (status === 'loading' || loading) {
        return (
            <AppLayout title="CAPEX Tracker">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout title="CAPEX Tracker">
            <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 font-heading">CAPEX Tracker</h1>
                        <p className="text-gray-500 mt-1">Monitor and manage all capital expenditure requests</p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => router.push('/requests/new/capex')}
                        className="flex items-center gap-2 shadow-lg shadow-brand-500/20"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        New Request
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="!p-5 relative overflow-hidden group hover:shadow-md transition-shadow border border-gray-100">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.15-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39h-2.05c-.15-.86-.82-1.5-2.01-1.5-1.2 0-2.48.67-2.48 1.58 0 .49.36 1.22 2.53 1.73 2.71.63 4.35 1.63 4.35 3.86.01 1.78-1.29 3.08-3.23 3.42z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Requested</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.totalValue)}</h3>
                            <p className="text-xs text-gray-400 mt-2">{stats.count} total requests</p>
                        </div>
                    </Card>

                    <Card className="!p-5 relative overflow-hidden group hover:shadow-md transition-shadow border border-gray-100">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Approved Value</p>
                            <h3 className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.approvedValue)}</h3>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${stats.totalValue ? (stats.approvedValue / stats.totalValue) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </Card>

                    <Card className="!p-5 relative overflow-hidden group hover:shadow-md transition-shadow border border-gray-100">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Pending Approval</p>
                            <h3 className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(stats.pendingValue)}</h3>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                                <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${stats.totalValue ? (stats.pendingValue / stats.totalValue) * 100 : 0}%` }} />
                            </div>
                        </div>
                    </Card>

                    <Card className="!p-5 relative overflow-hidden border border-gray-100">
                        <div className="relative z-10">
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Budget Utilization</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-1">--%</h3>
                            <p className="text-xs text-gray-400 mt-2">v.s. Annual Budget</p>
                        </div>
                    </Card>
                </div>

                {/* Tracker Table */}
                <Card className="!p-0 overflow-hidden shadow-md border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-4">Detailed Summary</th>
                                    <th className="px-6 py-4">Requested By</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Who is to Approve</th>
                                    <th className="px-6 py-4">Request Date</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">
                                            No CAPEX requests found.
                                        </td>
                                    </tr>
                                ) : (
                                    requests.map((req) => {
                                        const statusInfo = statusConfig[req.status] || statusConfig.pending;

                                        return (
                                            <tr
                                                key={req.id}
                                                className="group hover:bg-gray-50/80 transition-colors cursor-pointer"
                                                onClick={() => router.push(`/requests/${req.id}`)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-gray-900">{req.title}</span>
                                                            {req.metadata?.unit && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                                    {req.metadata.unit}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-sm text-gray-500 line-clamp-1 mt-0.5">{req.description}</span>
                                                        {req.metadata?.projectName && (
                                                            <span className="text-xs text-brand-600 mt-1">{req.metadata.projectName}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                                                            {req.requester.avatar ? (
                                                                <img src={req.requester.avatar} alt="" className="w-full h-full rounded-full" />
                                                            ) : (
                                                                getInitials(req.requester.display_name)
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-gray-900">{req.requester.display_name}</span>
                                                            <span className="text-xs text-gray-500 truncate max-w-[120px]">{req.requester.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-bold text-gray-900">
                                                        {formatCurrency(req.amount, req.currency)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${statusInfo.bg} ${statusInfo.text} ${statusInfo.ring}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full bg-current`} />
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {req.status === 'pending' || req.status === 'in_review' ? (
                                                        req.current_approver ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold ring-2 ring-white">
                                                                    {getInitials(req.current_approver.display_name)}
                                                                </div>
                                                                <span className="text-sm text-gray-700">{req.current_approver.display_name}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-gray-400 italic">Processing...</span>
                                                        )
                                                    ) : (
                                                        <span className="text-sm text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-gray-600">{formatDate(req.created_at)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-gray-400 hover:text-brand-600 transition-colors">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
