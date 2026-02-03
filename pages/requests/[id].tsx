import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AppLayout } from '../../components/layout';
import { Card, Button, Input } from '../../components/ui';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import criticalAnimation from '../../lotties/red critical.json';
import urgentAnimation from '../../lotties/orange warning exclamation.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const CRITICAL_ANIMATION_DURATION = 1.4;
const HIGH_ANIMATION_DURATION = 4.17;

const pulseKeyframes = `
@keyframes pulse-red-header {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4), 0 4px 20px -2px rgba(239, 68, 68, 0.3);
    border-color: rgb(252, 165, 165);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0), 0 8px 30px -2px rgba(239, 68, 68, 0.4);
    border-color: rgb(239, 68, 68);
  }
}

@keyframes pulse-orange-header {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.4), 0 4px 20px -2px rgba(249, 115, 22, 0.3);
    border-color: rgb(253, 186, 116);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(249, 115, 22, 0), 0 8px 30px -2px rgba(249, 115, 22, 0.4);
    border-color: rgb(249, 115, 22);
  }
}
`;

// Extended Request Interface for Detail View
interface RequestDetail {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected' | 'in_review' | 'withdrawn' | 'draft';
    created_at: string;
    updated_at: string;
    current_step: number;
    total_steps: number;
    metadata?: Record<string, any>;
    creator: {
        id: string;
        display_name: string;
        email: string;
        profile_picture_url?: string;
        department?: {
            id: string;
            name: string;
        } | null;
    };
    current_approver?: {
        id: string;
        display_name: string;
        email: string;
    } | null;
    request_steps: {
        id: string;
        step_index: number;
        step_type: string;
        approver_role: string;
        status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'waiting';
        due_at?: string;
        created_at: string;
        approver?: {
            id: string;
            display_name: string;
            email: string;
        } | null;
        approvals?: {
            id: string;
            decision: string;
            comment?: string;
            signed_at?: string;
            approver: {
                id: string;
                display_name: string;
                email: string;
            };
        }[];
    }[];
    documents?: {
        id: string;
        filename: string;
        storage_path: string;
        file_size?: number;
        mime_type?: string;
        created_at: string;
    }[];
}

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: string }> = {
    pending: { label: 'Pending', bg: 'bg-amber-100/50', text: 'text-amber-700', icon: 'clock' },
    in_review: { label: 'In Review', bg: 'bg-blue-100/50', text: 'text-blue-700', icon: 'refresh' },
    approved: { label: 'Approved', bg: 'bg-emerald-100/50', text: 'text-emerald-700', icon: 'check-circle' },
    rejected: { label: 'Rejected', bg: 'bg-rose-100/50', text: 'text-rose-700', icon: 'x-circle' },
    withdrawn: { label: 'Withdrawn', bg: 'bg-gray-100/50', text: 'text-gray-500', icon: 'minus-circle' },
    draft: { label: 'Draft', bg: 'bg-slate-100/50', text: 'text-slate-500', icon: 'document' },
};

// Friendly labels for metadata fields
const fieldLabels: Record<string, string> = {
    irr: 'Internal Rate of Return (IRR)',
    npv: 'Net Present Value (NPV)',
    unit: 'Business Unit',
    amount: 'Amount',
    endDate: 'End Date',
    category: 'Category',
    currency: 'Currency',
    requester: 'Requester',
    startDate: 'Start Date',
    budgetType: 'Budget Type',
    department: 'Department',
    description: 'Description',
    projectName: 'Project Name',
    fundingSource: 'Funding Source',
    justification: 'Justification',
    paybackPeriod: 'Payback Period',
    type: 'Request Type',
    priority: 'Priority',
    evaluation: 'Financial Evaluation',
};

// Fields to exclude from display (internal/system fields)
const excludedFields = ['approvers', 'documents', 'type', 'category', 'capex', 'leave', 'travel', 'expense'];

// Format field value for display
function formatFieldValue(key: string, value: any): string {
    if (value === null || value === undefined || value === '') return '—';

    // Skip objects and arrays - they should be handled separately
    if (typeof value === 'object') return '—';

    // Handle currency formatting
    if ((key === 'amount' || key === 'npv') && typeof value === 'string') {
        return value.includes(',') ? value : Number(value).toLocaleString();
    }

    // Handle payback period
    if (key === 'paybackPeriod') {
        const periods: Record<string, string> = {
            '<1y': 'Less than 1 year',
            '1-2y': '1-2 years',
            '2-3y': '2-3 years',
            '>3y': 'More than 3 years',
        };
        return periods[value] || value;
    }

    // Handle budget type
    if (key === 'budgetType') {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    // Handle priority
    if (key === 'priority') {
        const priorities: Record<string, string> = {
            low: 'Low',
            normal: 'Normal',
            high: 'High',
            urgent: 'Urgent',
        };
        return priorities[value] || value;
    }

    return String(value);
}

// Get the form-specific data from metadata (handles nested structure like capex, leave, etc.)
function getFormData(metadata: Record<string, any> | undefined): Record<string, any> {
    if (!metadata) return {};

    // Check for nested form data (capex, leave, travel, expense, etc.)
    const formTypes = ['capex', 'leave', 'travel', 'expense', 'approval'];
    for (const formType of formTypes) {
        if (metadata[formType] && typeof metadata[formType] === 'object') {
            return metadata[formType];
        }
    }

    // If no nested structure, return metadata directly (excluding system fields)
    return metadata;
}

// Get friendly label for a field
function getFieldLabel(key: string): string {
    return fieldLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
}

// Interface for metadata documents
interface MetadataDocument {
    name: string;
    size: number;
    type: string;
    path?: string;
}

// Interface for approver info
interface ApproverInfo {
    id: string;
    display_name: string;
    email: string;
    profile_picture_url?: string;
    status: 'pending' | 'approved' | 'rejected';
    signed_at?: string;
    comment?: string;
}

// Helper to get approver IDs from metadata (handles nested structures)
function getApproverIds(metadata: Record<string, any> | undefined): string[] {
    if (!metadata) return [];

    // Check direct approvers array
    if (Array.isArray(metadata.approvers)) {
        return metadata.approvers;
    }

    // Check nested form data (capex, leave, travel, expense, etc.)
    const formTypes = ['capex', 'leave', 'travel', 'expense', 'approval'];
    for (const formType of formTypes) {
        if (metadata[formType] && Array.isArray(metadata[formType].approvers)) {
            return metadata[formType].approvers;
        }
    }

    return [];
}

// ApprovalTimeline component to show approvers and their status
function ApprovalTimeline({ request, isEditing, onApproversChange }: {
    request: RequestDetail;
    isEditing?: boolean;
    onApproversChange?: (approverIds: string[]) => void;
}) {
    const [approvers, setApprovers] = useState<ApproverInfo[]>([]);
    const [loadingApprovers, setLoadingApprovers] = useState(true);
    const [allUsers, setAllUsers] = useState<Array<{ id: string; display_name: string; email: string; profile_picture_url?: string }>>([]);
    const [approverSearch, setApproverSearch] = useState('');
    const [showApproverDropdown, setShowApproverDropdown] = useState(false);

    // Fetch all users for editing mode
    useEffect(() => {
        if (isEditing) {
            fetch('/api/users')
                .then(res => res.json())
                .then(data => setAllUsers(data.users || []))
                .catch(err => console.error('Error fetching users:', err));
        }
    }, [isEditing]);

    useEffect(() => {
        async function fetchApprovers() {
            // Get approver IDs from metadata (handles nested structures)
            const approverIds: string[] = getApproverIds(request.metadata);

            if (approverIds.length === 0) {
                setLoadingApprovers(false);
                return;
            }

            try {
                // Fetch approver details
                const response = await fetch(`/api/users/by-ids?ids=${approverIds.join(',')}`);
                if (response.ok) {
                    const data = await response.json();
                    const users = data.users || [];

                    // Map approvers with their status from request_steps
                    const approverInfos: ApproverInfo[] = approverIds.map((id, index) => {
                        const user = users.find((u: any) => u.id === id);
                        const step = request.request_steps?.find(s => s.approver?.id === id);
                        const approval = step?.approvals?.[0];

                        return {
                            id,
                            display_name: user?.display_name || `Approver ${index + 1}`,
                            email: user?.email || '',
                            profile_picture_url: user?.profile_picture_url,
                            status: step?.status === 'approved' ? 'approved' :
                                step?.status === 'rejected' ? 'rejected' : 'pending',
                            signed_at: approval?.signed_at,
                            comment: approval?.comment,
                        };
                    });

                    setApprovers(approverInfos);
                } else {
                    // Fallback: use request_steps data if available
                    const approverInfos: ApproverInfo[] = approverIds.map((id, index) => {
                        const step = request.request_steps?.[index];
                        const approval = step?.approvals?.[0];

                        return {
                            id,
                            display_name: step?.approver?.display_name || `Approver ${index + 1}`,
                            email: step?.approver?.email || '',
                            status: step?.status === 'approved' ? 'approved' :
                                step?.status === 'rejected' ? 'rejected' : 'pending',
                            signed_at: approval?.signed_at,
                            comment: approval?.comment,
                        };
                    });
                    setApprovers(approverInfos);
                }
            } catch (error) {
                console.error('Error fetching approvers:', error);
                // Fallback to request_steps
                const approverInfos: ApproverInfo[] = request.request_steps?.map((step, index) => ({
                    id: step.approver?.id || `step-${index}`,
                    display_name: step.approver?.display_name || step.approver_role || `Approver ${index + 1}`,
                    email: step.approver?.email || '',
                    status: step.status === 'approved' ? 'approved' :
                        step.status === 'rejected' ? 'rejected' : 'pending',
                    signed_at: step.approvals?.[0]?.signed_at,
                    comment: step.approvals?.[0]?.comment,
                })) || [];
                setApprovers(approverInfos);
            } finally {
                setLoadingApprovers(false);
            }
        }

        fetchApprovers();
    }, [request]);

    const handleAddApprover = (userId: string) => {
        const user = allUsers.find(u => u.id === userId);
        if (user && !approvers.find(a => a.id === userId)) {
            const newApprover: ApproverInfo = {
                id: userId,
                display_name: user.display_name,
                email: user.email,
                status: 'pending',
            };
            const newApprovers = [...approvers, newApprover];
            setApprovers(newApprovers);
            onApproversChange?.(newApprovers.map(a => a.id));
        }
        setApproverSearch('');
        setShowApproverDropdown(false);
    };

    const handleRemoveApprover = (userId: string) => {
        const newApprovers = approvers.filter(a => a.id !== userId);
        setApprovers(newApprovers);
        onApproversChange?.(newApprovers.map(a => a.id));
    };

    const handleMoveApprover = (index: number, direction: 'up' | 'down') => {
        const newApprovers = [...approvers];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newApprovers.length) {
            [newApprovers[index], newApprovers[targetIndex]] = [newApprovers[targetIndex], newApprovers[index]];
            setApprovers(newApprovers);
            onApproversChange?.(newApprovers.map(a => a.id));
        }
    };

    const filteredUsers = allUsers.filter(user =>
        !approvers.find(a => a.id === user.id) &&
        (user.display_name?.toLowerCase().includes(approverSearch.toLowerCase()) ||
            user.email?.toLowerCase().includes(approverSearch.toLowerCase()))
    );

    if (loadingApprovers) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    // Render edit mode UI for adding approvers
    const renderEditControls = () => {
        if (!isEditing) return null;

        return (
            <div className="mb-8 relative z-20">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                        placeholder="Search users to add as approvers..."
                        value={approverSearch}
                        onChange={(e) => {
                            setApproverSearch(e.target.value);
                            setShowApproverDropdown(true);
                        }}
                        onFocus={() => setShowApproverDropdown(true)}
                    />
                    {showApproverDropdown && approverSearch && filteredUsers.length > 0 && (
                        <div className="absolute w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-hidden">
                            {filteredUsers.slice(0, 5).map(user => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
                                    onClick={() => handleAddApprover(user.id)}
                                >
                                    <img
                                        src={user.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=random&size=32`}
                                        alt={user.display_name}
                                        className="w-8 h-8 rounded-full object-cover"
                                    />
                                    <div>
                                        <div className="font-medium text-gray-900">{user.display_name}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </div>
                                    <div className="ml-auto text-primary-600 text-sm font-medium">Add +</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (approvers.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center shadow-sm">
                {renderEditControls()}
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <p className="text-gray-500">
                        {isEditing ? 'Search and add approvers above' : 'No approvers assigned to this request.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            {renderEditControls()}

            <div className="relative pl-6 sm:pl-10 space-y-8 pb-8">
                {/* Vertical Line */}
                <div className="absolute left-[1.15rem] sm:left-[2.15rem] top-4 bottom-4 w-0.5 bg-gray-100" />

                {approvers.map((approver, index) => {
                    const isApproved = approver.status === 'approved';
                    const isRejected = approver.status === 'rejected';
                    const isPending = approver.status === 'pending';

                    // Determine if this is the active pending step (first pending one)
                    const prevStepsApproved = index === 0 || approvers.slice(0, index).every(a => a.status === 'approved');
                    const isActive = isPending && prevStepsApproved;

                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            key={approver.id}
                            className="relative"
                        >
                            {/* Connector Line Cover (for top/bottom spacing) */}
                            {/* Node */}
                            <div className={`
                                absolute -left-[1.65rem] top-0 w-10 h-10 rounded-full border-4 flex items-center justify-center z-10 transition-all duration-300
                                ${isApproved
                                    ? 'bg-emerald-500 border-white shadow-lg shadow-emerald-200'
                                    : isRejected
                                        ? 'bg-rose-500 border-white shadow-lg shadow-rose-200'
                                        : isActive
                                            ? 'bg-white border-primary-500 text-primary-600 shadow-lg shadow-primary-100 scale-110'
                                            : 'bg-white border-gray-200 text-gray-400'
                                }
                            `}>
                                {isApproved ? (
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : isRejected ? (
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <span className="font-bold text-sm">{index + 1}</span>
                                )}
                            </div>

                            {/* Content Card */}
                            <div className={`
                                ml-4 p-5 rounded-2xl border transition-all duration-300 group
                                ${isActive && !isEditing
                                    ? 'bg-white border-primary-200 shadow-lg shadow-primary-50 ring-1 ring-primary-100'
                                    : 'bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'
                                }
                            `}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <img
                                                src={approver.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(approver.display_name)}&background=random&size=48`}
                                                alt={approver.display_name}
                                                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                                            />
                                            {isApproved && (
                                                <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-white">
                                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <h4 className={`font-bold text-lg ${isActive && !isEditing ? 'text-primary-700' : 'text-gray-900'}`}>
                                                {approver.display_name}
                                            </h4>
                                            <p className="text-sm text-gray-500">{approver.email}</p>
                                        </div>
                                    </div>

                                    {/* Actions / Status Badge */}
                                    <div className="flex items-center gap-2 self-start sm:self-center ml-16 sm:ml-0">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoveApprover(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleMoveApprover(index, 'down')}
                                                    disabled={index === approvers.length - 1}
                                                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveApprover(approver.id)}
                                                    className="p-2 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-end gap-1">
                                                {isApproved ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        Approved
                                                    </span>
                                                ) : isRejected ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                                                        Rejected
                                                    </span>
                                                ) : isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100 animate-pulse">
                                                        Awaiting Action
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-100">
                                                        Pending
                                                    </span>
                                                )}

                                                {approver.signed_at && (
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(approver.signed_at).toLocaleDateString('en-US')}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Comments */}
                                {!isEditing && approver.comment && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="mt-4 pt-4 border-t border-gray-100"
                                    >
                                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 relative">
                                            <div className="absolute top-0 left-4 -mt-2 w-4 h-4 bg-gray-50 transform rotate-45 border-l border-t border-gray-100"></div>
                                            <p className="italic">"{approver.comment}"</p>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// Watcher data type (supports both old string[] format and new object format)
interface WatcherData {
    id: string;
    addedBy?: {
        id: string;
        name: string;
        isApprover: boolean;
    };
    addedAt?: string;
}

// WatchersCard component to display watchers for a request
function WatchersCard({ watcherData }: { watcherData?: (string | WatcherData)[] }) {
    const [watchers, setWatchers] = useState<Array<{ id: string; display_name: string; email: string; profile_picture_url?: string; addedBy?: WatcherData['addedBy']; addedAt?: string }>>([]);
    const [loading, setLoading] = useState(true);

    // Normalize watcher data to handle both old (string[]) and new (object[]) formats
    const normalizedWatchers: WatcherData[] = (Array.isArray(watcherData) ? watcherData : []).map(w => 
        typeof w === 'string' ? { id: w } : w
    );

    useEffect(() => {
        async function fetchWatchers() {
            if (normalizedWatchers.length === 0) {
                setLoading(false);
                return;
            }

            try {
                const watcherIds = normalizedWatchers.map(w => w.id);
                const response = await fetch(`/api/users/by-ids?ids=${watcherIds.join(',')}`);
                if (response.ok) {
                    const data = await response.json();
                    const users = data.users || [];
                    // Merge user data with watcher metadata
                    const watchersWithMetadata = normalizedWatchers.map(w => {
                        const user = users.find((u: any) => u.id === w.id);
                        return {
                            id: w.id,
                            display_name: user?.display_name || 'Unknown',
                            email: user?.email || '',
                            profile_picture_url: user?.profile_picture_url,
                            addedBy: w.addedBy,
                            addedAt: w.addedAt,
                        };
                    });
                    setWatchers(watchersWithMetadata);
                }
            } catch (error) {
                console.error('Error fetching watchers:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchWatchers();
    }, [JSON.stringify(normalizedWatchers)]);

    if (normalizedWatchers.length === 0) {
        return null;
    }

    if (loading) {
        return (
            <div className="animate-pulse flex space-x-2">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
            </div>
        );
    }

    return (
        <Card className="!p-5 border-gray-100/60 shadow-sm hover:shadow-md transition-all duration-300">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Watchers ({watchers.length})
            </h3>

            <div className="space-y-2">
                {watchers.map((watcher) => (
                    <div key={watcher.id} className={`flex items-center gap-3 p-2 rounded-lg ${watcher.addedBy?.isApprover ? 'bg-primary-50/50 border border-primary-100' : 'hover:bg-gray-50'}`}>
                        <img
                            src={watcher.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(watcher.display_name)}&background=random&size=40`}
                            alt={watcher.display_name}
                            className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{watcher.display_name}</p>
                            {watcher.addedBy && (
                                <p className="text-xs text-primary-600 flex items-center gap-1">
                                    Added by {watcher.addedBy.name}
                                    {watcher.addedBy.isApprover && (
                                        <span className="px-1.5 py-0.5 rounded text-xs bg-primary-100 text-primary-700">Approver</span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

export default function RequestDetailsPage() {
    const router = useRouter();
    const { id } = router.query;
    const { data: session, status } = useSession();
    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'documents'>('details');
    const [publishing, setPublishing] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedRequest, setEditedRequest] = useState<RequestDetail | null>(null);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [uploadingDocument, setUploadingDocument] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loadingDocuments, setLoadingDocuments] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewProcessing, setReviewProcessing] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [userSignatureUrl, setUserSignatureUrl] = useState<string | null>(null);
    const [isApproverEditing, setIsApproverEditing] = useState(false);
    const [approverEditedRequest, setApproverEditedRequest] = useState<RequestDetail | null>(null);
    const [savingApproverEdit, setSavingApproverEdit] = useState(false);
    const [modifications, setModifications] = useState<any[]>([]);
    const [loadingModifications, setLoadingModifications] = useState(false);
    const [uploadingApproverDocument, setUploadingApproverDocument] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadDocumentType, setUploadDocumentType] = useState<'quotation' | 'supporting'>('supporting');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadMetadata, setUploadMetadata] = useState({
        description: '',
        supplierName: '',
        isSelectedSupplier: false,
        selectionReason: '',
    });

    const currentUserId = (session?.user as any)?.id;
    const isCreator = request?.creator?.id === currentUserId;
    const isDraft = request?.status === 'draft';
    const canPublish = isCreator && isDraft;
    const canDelete = isCreator && request?.status !== 'approved';

    // Check if current user is the pending approver for this request
    // Note: We check if the user has a pending step regardless of request status,
    // because the request status might be incorrectly set to 'approved' due to a previous bug
    const pendingStep = request?.request_steps?.find(
        s => s.approver?.id === currentUserId && s.status === 'pending'
    );

    // Also check if user has a waiting step that should be pending
    // (i.e., all previous steps are approved - handles case where step wasn't activated)
    const waitingStepThatShouldBePending = (() => {
        if (!request?.request_steps) return null;
        const sortedSteps = [...request.request_steps].sort((a, b) => a.step_index - b.step_index);

        for (const step of sortedSteps) {
            if (step.status === 'approved') continue;
            if (step.status === 'rejected') return null; // Request is rejected
            // This is the first non-approved step
            if (step.approver?.id === currentUserId && (step.status === 'pending' || step.status === 'waiting')) {
                return step;
            }
            return null; // First non-approved step is not for this user
        }
        return null;
    })();

    const effectivePendingStep = pendingStep || waitingStepThatShouldBePending;
    const isCurrentApprover = !!effectivePendingStep;

    // Check if current user is a watcher (watchers can only view, not edit)
    const watchersData = Array.isArray(request?.metadata?.watchers) ? request.metadata.watchers : [];
    const isWatcher = watchersData.some((w: any) => 
        typeof w === 'string' ? w === currentUserId : w.id === currentUserId
    );

    // Approvers can edit, watchers cannot
    const canApproverEdit = isCurrentApprover && !isWatcher;

    // Compute the actual status based on step statuses (to handle incorrectly marked requests)
    const computeActualStatus = (): string | undefined => {
        if (!request) return undefined;
        const steps = request.request_steps || [];
        if (steps.length === 0) return request.status;

        // If any step is rejected, the request is rejected
        if (steps.some(s => s.status === 'rejected')) return 'rejected';

        // If all steps are approved, the request is approved
        if (steps.every(s => s.status === 'approved')) return 'approved';

        // If there are pending or waiting steps, the request is still in progress
        if (steps.some(s => s.status === 'pending' || s.status === 'waiting')) return 'pending';

        return request.status;
    };
    const actualStatus = computeActualStatus();

    // Fetch user's signature when modal opens
    useEffect(() => {
        if (showReviewModal && currentUserId) {
            fetch('/api/user/signature')
                .then(res => res.json())
                .then(data => {
                    if (data.signature?.url) {
                        setUserSignatureUrl(data.signature.url);
                    }
                })
                .catch(err => console.error('Error fetching signature:', err));
        }
    }, [showReviewModal, currentUserId]);

    const handleApprovalAction = async (action: 'approve' | 'reject') => {
        if (!id || !effectivePendingStep) return;

        if (action === 'reject' && !reviewComment.trim()) {
            setReviewError('Please provide a reason for rejection');
            return;
        }

        if (action === 'approve' && !userSignatureUrl) {
            setReviewError('You need to set up your signature before approving. Go to Profile > Signature.');
            return;
        }

        setReviewProcessing(true);
        setReviewError(null);

        try {
            const response = await fetch('/api/approvals/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: id,
                    stepId: effectivePendingStep.id,
                    action,
                    comment: reviewComment || undefined,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${action} request`);
            }

            // Refresh the request data
            const refreshResponse = await fetch(`/api/requests/${id}`);
            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                setRequest(refreshData.request);
            }

            setShowReviewModal(false);
            setReviewComment('');
        } catch (err: any) {
            setReviewError(err.message || `Failed to ${action} request`);
        } finally {
            setReviewProcessing(false);
        }
    };

    const handlePublish = async () => {
        if (!id || !canPublish) return;

        setPublishing(true);
        setPublishError(null);

        try {
            const response = await fetch(`/api/requests/${id}/publish`, {
                method: 'POST',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to publish request');
            }

            // Refresh the request data
            const refreshResponse = await fetch(`/api/requests/${id}`);
            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                setRequest(refreshData.request);
            }

            router.push('/requests/my-requests');
        } catch (err: any) {
            console.error('Error publishing request:', err);
            setPublishError(err.message || 'Failed to publish request');
        } finally {
            setPublishing(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!id || !canPublish || !editedRequest) return;

        setSavingDraft(true);
        setPublishError(null);

        try {
            const response = await fetch(`/api/requests/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: editedRequest.title,
                    description: editedRequest.description,
                    metadata: editedRequest.metadata,
                    status: 'draft',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save draft');
            }

            // Refresh the request data
            const refreshResponse = await fetch(`/api/requests/${id}`);
            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                setRequest(refreshData.request);
                setIsEditing(false);
            }
        } catch (err: any) {
            console.error('Error saving draft:', err);
            setPublishError(err.message || 'Failed to save draft');
        } finally {
            setSavingDraft(false);
        }
    };

    const handleMetadataChange = (key: string, value: any) => {
        if (!editedRequest || !editedRequest.metadata) return;

        const newMetadata = { ...editedRequest.metadata };

        // Find the correct form type (capex, leave, etc)
        const formTypes = ['capex', 'leave', 'travel', 'expense', 'approval'];
        let found = false;

        for (const formType of formTypes) {
            if (newMetadata[formType] && typeof newMetadata[formType] === 'object') {
                newMetadata[formType] = { ...newMetadata[formType], [key]: value };
                found = true;
                break;
            }
        }

        // If not found in nested, update root metadata
        if (!found) {
            newMetadata[key] = value;
        }

        setEditedRequest({ ...editedRequest, metadata: newMetadata });
    };

    const handleDelete = async () => {
        if (!id || !canDelete) return;

        setDeleting(true);
        setPublishError(null);

        try {
            const response = await fetch(`/api/requests/${id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete request');
            }

            router.push('/requests/my-requests');
        } catch (err: any) {
            console.error('Error deleting request:', err);
            setPublishError(err.message || 'Failed to delete request');
            setShowDeleteConfirm(false);
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    useEffect(() => {
        async function fetchRequestDetails() {
            if (!id || status !== 'authenticated') return;

            setLoading(true);
            try {
                const response = await fetch(`/api/requests/${id}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch request');
                }

                const data = await response.json();
                setRequest(data.request);
                setError(null);
            } catch (err: any) {
                console.error('Error fetching request:', err);
                setError(err.message || 'Failed to load request details. Please try again.');
            } finally {
                setLoading(false);
            }
        }

        fetchRequestDetails();
    }, [id, status]);

    useEffect(() => {
        if (request) {
            setEditedRequest(JSON.parse(JSON.stringify(request)));
            setApproverEditedRequest(JSON.parse(JSON.stringify(request)));
        }
    }, [request]);

    // Fetch modifications when request loads
    const fetchModifications = async () => {
        if (!id) return;
        setLoadingModifications(true);
        try {
            const response = await fetch(`/api/requests/${id}/modifications`);
            if (response.ok) {
                const data = await response.json();
                setModifications(data.modifications || []);
            }
        } catch (err) {
            console.error('Error fetching modifications:', err);
        } finally {
            setLoadingModifications(false);
        }
    };

    useEffect(() => {
        if (id && request) {
            fetchModifications();
        }
    }, [id, request]);

    // Handle approver metadata change
    const handleApproverMetadataChange = (key: string, value: any) => {
        if (!approverEditedRequest || !approverEditedRequest.metadata) return;

        const newMetadata = { ...approverEditedRequest.metadata };
        const formTypes = ['capex', 'leave', 'travel', 'expense', 'approval'];
        let found = false;

        for (const formType of formTypes) {
            if (newMetadata[formType] && typeof newMetadata[formType] === 'object') {
                newMetadata[formType] = { ...newMetadata[formType], [key]: value };
                found = true;
                break;
            }
        }

        if (!found) {
            newMetadata[key] = value;
        }

        setApproverEditedRequest({ ...approverEditedRequest, metadata: newMetadata });
    };

    // Save approver edits
    const handleSaveApproverEdit = async () => {
        if (!id || !canApproverEdit || !approverEditedRequest || !request) return;

        setSavingApproverEdit(true);
        setPublishError(null);

        try {
            // Collect field changes
            const originalFormData = getFormData(request.metadata);
            const editedFormData = getFormData(approverEditedRequest.metadata);
            const fieldChanges: { fieldName: string; oldValue: any; newValue: any }[] = [];

            // Compare form data fields
            for (const key of Object.keys(editedFormData)) {
                if (editedFormData[key] !== originalFormData[key]) {
                    fieldChanges.push({
                        fieldName: key,
                        oldValue: originalFormData[key],
                        newValue: editedFormData[key],
                    });
                }
            }

            if (fieldChanges.length === 0) {
                setIsApproverEditing(false);
                return;
            }

            const response = await fetch(`/api/requests/${id}/approver-edit`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fieldChanges }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save changes');
            }

            // Refresh the request data
            const refreshResponse = await fetch(`/api/requests/${id}`);
            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                setRequest(refreshData.request);
            }

            // Refresh modifications
            await fetchModifications();

            setIsApproverEditing(false);
        } catch (err: any) {
            console.error('Error saving approver edit:', err);
            setPublishError(err.message || 'Failed to save changes');
        } finally {
            setSavingApproverEdit(false);
        }
    };

    // Handle file selection for upload modal
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadFile(file);
            setShowUploadModal(true);
        }
        e.target.value = '';
    };

    // Handle document upload with metadata
    const handleUploadWithMetadata = async () => {
        if (!uploadFile || !id) return;

        const isApprover = canApproverEdit;
        if (isApprover) {
            setUploadingApproverDocument(true);
        } else {
            setUploadingDocument(true);
        }

        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('documentType', uploadDocumentType);
            formData.append('description', uploadMetadata.description);
            if (uploadDocumentType === 'quotation') {
                formData.append('supplierName', uploadMetadata.supplierName);
                formData.append('isSelectedSupplier', String(uploadMetadata.isSelectedSupplier));
                formData.append('selectionReason', uploadMetadata.selectionReason);
            }

            const endpoint = isApprover 
                ? `/api/requests/${id}/approver-documents`
                : `/api/requests/${id}/documents`;

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload document');
            }

            // Also update request metadata to include document details
            const currentMetadata = request?.metadata || {};
            const uploaderInfo = {
                id: currentUserId,
                name: (session?.user as any)?.name || 'Unknown',
                isApprover: isApprover,
            };
            const docMetadata = {
                name: uploadFile.name,
                size: uploadFile.size,
                type: uploadFile.type,
                description: uploadMetadata.description,
                uploadedBy: uploaderInfo,
                uploadedAt: new Date().toISOString(),
                ...(uploadDocumentType === 'quotation' && {
                    supplierName: uploadMetadata.supplierName,
                    isSelectedSupplier: uploadMetadata.isSelectedSupplier,
                    selectionReason: uploadMetadata.selectionReason,
                }),
            };

            // Update metadata based on document type
            const updatedMetadata = { ...currentMetadata };
            if (uploadDocumentType === 'quotation') {
                updatedMetadata.quotations = [...(currentMetadata.quotations || []), docMetadata];
            } else {
                updatedMetadata.supportingDocuments = [...(currentMetadata.supportingDocuments || []), docMetadata];
            }

            // Save updated metadata
            await fetch(`/api/requests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metadata: updatedMetadata }),
            });

            // Refresh documents and modifications
            await fetchDocuments();
            if (isApprover) {
                await fetchModifications();
            }
            
            // Refresh request data by re-fetching
            const reqResponse = await fetch(`/api/requests/${id}`);
            if (reqResponse.ok) {
                const reqData = await reqResponse.json();
                setRequest(reqData.request);
            }

            // Reset modal state
            setShowUploadModal(false);
            setUploadFile(null);
            setUploadMetadata({
                description: '',
                supplierName: '',
                isSelectedSupplier: false,
                selectionReason: '',
            });
            setUploadDocumentType('supporting');
        } catch (err: any) {
            console.error('Error uploading document:', err);
            setPublishError(err.message || 'Failed to upload document');
        } finally {
            setUploadingApproverDocument(false);
            setUploadingDocument(false);
        }
    };

    // Fetch documents when switching to documents tab or when request loads
    const fetchDocuments = async () => {
        if (!id) return;

        setLoadingDocuments(true);
        try {
            const response = await fetch(`/api/requests/${id}/documents`);
            if (response.ok) {
                const data = await response.json();
                setDocuments(data.documents || []);
            } else {
                console.error('Failed to fetch documents:', response.status);
            }
        } catch (err) {
            console.error('Error fetching documents:', err);
        } finally {
            setLoadingDocuments(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'documents' && id) {
            fetchDocuments();
        }
    }, [id, activeTab]);

    const handleDownloadPdf = () => {
        if (!id) return;
        window.open(`/api/requests/${id}/pdf`, '_blank');
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !id) return;

        setUploadingDocument(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`/api/requests/${id}/documents`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload document');
            }

            // Refresh the documents list after successful upload
            await fetchDocuments();
        } catch (err: any) {
            console.error('Error uploading document:', err);
            setPublishError(err.message || 'Failed to upload document');
        } finally {
            setUploadingDocument(false);
            e.target.value = '';
        }
    };

    const handleDocumentDownload = async (doc: any) => {
        if (doc.download_url) {
            window.open(doc.download_url, '_blank');
        }
    };

    const handleDocumentDelete = async (documentId: string) => {
        if (!id || !confirm('Are you sure you want to delete this document?')) return;

        try {
            const response = await fetch(`/api/requests/${id}/documents?documentId=${documentId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete document');
            }

            setDocuments(prev => prev.filter(d => d.id !== documentId));
        } catch (err: any) {
            console.error('Error deleting document:', err);
            setPublishError(err.message || 'Failed to delete document');
        }
    };

    if (status === 'loading' || loading) {
        return (
            <AppLayout title="Request Details">
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                    <div className="relative w-16 h-16">
                        <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-200 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-full h-full border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="mt-4 text-gray-400 font-medium animate-pulse">Loading request details...</p>
                </div>
            </AppLayout>
        );
    }

    if (error || !request) {
        return (
            <AppLayout title="Error">
                <div className="p-6 max-w-4xl mx-auto">
                    <Card className="text-center py-16 px-8">
                        <div className="w-20 h-20 bg-danger-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-text-primary mb-2">Request Not Found</h3>
                        <p className="text-text-secondary max-w-md mx-auto mb-8">{error || "The request you are looking for specific request ID does not exist or you do not have permission to view it."}</p>
                        <Button variant="primary" onClick={() => router.push('/requests/my-requests')}>
                            Back to My Requests
                        </Button>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    // Use actualStatus for display to handle incorrectly marked requests
    const statusInfo = statusConfig[actualStatus || request.status] || statusConfig.pending;

    const priority = request.metadata?.priority || 'normal';
    const isCritical = priority === 'critical';
    const isHighPriority = priority === 'high';

    return (
        <AppLayout title={`Request #${request.id.substring(0, 8)}`}>
            <style dangerouslySetInnerHTML={{ __html: pulseKeyframes }} />
            <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

                {/* Priority Alert Banner */}
                {(isCritical || isHighPriority) && (
                    <div
                        className={`relative rounded-2xl border-2 p-4 flex items-center gap-4 ${
                            isCritical 
                                ? 'bg-red-50 border-red-300' 
                                : 'bg-orange-50 border-orange-300'
                        }`}
                        style={{
                            animation: isCritical 
                                ? `pulse-red-header ${CRITICAL_ANIMATION_DURATION}s ease-in-out infinite`
                                : `pulse-orange-header ${HIGH_ANIMATION_DURATION}s ease-in-out infinite`
                        }}
                    >
                        <div className="w-16 h-16 flex-shrink-0">
                            <Lottie
                                animationData={isCritical ? criticalAnimation : urgentAnimation}
                                loop={true}
                                className="w-full h-full"
                            />
                        </div>
                        <div className="flex-1">
                            <h3 className={`text-lg font-bold ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
                                {isCritical ? '🚨 Critical Priority Request' : '⚠️ High Priority Request'}
                            </h3>
                            <p className={`text-sm ${isCritical ? 'text-red-600' : 'text-orange-600'}`}>
                                {isCritical 
                                    ? 'This request requires immediate attention and action.'
                                    : 'This request has been marked as high priority and needs urgent review.'
                                }
                            </p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl font-bold text-sm ${
                            isCritical 
                                ? 'bg-red-100 text-red-700 border border-red-200' 
                                : 'bg-orange-100 text-orange-700 border border-orange-200'
                        }`}>
                            {isCritical ? 'CRITICAL' : 'HIGH PRIORITY'}
                        </div>
                    </div>
                )}

                {/* Publish Error Alert */}
                {publishError && (
                    <Card className="bg-danger-50 border-danger-200 !p-4">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-danger-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-danger-700 text-sm">{publishError}</p>
                            <button
                                onClick={() => setPublishError(null)}
                                className="ml-auto text-danger-500 hover:text-danger-700"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </Card>
                )}

                {/* Top Navigation Breadcrumb */}
                <nav className="flex items-center text-sm text-text-secondary mb-2">
                    <Link href="/approvals" className="hover:text-primary-600 transition-colors flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Approval Tasks
                    </Link>
                    <span className="mx-2 text-gray-300">/</span>
                    <span className="text-text-primary font-medium truncate max-w-xs">{request.title}</span>
                </nav>

                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 ${statusInfo.bg} ${statusInfo.text}`}>
                                <div className="w-2 h-2 rounded-full bg-current" />
                                {statusInfo.label}
                            </span>
                            <span className="text-text-secondary text-sm">#{request.id.substring(0, 8)}</span>
                        </div>

                        <h1 className="text-3xl font-bold text-text-primary font-heading leading-tight mb-2">
                            {isEditing && editedRequest ? (
                                <Input
                                    value={editedRequest.title}
                                    onChange={(e) => setEditedRequest({ ...editedRequest, title: e.target.value })}
                                    className="!text-2xl !font-bold !py-3"
                                    placeholder="Request Title"
                                />
                            ) : (
                                request.title
                            )}
                        </h1>
                        <div className="text-text-secondary text-lg leading-relaxed max-w-3xl">
                            {isEditing && editedRequest ? (
                                <textarea
                                    value={editedRequest.description}
                                    onChange={(e) => setEditedRequest({ ...editedRequest, description: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent min-h-[100px]"
                                    placeholder="Description"
                                />
                            ) : (
                                request.description
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 flex-shrink-0">
                        {/* Delete button for creator's non-approved requests */}
                        {canDelete && (
                            <Button
                                variant="outline"
                                className="gap-2 bg-white text-danger-600 border-danger-200 hover:bg-danger-50"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                            </Button>
                        )}
                        <Button variant="outline" className="gap-2 bg-white" onClick={handleDownloadPdf}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            PDF
                        </Button>
                        {/* Edit Draft button - navigates to the form page */}
                        {canPublish && (
                            <Button
                                variant="outline"
                                className="gap-2 bg-white text-text-secondary border-gray-200 hover:bg-gray-50 hover:text-text-primary"
                                onClick={() => {
                                    // Navigate to the appropriate form with edit mode
                                    const requestType = request.metadata?.type || request.metadata?.requestType || 'capex';
                                    router.push(`/requests/new/${requestType}?edit=${id}`);
                                }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Edit Draft
                            </Button>
                        )}
                        {/* Publish button for draft requests */}
                        {canPublish && (
                            <Button
                                variant="primary"
                                className="gap-2 shadow-lg shadow-primary-500/20"
                                onClick={handlePublish}
                                disabled={publishing}
                                isLoading={publishing}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                {publishing ? 'Publishing...' : 'Publish Request'}
                            </Button>
                        )}
                        {/* Edit button for current approver (not watchers) - navigates to capex form */}
                        {canApproverEdit && (
                            <Button
                                variant="outline"
                                className="gap-2 bg-white text-text-secondary border-gray-200 hover:bg-gray-50 hover:text-text-primary"
                                onClick={() => {
                                    // Navigate to the capex form with edit mode
                                    const requestType = request.metadata?.type || 'capex';
                                    router.push(`/requests/new/${requestType}?edit=${id}&approver=true`);
                                }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Edit Request
                            </Button>
                        )}
                        {/* Review button for current approver */}
                        {isCurrentApprover && (
                            <Button
                                variant="primary"
                                className="gap-2 shadow-lg shadow-primary-500/20"
                                onClick={() => setShowReviewModal(true)}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Review Request
                            </Button>
                        )}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Details & Content */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Tabs */}
                        <div className="border-b border-gray-200">
                            <div className="flex gap-8">
                                {(['details', 'timeline', 'documents'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`
                      pb-4 px-1 text-sm font-medium border-b-2 transition-all capitalize
                      ${activeTab === tab
                                                ? 'border-primary-500 text-primary-600'
                                                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'}
                    `}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="min-h-[400px]">
                            {activeTab === 'details' && (() => {
                                // Get the form-specific data (handles nested capex, leave, etc.)
                                // Determine which metadata to use based on editing mode
                                const activeMetadata = isEditing && editedRequest 
                                    ? editedRequest.metadata 
                                    : (isApproverEditing && approverEditedRequest 
                                        ? approverEditedRequest.metadata 
                                        : request.metadata);
                                const formData = getFormData(activeMetadata);
                                const requestType = request.metadata?.type || 'approval';
                                const isAnyEditing = isEditing || isApproverEditing;
                                const handleFieldChange = isApproverEditing ? handleApproverMetadataChange : handleMetadataChange;

                                return (
                                    <div className="space-y-6">
                                        {/* Approver Editing Notice */}
                                        {isApproverEditing && (
                                            <Card className="!p-4 border-primary-200 bg-primary-50/50 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                                        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-primary-800">Editing as Approver</p>
                                                        <p className="text-sm text-primary-600">Your changes will be tracked and visible to the requester and other viewers.</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        )}

                                        {/* Watcher View Notice */}
                                        {isWatcher && !isCreator && !canApproverEdit && (
                                            <Card className="!p-4 border-gray-200 bg-gray-50 shadow-sm">
                                                <div className="flex items-center gap-3 text-gray-500">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    <div>
                                                        <p className="font-medium text-gray-600">Viewing as Watcher</p>
                                                        <p className="text-sm">You can track this request but cannot make changes.</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        )}

                                        {/* Project Overview Card */}
                                        {formData.projectName && (
                                            <Card className="!p-0 overflow-hidden border-primary-100 shadow-sm bg-gradient-to-br from-primary-50 via-white to-accent/5">
                                                <div className="p-6">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Project</span>
                                                            <h2 className="text-2xl font-bold text-text-primary mt-1 font-heading">
                                                                {isAnyEditing ? (
                                                                    <Input
                                                                        value={formData.projectName || ''}
                                                                        onChange={e => handleFieldChange('projectName', e.target.value)}
                                                                        className="mt-1"
                                                                    />
                                                                ) : formData.projectName}
                                                            </h2>
                                                            {formData.unit && (
                                                                <p className="text-text-secondary mt-1">
                                                                    {isAnyEditing ? (
                                                                        <Input
                                                                            value={formData.unit || ''}
                                                                            onChange={e => handleFieldChange('unit', e.target.value)}
                                                                            className="mt-1"
                                                                        />
                                                                    ) : formData.unit}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {formData.amount && (
                                                            <div className="text-right">
                                                                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Amount</span>
                                                                <div className="text-2xl font-bold text-text-primary mt-1">
                                                                    {isAnyEditing ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <select
                                                                                value={formData.currency || 'USD'}
                                                                                onChange={(e) => handleFieldChange('currency', e.target.value)}
                                                                                className="text-lg font-bold bg-transparent border-b border-gray-300 focus:border-primary-500 focus:outline-none py-1 w-20"
                                                                            >
                                                                                <option value="USD">USD</option>
                                                                                <option value="ZIG">ZIG</option>
                                                                            </select>
                                                                            <Input
                                                                                type="number"
                                                                                value={formData.amount}
                                                                                onChange={e => handleFieldChange('amount', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                                                className="!py-1"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <>{formData.currency || 'USD'} {formatFieldValue('amount', formData.amount)}</>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        )}

                                        {/* Financial Metrics Card (for CAPEX) */}
                                        {(formData.npv || formData.irr || formData.paybackPeriod || formData.budgetType || formData.fundingSource || formData.evaluation) && (
                                            <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                                                    <h3 className="font-semibold text-text-primary font-heading">Financial Information</h3>
                                                </div>
                                                <div className="p-6">
                                                    {/* Key Metrics Row */}
                                                    {(formData.npv || formData.irr || formData.paybackPeriod) && (
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                                            {formData.npv && (
                                                                <div className="text-center p-4 bg-success-50 rounded-lg">
                                                                    <div className="text-xs font-semibold text-success-600 uppercase tracking-wider">NPV</div>
                                                                    <div className="text-2xl font-bold text-success-700 mt-1">
                                                                        {formData.currency || 'USD'} {formatFieldValue('npv', formData.npv)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {formData.irr && (
                                                                <div className="text-center p-4 bg-primary-50 rounded-lg">
                                                                    <div className="text-xs font-semibold text-primary-600 uppercase tracking-wider">IRR</div>
                                                                    <div className="text-2xl font-bold text-primary-700 mt-1">{formData.irr}%</div>
                                                                </div>
                                                            )}
                                                            {formData.paybackPeriod && (
                                                                <div className="text-center p-4 bg-accent/10 rounded-lg">
                                                                    <div className="text-xs font-semibold text-accent uppercase tracking-wider">Payback Period</div>
                                                                    <div className="text-2xl font-bold text-accent mt-1">{formatFieldValue('paybackPeriod', formData.paybackPeriod)}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Additional Financial Details */}
                                                    {(formData.budgetType || formData.fundingSource || formData.evaluation) && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                                                            {formData.budgetType && (
                                                                <div className="group">
                                                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                                                        Budget Type
                                                                    </label>
                                                                    <div className="text-text-primary font-medium text-base">
                                                                        {formatFieldValue('budgetType', formData.budgetType)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {formData.fundingSource && (
                                                                <div className="group">
                                                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                                                        Funding Source
                                                                    </label>
                                                                    <div className="text-text-primary font-medium text-base">
                                                                        {formData.fundingSource}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {formData.evaluation && (
                                                                <div className="group md:col-span-2">
                                                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                                                        Financial Evaluation
                                                                    </label>
                                                                    <div className="text-text-primary font-medium text-base whitespace-pre-wrap">
                                                                        {formData.evaluation}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        )}

                                        {/* Request Details Card */}
                                        <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                                                <h3 className="font-semibold text-text-primary font-heading">Request Details</h3>
                                            </div>
                                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Request Type */}
                                                <div className="group">
                                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                                        Request Type
                                                    </label>
                                                    <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2 capitalize">
                                                        {requestType}
                                                    </div>
                                                </div>
                                                {/* Priority */}
                                                {request.metadata?.priority && (
                                                    <div className="group">
                                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                                            Priority
                                                        </label>
                                                        <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">
                                                            {formatFieldValue('priority', request.metadata.priority)}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Form-specific fields */}
                                                {Object.entries(formData)
                                                    .filter(([key]) => !['projectName', 'npv', 'irr', 'paybackPeriod', 'amount', 'currency', 'unit', 'justification', 'description', 'budgetType', 'fundingSource', 'evaluation'].includes(key))
                                                    .filter(([, value]) => {
                                                        if (value === null || value === undefined || typeof value === 'object') return false;
                                                        if (!isAnyEditing && value === '') return false;
                                                        return true;
                                                    })
                                                    .map(([key, value]) => (
                                                        <div key={key} className="group">
                                                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block group-hover:text-primary-600 transition-colors">
                                                                {getFieldLabel(key)}
                                                            </label>
                                                            <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">
                                                                {isAnyEditing ? (
                                                                    <Input
                                                                        value={formData[key] || ''}
                                                                        onChange={(e) => handleFieldChange(key, e.target.value)}
                                                                        className="!py-1 !text-base"
                                                                    />
                                                                ) : (
                                                                    formatFieldValue(key, value)
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                                {/* Document Justification from top-level metadata */}
                                                {request.metadata?.documentJustification && (
                                                    <div className="group md:col-span-2">
                                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">
                                                            Document Justification
                                                        </label>
                                                        <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">
                                                            {request.metadata.documentJustification}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>

                                        {/* Justification Card */}
                                        {(formData.justification || request.description) && (
                                            <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                                                    <h3 className="font-semibold text-text-primary font-heading">Justification & Notes</h3>
                                                </div>
                                                <div className="p-6 text-text-primary leading-relaxed whitespace-pre-wrap">
                                                    {formData.justification || request.description || 'No justification provided.'}
                                                </div>
                                            </Card>
                                        )}

                                    </div>
                                );
                            })()}

                            {activeTab === 'timeline' && (
                                <div className="space-y-6">
                                    <ApprovalTimeline
                                        request={isEditing && editedRequest ? editedRequest : request}
                                        isEditing={isEditing && canPublish}
                                        onApproversChange={(approverIds) => {
                                            if (editedRequest) {
                                                setEditedRequest({
                                                    ...editedRequest,
                                                    metadata: {
                                                        ...editedRequest.metadata,
                                                        approvers: approverIds,
                                                    },
                                                });
                                            }
                                        }}
                                    />

                                    {/* Modifications History Section */}
                                    {modifications.length > 0 && (
                                        <Card className="!p-0 overflow-hidden border-amber-100 shadow-sm">
                                            <div className="bg-amber-50/50 px-6 py-4 border-b border-amber-100 flex items-center justify-between">
                                                <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Modification History
                                                </h3>
                                                <span className="text-sm text-amber-600 font-medium">{modifications.length} change{modifications.length !== 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                                                {modifications.map((mod: any) => (
                                                    <div key={mod.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                                                        <img
                                                            src={mod.modified_by?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(mod.modified_by?.display_name || 'User')}&background=random&size=32`}
                                                            alt={mod.modified_by?.display_name || 'User'}
                                                            className="w-8 h-8 rounded-full object-cover border border-white shadow-sm flex-shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-semibold text-gray-900 text-sm">{mod.modified_by?.display_name || 'Unknown User'}</span>
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                    mod.modification_type === 'field_edit' 
                                                                        ? 'bg-blue-100 text-blue-700' 
                                                                        : mod.modification_type === 'document_upload'
                                                                            ? 'bg-green-100 text-green-700'
                                                                            : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                    {mod.modification_type === 'field_edit' && 'Edited Field'}
                                                                    {mod.modification_type === 'document_upload' && 'Uploaded Document'}
                                                                    {mod.modification_type === 'document_delete' && 'Deleted Document'}
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-gray-600 mt-1">
                                                                {mod.modification_type === 'field_edit' && (
                                                                    <>
                                                                        Changed <span className="font-medium text-gray-800">{getFieldLabel(mod.field_name)}</span>
                                                                        {mod.old_value && (
                                                                            <> from <span className="text-gray-500 line-through">{mod.old_value}</span></>
                                                                        )}
                                                                        {mod.new_value && (
                                                                            <> to <span className="font-medium text-gray-800">{mod.new_value}</span></>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {mod.modification_type === 'document_upload' && (
                                                                    <>Uploaded <span className="font-medium text-gray-800">{mod.document_filename}</span></>
                                                                )}
                                                                {mod.modification_type === 'document_delete' && (
                                                                    <>Deleted <span className="font-medium text-gray-800">{mod.document_filename}</span></>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-400 mt-1">
                                                                {new Date(mod.created_at).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    )}

                                    {/* Watchers Section */}
                                    <WatchersCard watcherData={request.metadata?.watchers} />
                                </div>
                            )}

                            {activeTab === 'documents' && (() => {
                                // Get quotations and supporting documents from metadata
                                const quotations = Array.isArray(request.metadata?.quotations) ? request.metadata.quotations : [];
                                const supportingDocs = Array.isArray(request.metadata?.supportingDocuments) ? request.metadata.supportingDocuments : [];
                                
                                // Get additional documents uploaded directly (not in metadata)
                                const metadataFilenames = [
                                    ...quotations.map((q: any) => q.name),
                                    ...supportingDocs.map((d: any) => d.name)
                                ];
                                const additionalDocuments = documents.filter(doc => !metadataFilenames.includes(doc.filename));
                                
                                const hasDocuments = quotations.length > 0 || supportingDocs.length > 0 || additionalDocuments.length > 0;

                                // Helper to find matching uploaded document by filename
                                const findUploadedDocument = (filename: string) => {
                                    return documents.find(doc => doc.filename === filename);
                                };

                                // Helper to format file size
                                const formatFileSize = (bytes: number) => {
                                    if (!bytes) return 'Unknown size';
                                    if (bytes < 1024) return `${bytes} B`;
                                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                                };

                                // Helper to get file icon based on type
                                const getFileIcon = (type: string) => {
                                    if (type?.includes('pdf')) return (
                                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9.5c0 .28-.22.5-.5.5H8v2h1.5c.28 0 .5.22.5.5s-.22.5-.5.5H7.5a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5H10c.28 0 .5.22.5.5s-.22.5-.5.5H8v1.5h1.5c.28 0 .5.22.5.5zm4.5 2.5h-1v-5h1c1.1 0 2 .9 2 2v1c0 1.1-.9 2-2 2zm0-4v3c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1zm4.5 4h-2a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5h2c.28 0 .5.22.5.5s-.22.5-.5.5H18v1.5h1c.28 0 .5.22.5.5s-.22.5-.5.5h-1v2c.28 0 .5.22.5.5s-.22.5-.5.5z" />
                                        </svg>
                                    );
                                    if (type?.includes('image')) return (
                                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    );
                                    if (type?.includes('word') || type?.includes('doc')) return (
                                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM9.5 11h5c.28 0 .5.22.5.5s-.22.5-.5.5h-5a.5.5 0 0 1-.5-.5c0-.28.22-.5.5-.5zm0 2h5c.28 0 .5.22.5.5s-.22.5-.5.5h-5a.5.5 0 0 1-.5-.5c0-.28.22-.5.5-.5zm0 2h5c.28 0 .5.22.5.5s-.22.5-.5.5h-5a.5.5 0 0 1-.5-.5c0-.28.22-.5.5-.5z" />
                                        </svg>
                                    );
                                    return (
                                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    );
                                };

                                // Helper to handle document view/download
                                const handleViewDocument = (doc: any) => {
                                    if (doc.download_url) {
                                        window.open(doc.download_url, '_blank');
                                    }
                                };

                                if (loadingDocuments) {
                                    return (
                                        <Card className="!p-8 border-gray-200 shadow-sm">
                                            <div className="flex items-center justify-center py-8">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                                                <span className="ml-3 text-gray-500">Loading documents...</span>
                                            </div>
                                        </Card>
                                    );
                                }

                                return (
                                    <div className="space-y-6">
                                        {/* Upload Section - Show for creator or approver (not watchers) */}
                                        {(isCreator || canApproverEdit) && (
                                            <Card className={`!p-4 shadow-sm ${canApproverEdit ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'}`}>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-medium text-text-primary flex items-center gap-2">
                                                            Upload Documents
                                                            {canApproverEdit && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                                                                    Approver
                                                                </span>
                                                            )}
                                                        </h4>
                                                        <p className="text-sm text-text-secondary">
                                                            {canApproverEdit 
                                                                ? 'Upload additional documents as part of your review' 
                                                                : 'Add supporting files to this request'}
                                                        </p>
                                                    </div>
                                                    <label className="cursor-pointer">
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                                            onChange={handleFileSelect}
                                                            disabled={uploadingDocument || uploadingApproverDocument}
                                                        />
                                                        <Button
                                                            variant="primary"
                                                            className="gap-2"
                                                            disabled={uploadingDocument || uploadingApproverDocument}
                                                            isLoading={uploadingDocument || uploadingApproverDocument}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                                                            }}
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                            </svg>
                                                            {(uploadingDocument || uploadingApproverDocument) ? 'Uploading...' : 'Upload File'}
                                                        </Button>
                                                    </label>
                                                </div>
                                            </Card>
                                        )}

                                        {/* Watcher notice - they cannot upload */}
                                        {isWatcher && !isCreator && !canApproverEdit && (
                                            <Card className="!p-4 border-gray-200 shadow-sm bg-gray-50">
                                                <div className="flex items-center gap-3 text-gray-500">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    <div>
                                                        <p className="font-medium text-gray-600">Viewing as Watcher</p>
                                                        <p className="text-sm">You can view documents but cannot upload or modify them.</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        )}

                                        {/* Quotations Section */}
                                        {quotations.length > 0 && (
                                            <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                                <div className="bg-emerald-50/50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
                                                    <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
                                                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        Quotations
                                                    </h3>
                                                    <span className="text-sm text-emerald-600 font-medium">{quotations.length} uploaded</span>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    {quotations.map((quotation: any, index: number) => {
                                                        const uploadedDoc = findUploadedDocument(quotation.name);
                                                        const downloadUrl = uploadedDoc?.download_url;
                                                        
                                                        return (
                                                            <div key={index} className={`p-4 rounded-xl border transition-all ${quotation.isSelectedSupplier ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <div className="flex items-start gap-3 flex-1">
                                                                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${quotation.isSelectedSupplier ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                                                            <svg className={`w-6 h-6 ${quotation.isSelectedSupplier ? 'text-emerald-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                            </svg>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <p className="font-semibold text-gray-900">{quotation.name}</p>
                                                                                {quotation.isSelectedSupplier && (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                        </svg>
                                                                                        Selected Supplier
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(quotation.size)}</p>
                                                                            {quotation.uploadedBy && (
                                                                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                                    </svg>
                                                                                    Uploaded by {quotation.uploadedBy.name}
                                                                                    {quotation.uploadedBy.isApprover && (
                                                                                        <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-primary-100 text-primary-700">Approver</span>
                                                                                    )}
                                                                                    {quotation.uploadedAt && (
                                                                                        <span className="ml-1">• {new Date(quotation.uploadedAt).toLocaleDateString('en-US')}</span>
                                                                                    )}
                                                                                </p>
                                                                            )}
                                                                            {quotation.supplierName && (
                                                                                <p className="text-sm text-gray-600 mt-2">
                                                                                    <span className="font-medium">Supplier:</span> {quotation.supplierName}
                                                                                </p>
                                                                            )}
                                                                            {quotation.description && (
                                                                                <p className="text-sm text-gray-500 mt-1">{quotation.description}</p>
                                                                            )}
                                                                            {quotation.isSelectedSupplier && quotation.selectionReason && (
                                                                                <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-100">
                                                                                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Selection Reason</p>
                                                                                    <p className="text-sm text-gray-700">{quotation.selectionReason}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        {downloadUrl && (
                                                                            <>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="bg-white"
                                                                                    onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                                                                                >
                                                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                    </svg>
                                                                                    View
                                                                                </Button>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="bg-white"
                                                                                    onClick={() => {
                                                                                        const link = document.createElement('a');
                                                                                        link.href = downloadUrl;
                                                                                        link.download = quotation.name;
                                                                                        document.body.appendChild(link);
                                                                                        link.click();
                                                                                        document.body.removeChild(link);
                                                                                    }}
                                                                                >
                                                                                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                                    </svg>
                                                                                    Download
                                                                                </Button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Quotation Justification */}
                                                {request.metadata?.quotationJustification && (
                                                    <div className="px-4 pb-4">
                                                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                                            <div className="flex items-start gap-3">
                                                                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                                </svg>
                                                                <div>
                                                                    <p className="text-sm font-semibold text-amber-800">Quotation Justification</p>
                                                                    <p className="text-sm text-amber-700 mt-1">{request.metadata.quotationJustification}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </Card>
                                        )}

                                        {/* Supporting Documents Section */}
                                        {supportingDocs.length > 0 && (
                                            <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                                <div className="bg-blue-50/50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                                                    <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                        </svg>
                                                        Supporting Documents
                                                    </h3>
                                                    <span className="text-sm text-blue-600 font-medium">{supportingDocs.length} uploaded</span>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    {supportingDocs.map((doc: any, index: number) => {
                                                        const uploadedDoc = findUploadedDocument(doc.name);
                                                        const downloadUrl = uploadedDoc?.download_url;
                                                        
                                                        return (
                                                            <div key={index} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                        {getFileIcon(doc.type || '')}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-medium text-gray-900 truncate">{doc.name}</p>
                                                                        <p className="text-xs text-gray-500">{formatFileSize(doc.size)}</p>
                                                                        {doc.uploadedBy && (
                                                                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                                </svg>
                                                                                Uploaded by {doc.uploadedBy.name}
                                                                                {doc.uploadedBy.isApprover && (
                                                                                    <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-primary-100 text-primary-700">Approver</span>
                                                                                )}
                                                                                {doc.uploadedAt && (
                                                                                    <span className="ml-1">• {new Date(doc.uploadedAt).toLocaleDateString('en-US')}</span>
                                                                                )}
                                                                            </p>
                                                                        )}
                                                                        {doc.description && (
                                                                            <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                                    {downloadUrl && (
                                                                        <>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="bg-white"
                                                                                onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                                                                            >
                                                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                </svg>
                                                                                View
                                                                            </Button>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="bg-white"
                                                                                onClick={() => {
                                                                                    const link = document.createElement('a');
                                                                                    link.href = downloadUrl;
                                                                                    link.download = doc.name;
                                                                                    document.body.appendChild(link);
                                                                                    link.click();
                                                                                    document.body.removeChild(link);
                                                                                }}
                                                                            >
                                                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                                </svg>
                                                                                Download
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Card>
                                        )}

                                        {/* Additional Uploaded Documents Section */}
                                        {additionalDocuments.length > 0 && (
                                            <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                                <div className="bg-purple-50/50 px-6 py-4 border-b border-purple-100 flex items-center justify-between">
                                                    <h3 className="font-semibold text-purple-800 flex items-center gap-2">
                                                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                        </svg>
                                                        Additional Documents
                                                    </h3>
                                                    <span className="text-sm text-purple-600 font-medium">{additionalDocuments.length} uploaded</span>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    {additionalDocuments.map((doc: any) => (
                                                        <div key={doc.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                    {getFileIcon(doc.mime_type || '')}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                                                                    <p className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</p>
                                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                                        Uploaded {new Date(doc.created_at).toLocaleDateString('en-US')} at {new Date(doc.created_at).toLocaleTimeString('en-US')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                                {doc.download_url && (
                                                                    <>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="bg-white"
                                                                            onClick={() => window.open(doc.download_url, '_blank', 'noopener,noreferrer')}
                                                                        >
                                                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                            </svg>
                                                                            View
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="bg-white"
                                                                            onClick={() => {
                                                                                const link = document.createElement('a');
                                                                                link.href = doc.download_url;
                                                                                link.download = doc.filename;
                                                                                document.body.appendChild(link);
                                                                                link.click();
                                                                                document.body.removeChild(link);
                                                                            }}
                                                                        >
                                                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                            </svg>
                                                                            Download
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        )}

                                        {/* Empty State */}
                                        {!hasDocuments && (
                                            <Card className="text-center py-12 border-dashed border-2 border-gray-200 bg-gray-50/50 shadow-none">
                                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                                                    <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                    </svg>
                                                </div>
                                                <h3 className="text-lg font-medium text-text-primary">No Documents Yet</h3>
                                                <p className="text-text-secondary">Upload files using the button above</p>
                                            </Card>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="space-y-6">

                        {/* Requester Card */}
                        <Card className="!p-6 border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">Requester</h3>
                            <div className="flex items-center gap-4">
                                <img
                                    src={request.creator.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(request.creator.display_name || 'User')}&background=random`}
                                    alt={request.creator.display_name || 'User'}
                                    className="w-14 h-14 rounded-full border-2 border-white shadow-sm object-cover"
                                />
                                <div>
                                    <div className="font-bold text-text-primary text-lg">{request.creator.display_name}</div>
                                    <div className="text-sm text-text-secondary">{request.creator.department?.name || 'No Department'}</div>
                                    <div className="text-xs text-primary-600 mt-1">{request.creator.email}</div>
                                </div>
                            </div>
                        </Card>

                        {/* Current Step Card */}
                        <Card className="!p-6 border-primary-100 bg-gradient-to-br from-white to-primary-50/50 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                            </div>

                            <h3 className="text-sm font-bold text-primary-500 uppercase tracking-widest mb-2">Current Step</h3>
                            <div className="text-2xl font-bold text-text-primary mb-1">
                                {request.request_steps?.find((s) => s.step_index + 1 === request.current_step)?.approver_role || (request.current_step > request.total_steps ? 'Completed' : 'Pending')}
                            </div>
                            {request.current_approver ? (
                                <div className="flex items-center gap-2 mt-4 p-3 bg-white/60 rounded-lg backdrop-blur-sm border border-white/50">
                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
                                        {request.current_approver.display_name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <div className="text-xs text-text-secondary">Waiting for</div>
                                        <div className="text-sm font-semibold text-text-primary">{request.current_approver.display_name}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-4 text-sm text-text-secondary">No active approver pending.</div>
                            )}
                        </Card>

                        {/* Meta Info */}
                        <Card className="!p-0 border-gray-200 overflow-hidden text-sm">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <span className="text-text-secondary">Status</span>
                                <span className="font-medium text-text-primary">{statusInfo.label}</span>
                            </div>
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                                <span className="text-text-secondary">Created</span>
                                <span className="font-medium text-text-primary">{new Date(request.created_at).toLocaleDateString('en-US')}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center">
                                <span className="text-text-secondary">Last Updated</span>
                                <span className="font-medium text-text-primary">{new Date(request.updated_at).toLocaleDateString('en-US')}</span>
                            </div>
                        </Card>

                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-6 h-6 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary">Delete Request</h3>
                                    <p className="text-sm text-text-secondary">This action cannot be undone</p>
                                </div>
                            </div>
                            <p className="text-text-secondary mb-6">
                                Are you sure you want to delete "<span className="font-medium text-text-primary">{request.title}</span>"?
                                All associated data including documents and approval steps will be permanently removed.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={deleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    isLoading={deleting}
                                >
                                    {deleting ? 'Deleting...' : 'Delete Request'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Review/Approval Modal */}
                {showReviewModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Review Request</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">#{request.id.slice(0, 8)}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowReviewModal(false);
                                        setReviewComment('');
                                        setReviewError(null);
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-semibold text-gray-900">{request.title}</h3>
                                    <p className="text-gray-600 leading-relaxed text-sm">
                                        {request.description || 'No description provided.'}
                                    </p>
                                </div>

                                {/* Request Summary */}
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Submitted</div>
                                        <div className="text-sm font-medium text-gray-900 mt-0.5">
                                            {new Date(request.created_at).toLocaleDateString('en-US')}
                                        </div>
                                    </div>
                                    {request.metadata?.amount && (
                                        <div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Amount</div>
                                            <div className="text-sm font-medium text-gray-900 mt-0.5">
                                                {request.metadata?.currency || 'USD'} {Number(request.metadata.amount).toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Requester</div>
                                        <div className="text-sm font-medium text-gray-900 mt-0.5">
                                            {request.creator?.display_name || 'Unknown'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">Department</div>
                                        <div className="text-sm font-medium text-gray-900 mt-0.5">
                                            {request.creator?.department?.name || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                {/* Signature Preview */}
                                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                                    <div className="text-xs text-primary-600 uppercase tracking-wide font-medium mb-2">Your Signature</div>
                                    {userSignatureUrl ? (
                                        <div className="bg-white rounded-lg p-3 border border-primary-100">
                                            <img
                                                src={userSignatureUrl}
                                                alt="Your signature"
                                                className="h-16 mx-auto object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-lg p-4 border border-primary-100 text-center">
                                            <p className="text-sm text-gray-500">No signature found.</p>
                                            <a href="/profile" className="text-sm text-primary-600 hover:underline">
                                                Set up your signature →
                                            </a>
                                        </div>
                                    )}
                                    <p className="text-xs text-primary-600 mt-2">
                                        Your signature will be attached to this approval.
                                    </p>
                                </div>

                                {reviewError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                        <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-sm text-red-600 font-medium">{reviewError}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Review Comment <span className="text-gray-400 font-normal">(Required for rejection)</span>
                                    </label>
                                    <textarea
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        placeholder="Enter your feedback or reasoning here..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-shadow"
                                        rows={4}
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3 rounded-b-2xl">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowReviewModal(false);
                                        setReviewComment('');
                                        setReviewError(null);
                                    }}
                                    disabled={reviewProcessing}
                                    className="bg-white hover:bg-gray-50"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => handleApprovalAction('reject')}
                                    disabled={reviewProcessing}
                                    className="min-w-[5rem]"
                                >
                                    {reviewProcessing ? '...' : 'Reject'}
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => handleApprovalAction('approve')}
                                    disabled={reviewProcessing || !userSignatureUrl}
                                    className="min-w-[6rem]"
                                >
                                    {reviewProcessing ? 'Processing...' : 'Approve'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Document Upload Modal */}
                {showUploadModal && uploadFile && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Upload Document</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">Add details about your document</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowUploadModal(false);
                                        setUploadFile(null);
                                        setUploadMetadata({
                                            description: '',
                                            supplierName: '',
                                            isSelectedSupplier: false,
                                            selectionReason: '',
                                        });
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* File Info */}
                                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{uploadFile.name}</p>
                                        <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>

                                {/* Document Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setUploadDocumentType('quotation')}
                                            className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                                                uploadDocumentType === 'quotation'
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                            }`}
                                        >
                                            <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="text-sm font-medium">Quotation</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setUploadDocumentType('supporting')}
                                            className={`flex-1 p-3 rounded-xl border-2 transition-all ${
                                                uploadDocumentType === 'supporting'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                            }`}
                                        >
                                            <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                            </svg>
                                            <span className="text-sm font-medium">Supporting Doc</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                        placeholder="Brief description of this document..."
                                        value={uploadMetadata.description}
                                        onChange={(e) => setUploadMetadata(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                {/* Quotation-specific fields */}
                                {uploadDocumentType === 'quotation' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Name</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                                placeholder="Name of the supplier..."
                                                value={uploadMetadata.supplierName}
                                                onChange={(e) => setUploadMetadata(prev => ({ ...prev, supplierName: e.target.value }))}
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                                            <input
                                                type="checkbox"
                                                id="isSelectedSupplier"
                                                checked={uploadMetadata.isSelectedSupplier}
                                                onChange={(e) => setUploadMetadata(prev => ({ ...prev, isSelectedSupplier: e.target.checked }))}
                                                className="w-5 h-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <label htmlFor="isSelectedSupplier" className="flex-1">
                                                <span className="font-medium text-emerald-800">This is the selected supplier</span>
                                                <p className="text-xs text-emerald-600 mt-0.5">Mark if this quotation is from the chosen supplier</p>
                                            </label>
                                        </div>

                                        {uploadMetadata.isSelectedSupplier && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Selection Reason</label>
                                                <textarea
                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                                                    rows={3}
                                                    placeholder="Why was this supplier selected?"
                                                    value={uploadMetadata.selectionReason}
                                                    onChange={(e) => setUploadMetadata(prev => ({ ...prev, selectionReason: e.target.value }))}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setShowUploadModal(false);
                                        setUploadFile(null);
                                        setUploadMetadata({
                                            description: '',
                                            supplierName: '',
                                            isSelectedSupplier: false,
                                            selectionReason: '',
                                        });
                                    }}
                                    disabled={uploadingDocument || uploadingApproverDocument}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleUploadWithMetadata}
                                    disabled={uploadingDocument || uploadingApproverDocument}
                                    isLoading={uploadingDocument || uploadingApproverDocument}
                                >
                                    {(uploadingDocument || uploadingApproverDocument) ? 'Uploading...' : 'Upload Document'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
