import { useState, useEffect } from 'react';
import Head from 'next/head';
import { AppLayout } from '@/components/layout';
import { Card, Input, Button } from '@/components/ui';

import { AuditLogIllustration } from '@/components/illustrations/AuditLogIllustration';

// ... existing imports ...

// Mock Data
const MOCK_LOGS = Array.from({ length: 50 }).map((_, i) => {
    const actions = ['Login', 'Logout', 'Create User', 'Delete User', 'Update Settings', 'Export Data', 'Approve Request', 'Reject Request'];
    const targets = ['System', 'User: john.doe', 'User: jane.smith', 'Settings', 'Report: Q3', 'Request: #1234'];
    const statuses = ['Success', 'Failure', 'Warning'];
    const users = ['Admin User', 'John Doe', 'Jane Smith', 'System Bot'];

    return {
        id: `log-${i}`,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(),
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        target: targets[Math.floor(Math.random() * targets.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        details: 'IP: 192.168.1.' + Math.floor(Math.random() * 255),
    };
}).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

export default function AuditLog() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterAction, setFilterAction] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Filter Logic
    const filteredLogs = MOCK_LOGS.filter(log => {
        const matchesSearch =
            log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.target.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'All' || log.status === filterStatus;
        const matchesAction = filterAction === 'All' || log.action === filterAction;

        return matchesSearch && matchesStatus && matchesAction;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Success': return 'bg-success-100 text-success-700 border-success-200';
            case 'Failure': return 'bg-danger-100 text-danger-700 border-danger-200';
            case 'Warning': return 'bg-warning-100 text-warning-700 border-warning-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <>
            <Head>
                <title>Audit Log - The Circle</title>
            </Head>

            <AppLayout title="System Audit Log">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                    {/* Header Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-border">
                        <div className="md:col-span-2 space-y-4">
                            <div>
                                <h1 className="text-3xl font-bold text-text-primary font-heading">Audit Logs</h1>
                                <p className="text-text-secondary mt-2 text-lg">
                                    Track and monitor system activities, security events, and user actions in real-time.
                                </p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Export Report
                                </Button>
                            </div>
                        </div>
                        <div className="hidden md:flex md:col-span-1 justify-center items-center">
                            <div className="w-full max-w-[280px]">
                                <AuditLogIllustration />
                            </div>
                        </div>
                    </div>

                    {/* Filters & Search */}
                    <Card className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search logs..."
                                    className="pl-10 w-full rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm py-2.5"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <select
                                className="w-full rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm py-2.5"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="All">All Statuses</option>
                                <option value="Success">Success</option>
                                <option value="Failure">Failure</option>
                                <option value="Warning">Warning</option>
                            </select>

                            <select
                                className="w-full rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm py-2.5"
                                value={filterAction}
                                onChange={(e) => setFilterAction(e.target.value)}
                            >
                                <option value="All">All Actions</option>
                                <option value="Login">Login</option>
                                <option value="Logout">Logout</option>
                                <option value="Create User">Create User</option>
                                <option value="Delete User">Delete User</option>
                                <option value="Update Settings">Update Settings</option>
                            </select>

                            <input
                                type="date"
                                className="w-full rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm py-2.5 text-text-secondary"
                            />
                        </div>
                    </Card>

                    {/* Data Table */}
                    <Card className="overflow-hidden border-0 shadow-lg">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-border">
                                        <th className="py-4 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider">Timestamp</th>
                                        <th className="py-4 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider">User</th>
                                        <th className="py-4 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider">Action</th>
                                        <th className="py-4 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider">Target</th>
                                        <th className="py-4 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                                        <th className="py-4 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginatedLogs.length > 0 ? (
                                        paginatedLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-primary-50/30 transition-colors group">
                                                <td className="py-4 px-6 text-sm text-text-secondary whitespace-nowrap font-mono">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                                                            {log.user.charAt(0)}
                                                        </div>
                                                        <span className="text-sm font-medium text-text-primary">{log.user}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-sm text-text-primary font-medium">{log.action}</td>
                                                <td className="py-4 px-6 text-sm text-text-secondary">{log.target}</td>
                                                <td className="py-4 px-6">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(log.status)}`}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-sm text-text-secondary font-mono text-xs">{log.details}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-text-secondary">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <p>No logs found matching your criteria.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-gray-50/30">
                            <p className="text-sm text-text-secondary">
                                Showing <span className="font-medium text-text-primary">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredLogs.length)}</span> to <span className="font-medium text-text-primary">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="font-medium text-text-primary">{filteredLogs.length}</span> results
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </AppLayout>
        </>
    );
}
