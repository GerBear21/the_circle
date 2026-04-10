import { useState, useEffect } from 'react';
import { Button } from './ui';

interface User {
    id: string;
    display_name: string;
    email: string;
    job_title?: string;
}

interface RedirectApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { newApproverId: string; reason: string; jobTitle: string }) => Promise<void>;
    stepInfo?: {
        stepIndex: number;
        approverRole?: string;
        currentApproverName?: string;
    };
    requestTitle?: string;
}

export default function RedirectApprovalModal({
    isOpen,
    onClose,
    onSubmit,
    stepInfo,
    requestTitle,
}: RedirectApprovalModalProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [jobTitle, setJobTitle] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            setSelectedUserId('');
            setSearchQuery('');
            setJobTitle('');
            setReason('');
            setError(null);
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase();
        return (
            user.display_name?.toLowerCase().includes(query) ||
            user.email?.toLowerCase().includes(query) ||
            user.job_title?.toLowerCase().includes(query)
        );
    });

    const selectedUser = users.find(u => u.id === selectedUserId);

    const handleSelectUser = (user: User) => {
        setSelectedUserId(user.id);
        setSearchQuery('');
        setShowDropdown(false);
        if (user.job_title && !jobTitle) {
            setJobTitle(user.job_title);
        }
    };

    const handleSubmit = async () => {
        if (!selectedUserId) {
            setError('Please select a user to redirect the approval to');
            return;
        }
        if (!jobTitle.trim()) {
            setError('Please enter the job title for the redirected approver');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            await onSubmit({
                newApproverId: selectedUserId,
                reason: reason.trim(),
                jobTitle: jobTitle.trim(),
            });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to redirect approval');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Redirect Approval</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Assign this approval to another person due to approver absence
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
                    {stepInfo && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <p className="text-sm font-medium text-amber-800">
                                        Redirecting Step {stepInfo.stepIndex}: {stepInfo.approverRole || 'Approval'}
                                    </p>
                                    {stepInfo.currentApproverName && (
                                        <p className="text-sm text-amber-700 mt-1">
                                            Current approver: <span className="font-medium">{stepInfo.currentApproverName}</span>
                                        </p>
                                    )}
                                    <p className="text-xs text-amber-600 mt-2">
                                        The new approver's signature will be prefixed with "pp" (per procurationem) on the final document.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select New Approver <span className="text-red-500">*</span>
                        </label>
                        {selectedUser ? (
                            <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 p-3 rounded-xl">
                                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-medium text-primary-600">
                                        {selectedUser.display_name?.charAt(0)?.toUpperCase() || '?'}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{selectedUser.display_name}</p>
                                    <p className="text-xs text-gray-500 truncate">{selectedUser.email}</p>
                                    {selectedUser.job_title && (
                                        <p className="text-xs text-primary-600 truncate">{selectedUser.job_title}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedUserId('')}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        placeholder="Search by name, email, or job title..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowDropdown(true);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                    />
                                </div>

                                {showDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                            {loadingUsers ? (
                                                <div className="flex items-center justify-center py-4">
                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                                                </div>
                                            ) : filteredUsers.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-gray-500">
                                                    No users found
                                                </div>
                                            ) : (
                                                filteredUsers.slice(0, 10).map((user) => (
                                                    <button
                                                        key={user.id}
                                                        type="button"
                                                        onClick={() => handleSelectUser(user)}
                                                        className="w-full px-4 py-3 text-left hover:bg-primary-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-sm font-medium text-primary-600">
                                                                {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 truncate">{user.display_name}</p>
                                                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                                            {user.job_title && (
                                                                <p className="text-xs text-primary-600 truncate">{user.job_title}</p>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Job Title (for signature) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                            placeholder="e.g., Acting Finance Director, Deputy HR Manager"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This title will appear on the PDF with "pp" prefix (e.g., "pp Finance Director")
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Reason for Redirection
                        </label>
                        <textarea
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                            placeholder="e.g., Original approver is on leave until..."
                            rows={3}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        className="flex-1"
                        onClick={handleSubmit}
                        isLoading={submitting}
                        disabled={!selectedUserId || !jobTitle.trim()}
                    >
                        Redirect Approval
                    </Button>
                </div>
            </div>
        </div>
    );
}
