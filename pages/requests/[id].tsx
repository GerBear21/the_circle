import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button, Input } from '../../components/ui';
import Link from 'next/link';

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
        status: 'pending' | 'approved' | 'rejected' | 'skipped';
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
    pending: { label: 'Pending', bg: 'bg-warning-50', text: 'text-warning-700', icon: 'clock' },
    in_review: { label: 'In Review', bg: 'bg-primary-50', text: 'text-primary-700', icon: 'refresh' },
    approved: { label: 'Approved', bg: 'bg-success-50', text: 'text-success-700', icon: 'check-circle' },
    rejected: { label: 'Rejected', bg: 'bg-danger-50', text: 'text-danger-700', icon: 'x-circle' },
    withdrawn: { label: 'Withdrawn', bg: 'bg-gray-50', text: 'text-text-secondary', icon: 'minus-circle' },
    draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-text-secondary', icon: 'document' },
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
    const [allUsers, setAllUsers] = useState<Array<{ id: string; display_name: string; email: string }>>([]);
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
            <Card className="!p-8 border-gray-200 shadow-sm">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    <span className="ml-3 text-gray-500">Loading approvers...</span>
                </div>
            </Card>
        );
    }

    // Calculate progress
    const approvedCount = approvers.filter(a => a.status === 'approved').length;
    const rejectedCount = approvers.filter(a => a.status === 'rejected').length;
    const pendingCount = approvers.filter(a => a.status === 'pending').length;

    // Render edit mode UI for adding approvers
    const renderEditControls = () => {
        if (!isEditing) return null;

        return (
            <div className="mb-6 p-4 bg-primary-50 rounded-lg border border-primary-100">
                <h4 className="text-sm font-medium text-primary-700 mb-3">Add Approvers</h4>
                <div className="relative">
                    <input
                        type="text"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Search by name or email..."
                        value={approverSearch}
                        onChange={(e) => {
                            setApproverSearch(e.target.value);
                            setShowApproverDropdown(true);
                        }}
                        onFocus={() => setShowApproverDropdown(true)}
                    />
                    {showApproverDropdown && approverSearch && filteredUsers.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredUsers.slice(0, 5).map(user => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                                    onClick={() => handleAddApprover(user.id)}
                                >
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.display_name)}&background=random&size=32`}
                                        alt={user.display_name}
                                        className="w-8 h-8 rounded-full"
                                    />
                                    <div>
                                        <div className="font-medium text-gray-900">{user.display_name}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </div>
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
            <Card className="!p-6 border-gray-200 shadow-sm">
                {renderEditControls()}
                <div className="text-center py-8 text-gray-400 italic">
                    {isEditing ? 'Search and add approvers above' : 'No approvers assigned to this request.'}
                </div>
            </Card>
        );
    }

    return (
        <Card className="!p-0 border-gray-200 shadow-sm overflow-hidden">
            {/* Progress Header */}
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-text-primary font-heading">
                        {isEditing ? 'Edit Approvers' : 'Approval Progress'}
                    </h3>
                    {!isEditing && (
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-success-500"></div>
                                <span className="text-text-secondary">{approvedCount} Approved</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-warning-500"></div>
                                <span className="text-text-secondary">{pendingCount} Pending</span>
                            </span>
                            {rejectedCount > 0 && (
                                <span className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-danger-500"></div>
                                    <span className="text-text-secondary">{rejectedCount} Rejected</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {/* Progress Bar - only show when not editing */}
                {!isEditing && (
                    <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-success-500 to-success-400 transition-all duration-500"
                            style={{ width: `${(approvedCount / approvers.length) * 100}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Approvers List */}
            <div className="p-6">
                {renderEditControls()}
                <div className="relative">
                    {/* Vertical Line */}
                    <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-gray-100" />

                    <div className="space-y-4">
                        {approvers.map((approver, index) => {
                            const isApproved = approver.status === 'approved';
                            const isRejected = approver.status === 'rejected';
                            const isPending = approver.status === 'pending';
                            const isCurrentStep = isPending && index === approvedCount;

                            let statusColor = 'bg-gray-100 text-gray-400 border-gray-200';
                            let statusBg = 'bg-gray-50';
                            let statusText = 'Awaiting';

                            if (isApproved) {
                                statusColor = 'bg-success-100 text-success-600 border-success-200';
                                statusBg = 'bg-success-50';
                                statusText = 'Approved';
                            } else if (isRejected) {
                                statusColor = 'bg-danger-100 text-danger-600 border-danger-200';
                                statusBg = 'bg-danger-50';
                                statusText = 'Rejected';
                            } else if (isCurrentStep && !isEditing) {
                                statusColor = 'bg-primary-100 text-primary-600 border-primary-200 ring-4 ring-primary-50';
                                statusBg = 'bg-primary-50';
                                statusText = 'Current';
                            }

                            return (
                                <div key={approver.id} className="relative flex items-start gap-4">
                                    {/* Step Node */}
                                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 bg-white transition-all ${statusColor}`}>
                                        {isApproved ? (
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : isRejected ? (
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        ) : (
                                            <span className="font-bold text-lg">{index + 1}</span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className={`flex-1 p-4 rounded-lg ${statusBg} border border-gray-100`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(approver.display_name)}&background=random&size=40`}
                                                    alt={approver.display_name}
                                                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                                                />
                                                <div>
                                                    <h4 className="font-bold text-text-primary">{approver.display_name}</h4>
                                                    <p className="text-sm text-text-secondary">{approver.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveApprover(index, 'up')}
                                                            disabled={index === 0}
                                                            className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                            title="Move up"
                                                        >
                                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleMoveApprover(index, 'down')}
                                                            disabled={index === approvers.length - 1}
                                                            className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                            title="Move down"
                                                        >
                                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveApprover(approver.id)}
                                                            className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-500 transition-colors"
                                                            title="Remove approver"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${isApproved ? 'bg-success-100 text-success-700' :
                                                        isRejected ? 'bg-danger-100 text-danger-700' :
                                                            isCurrentStep ? 'bg-primary-100 text-primary-700' :
                                                                'bg-gray-100 text-text-secondary'
                                                        }`}>
                                                        {statusText}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {!isEditing && approver.signed_at && (
                                            <p className="text-xs text-text-secondary mt-2">
                                                {isApproved ? 'Approved' : 'Responded'} on {new Date(approver.signed_at).toLocaleString()}
                                            </p>
                                        )}

                                        {!isEditing && approver.comment && (
                                            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100 text-sm text-text-primary">
                                                <span className="font-medium text-text-secondary">Comment: </span>
                                                "{approver.comment}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
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

    const currentUserId = (session?.user as any)?.id;
    const isCreator = request?.creator?.id === currentUserId;
    const isDraft = request?.status === 'draft';
    const canPublish = isCreator && isDraft;
    const canDelete = isCreator && request?.status !== 'approved';

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
        }
    }, [request]);

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

    const statusInfo = statusConfig[request.status] || statusConfig.pending;

    return (
        <AppLayout title={`Request #${request.id.substring(0, 8)}`}>
            <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

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
                    <Link href="/requests/my-requests" className="hover:text-primary-600 transition-colors flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Requests
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
                        {/* Save as Draft / Edit Draft button */}
                        {canPublish && (
                            !isEditing ? (
                                <Button
                                    variant="outline"
                                    className="gap-2 bg-white text-text-secondary border-gray-200 hover:bg-gray-50 hover:text-text-primary"
                                    onClick={() => setIsEditing(true)}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    Edit Draft
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="gap-2 bg-white text-text-secondary border-gray-200 hover:bg-gray-50"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditedRequest(JSON.parse(JSON.stringify(request)));
                                        }}
                                        disabled={savingDraft || publishing}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        className="gap-2 shadow-lg shadow-primary-500/20"
                                        onClick={handleSaveDraft}
                                        disabled={savingDraft || publishing}
                                        isLoading={savingDraft}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        {savingDraft ? 'Saving...' : 'Save Draft'}
                                    </Button>
                                </div>
                            )
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
                        {/* Conditional Action Buttons based on role would go here */}
                        {request.status === 'in_review' && (
                            <>
                                <Button variant="danger" className="gap-2">
                                    Reject
                                </Button>
                                <Button variant="primary" className="gap-2 shadow-lg shadow-primary-500/20">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Approve
                                </Button>
                            </>
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
                                // Get the form-specific data (handles nested capex, leave, etc.)
                                const formData = getFormData(isEditing && editedRequest ? editedRequest.metadata : request.metadata);
                                const requestType = request.metadata?.type || 'approval';

                                return (
                                    <div className="space-y-6">
                                        {/* Project Overview Card */}
                                        {formData.projectName && (
                                            <Card className="!p-0 overflow-hidden border-primary-100 shadow-sm bg-gradient-to-br from-primary-50 via-white to-accent/5">
                                                <div className="p-6">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Project</span>
                                                            <h2 className="text-2xl font-bold text-text-primary mt-1 font-heading">
                                                                {isEditing ? (
                                                                    <Input
                                                                        value={formData.projectName || ''}
                                                                        onChange={e => handleMetadataChange('projectName', e.target.value)}
                                                                        className="mt-1"
                                                                    />
                                                                ) : formData.projectName}
                                                            </h2>
                                                            {formData.unit && (
                                                                <p className="text-text-secondary mt-1">
                                                                    {isEditing ? (
                                                                        <Input
                                                                            value={formData.unit || ''}
                                                                            onChange={e => handleMetadataChange('unit', e.target.value)}
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
                                                                    {isEditing ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <select
                                                                                value={formData.currency || 'USD'}
                                                                                onChange={(e) => handleMetadataChange('currency', e.target.value)}
                                                                                className="text-lg font-bold bg-transparent border-b border-gray-300 focus:border-primary-500 focus:outline-none py-1 w-20"
                                                                            >
                                                                                <option value="USD">USD</option>
                                                                                <option value="ZIG">ZIG</option>
                                                                            </select>
                                                                            <Input
                                                                                type="number"
                                                                                value={formData.amount}
                                                                                onChange={e => handleMetadataChange('amount', e.target.value === '' ? '' : parseFloat(e.target.value))}
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
                                        {(formData.npv || formData.irr || formData.paybackPeriod) && (
                                            <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                                                    <h3 className="font-semibold text-text-primary font-heading">Financial Metrics</h3>
                                                </div>
                                                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                                    .filter(([key]) => !['projectName', 'npv', 'irr', 'paybackPeriod', 'amount', 'currency', 'unit', 'justification', 'description'].includes(key))
                                                    .filter(([, value]) => {
                                                        if (value === null || value === undefined || typeof value === 'object') return false;
                                                        if (!isEditing && value === '') return false;
                                                        return true;
                                                    })
                                                    .map(([key, value]) => (
                                                        <div key={key} className="group">
                                                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block group-hover:text-primary-600 transition-colors">
                                                                {getFieldLabel(key)}
                                                            </label>
                                                            <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">
                                                                {isEditing ? (
                                                                    <Input
                                                                        value={formData[key] || ''}
                                                                        onChange={(e) => handleMetadataChange(key, e.target.value)}
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
                            )}

                            {activeTab === 'documents' && (() => {
                                // Combine documents from state (fetched from API) and metadata
                                const metadataDocs: MetadataDocument[] = Array.isArray(request.metadata?.documents) ? request.metadata.documents : [];
                                const allDocs = [...documents, ...metadataDocs.map((d, i) => ({ ...d, id: `meta-${i}`, isMetadata: true }))];
                                const hasDocuments = allDocs.length > 0;

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
                                    <div className="space-y-4">
                                        {/* Upload Section */}
                                        <Card className="!p-4 border-gray-200 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-medium text-text-primary">Upload Documents</h4>
                                                    <p className="text-sm text-text-secondary">Add supporting files to this request</p>
                                                </div>
                                                <label className="cursor-pointer">
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={handleDocumentUpload}
                                                        disabled={uploadingDocument}
                                                    />
                                                    <Button
                                                        variant="primary"
                                                        className="gap-2"
                                                        disabled={uploadingDocument}
                                                        isLoading={uploadingDocument}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                                                        }}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                        </svg>
                                                        {uploadingDocument ? 'Uploading...' : 'Upload File'}
                                                    </Button>
                                                </label>
                                            </div>
                                        </Card>

                                        {/* Documents List */}
                                        {hasDocuments ? (
                                            <Card className="!p-6 border-gray-200 shadow-sm">
                                                <div className="space-y-3">
                                                    {allDocs.map((doc: any) => (
                                                        <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                                                                    {getFileIcon(doc.mime_type || doc.type || '')}
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-gray-900">{doc.filename || doc.name}</div>
                                                                    <div className="text-xs text-gray-500">
                                                                        {formatFileSize(doc.file_size || doc.size)} • {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Attached'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {doc.download_url && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="bg-white"
                                                                        onClick={() => handleDocumentDownload(doc)}
                                                                    >
                                                                        Download
                                                                    </Button>
                                                                )}
                                                                {!doc.isMetadata && isCreator && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="bg-white text-danger-600 border-danger-200 hover:bg-danger-50"
                                                                        onClick={() => handleDocumentDelete(doc.id)}
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        ) : (
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
                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(request.creator.display_name || 'User')}&background=random`}
                                    alt={request.creator.display_name || 'User'}
                                    className="w-14 h-14 rounded-full border-2 border-white shadow-sm"
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
                                <span className="font-medium text-text-primary">{new Date(request.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center">
                                <span className="text-text-secondary">Last Updated</span>
                                <span className="font-medium text-text-primary">{new Date(request.updated_at).toLocaleDateString()}</span>
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
            </div>
        </AppLayout>
    );
}
