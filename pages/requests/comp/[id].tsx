import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

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

const allocationLabels: Record<string, string> = {
    marketing_domestic: 'Marketing – Domestic',
    marketing_international: 'Marketing – International',
    administration: 'Administration',
    promotions: 'Promotions',
    personnel: 'Personnel',
};

const accommodationLabels: Record<string, string> = {
    accommodation_only: 'Accommodation Only (Bed only)',
    accommodation_and_breakfast: 'Bed & Breakfast',
    accommodation_and_meals: 'Accommodation & Meals',
    accommodation_meals_drink: 'Accommodation, Meals & Soft Drink',
};

interface ApproverInfo {
    id: string;
    display_name: string;
    email: string;
    profile_picture_url?: string;
    status: 'pending' | 'approved' | 'rejected';
    signed_at?: string;
    comment?: string;
}

function getApproverIds(metadata: Record<string, any> | undefined): string[] {
    if (!metadata) return [];
    if (metadata.approvers) {
        if (typeof metadata.approvers === 'object' && !Array.isArray(metadata.approvers)) {
            return Object.values(metadata.approvers).filter(Boolean) as string[];
        }
        if (Array.isArray(metadata.approvers)) {
            return metadata.approvers;
        }
    }
    return [];
}

function ApprovalTimeline({ request }: { request: RequestDetail }) {
    const [approvers, setApprovers] = useState<ApproverInfo[]>([]);
    const [loadingApprovers, setLoadingApprovers] = useState(true);

    useEffect(() => {
        async function fetchApprovers() {
            const approverIds: string[] = getApproverIds(request.metadata);

            if (approverIds.length === 0) {
                setLoadingApprovers(false);
                return;
            }

            try {
                const response = await fetch(`/api/users/by-ids?ids=${approverIds.join(',')}`);
                if (response.ok) {
                    const data = await response.json();
                    const users = data.users || [];

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
                }
            } catch (error) {
                console.error('Error fetching approvers:', error);
            } finally {
                setLoadingApprovers(false);
            }
        }

        fetchApprovers();
    }, [request]);

    if (loadingApprovers) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (approvers.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center shadow-sm">
                <p className="text-gray-500">No approvers assigned to this request.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl">
            <div className="relative pl-6 sm:pl-10 space-y-8 pb-8">
                <div className="absolute left-[1.15rem] sm:left-[2.15rem] top-4 bottom-4 w-0.5 bg-gray-100" />

                {approvers.map((approver, index) => {
                    const isApproved = approver.status === 'approved';
                    const isRejected = approver.status === 'rejected';
                    const isPending = approver.status === 'pending';
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

                            <div className={`
                                ml-4 p-5 rounded-2xl border transition-all duration-300 group
                                ${isActive
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
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-lg ${isActive ? 'text-primary-700' : 'text-gray-900'}`}>
                                                {approver.display_name}
                                            </h4>
                                            <p className="text-sm text-gray-500">{approver.email}</p>
                                        </div>
                                    </div>

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
                                </div>

                                {approver.comment && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="mt-4 pt-4 border-t border-gray-100"
                                    >
                                        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 relative">
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

export default function CompHotelBookingDetailsPage() {
    const router = useRouter();
    const { id } = router.query;
    const { data: session, status } = useSession();
    const [request, setRequest] = useState<RequestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'documents'>('details');
    const [publishing, setPublishing] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loadingDocuments, setLoadingDocuments] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewProcessing, setReviewProcessing] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [userSignatureUrl, setUserSignatureUrl] = useState<string | null>(null);

    const currentUserId = (session?.user as any)?.id;
    const isCreator = request?.creator?.id === currentUserId;
    const isDraft = request?.status === 'draft';
    const canPublish = isCreator && isDraft;
    const canDelete = isCreator && request?.status !== 'approved';

    const pendingStep = request?.request_steps?.find(
        s => s.approver?.id === currentUserId && s.status === 'pending'
    );

    const waitingStepThatShouldBePending = (() => {
        if (!request?.request_steps) return null;
        const sortedSteps = [...request.request_steps].sort((a, b) => a.step_index - b.step_index);
        for (const step of sortedSteps) {
            if (step.status === 'approved') continue;
            if (step.status === 'rejected') return null;
            if (step.approver?.id === currentUserId && (step.status === 'pending' || step.status === 'waiting')) {
                return step;
            }
            return null;
        }
        return null;
    })();

    const effectivePendingStep = pendingStep || waitingStepThatShouldBePending;
    const isCurrentApprover = !!effectivePendingStep;
    
    // Approvers can edit (navigate to edit form)
    const canApproverEdit = isCurrentApprover;

    const computeActualStatus = (): string | undefined => {
        if (!request) return undefined;
        const steps = request.request_steps || [];
        if (steps.length === 0) return request.status;
        if (steps.some(s => s.status === 'rejected')) return 'rejected';
        if (steps.every(s => s.status === 'approved')) return 'approved';
        if (steps.some(s => s.status === 'pending' || s.status === 'waiting')) return 'pending';
        return request.status;
    };
    const actualStatus = computeActualStatus();

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

            const refreshResponse = await fetch(`/api/requests/${id}`);
            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                setRequest(refreshData.request);
            }

            router.push('/requests/my-requests');
        } catch (err: any) {
            setPublishError(err.message || 'Failed to publish request');
        } finally {
            setPublishing(false);
        }
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
                setError(err.message || 'Failed to load request details.');
            } finally {
                setLoading(false);
            }
        }

        fetchRequestDetails();
    }, [id, status]);

    const fetchDocuments = async () => {
        if (!id) return;

        setLoadingDocuments(true);
        try {
            const response = await fetch(`/api/requests/${id}/documents`);
            if (response.ok) {
                const data = await response.json();
                setDocuments(data.documents || []);
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
                        <p className="text-text-secondary max-w-md mx-auto mb-8">{error || "The request does not exist or you do not have permission to view it."}</p>
                        <Button variant="primary" onClick={() => router.push('/requests/my-requests')}>
                            Back to My Requests
                        </Button>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    const statusInfo = statusConfig[actualStatus || request.status] || statusConfig.pending;
    const metadata = request.metadata || {};
    const selectedBusinessUnits = metadata.selectedBusinessUnits || [];
    const travelDocument = metadata.travelDocument;
    const hasTravelDocument = metadata.processTravelDocument && travelDocument;

    return (
        <AppLayout title={`Request #${request.id.substring(0, 8)}`}>
            <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

                {publishError && (
                    <Card className="bg-danger-50 border-danger-200 !p-4">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-danger-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-danger-700 text-sm">{publishError}</p>
                            <button onClick={() => setPublishError(null)} className="ml-auto text-danger-500 hover:text-danger-700">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </Card>
                )}

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
                            {request.title}
                        </h1>
                        <div className="text-text-secondary text-lg leading-relaxed max-w-3xl">
                            {request.description}
                        </div>
                    </div>

                    <div className="flex gap-3 flex-shrink-0">
                        {canDelete && (
                            <Button variant="outline" className="gap-2 bg-white text-danger-600 border-danger-200 hover:bg-danger-50" onClick={() => setShowDeleteConfirm(true)}>
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
                        {canPublish && (
                            <Button variant="primary" className="gap-2 shadow-lg shadow-primary-500/20" onClick={handlePublish} disabled={publishing} isLoading={publishing}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                {publishing ? 'Publishing...' : 'Publish Request'}
                            </Button>
                        )}
                        {canApproverEdit && (
                            <Button
                                variant="outline"
                                className="gap-2 bg-white text-text-secondary border-gray-200 hover:bg-gray-50 hover:text-text-primary"
                                onClick={() => {
                                    router.push(`/requests/hotel-booking/edit?id=${id}&approver=true`);
                                }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Edit Request
                            </Button>
                        )}
                        {isCurrentApprover && (
                            <Button variant="primary" className="gap-2 shadow-lg shadow-primary-500/20" onClick={() => setShowReviewModal(true)}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Review Request
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="border-b border-gray-200">
                            <div className="flex gap-8">
                                {(['details', 'timeline', 'documents'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`pb-4 px-1 text-sm font-medium border-b-2 transition-all capitalize ${activeTab === tab ? 'border-primary-500 text-primary-600' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="min-h-[400px]">
                            {activeTab === 'details' && (
                                <div className="space-y-6">
                                    {/* Guest Information Card */}
                                    <Card className="!p-0 overflow-hidden border-primary-100 shadow-sm bg-gradient-to-br from-primary-50 via-white to-accent/5">
                                        <div className="p-6">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Guest Information</span>
                                                    <h2 className="text-2xl font-bold text-text-primary mt-1 font-heading">
                                                        {metadata.guestNames || 'N/A'}
                                                    </h2>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        {metadata.isExternalGuest ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                </svg>
                                                                External Guest
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                </svg>
                                                                Staff Member
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Allocation</span>
                                                    <div className="text-lg font-semibold text-text-primary mt-1">
                                                        {allocationLabels[metadata.allocationType] || metadata.allocationType || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Booking Details Card */}
                                    <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                        <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                                            <h3 className="font-semibold text-text-primary font-heading">Booking Details</h3>
                                        </div>
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {metadata.percentageDiscount && (
                                                <div className="group">
                                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">Percentage Discount</label>
                                                    <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">{metadata.percentageDiscount}%</div>
                                                </div>
                                            )}
                                            <div className="group md:col-span-2">
                                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">Reason for Complimentary</label>
                                                <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2 whitespace-pre-wrap">{metadata.reason || 'N/A'}</div>
                                            </div>
                                        </div>
                                    </Card>

                                    {/* Business Units Card */}
                                    {selectedBusinessUnits.length > 0 && (
                                        <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                            <div className="bg-emerald-50/50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
                                                <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                    Business Units
                                                </h3>
                                                <span className="text-sm text-emerald-600 font-medium">{selectedBusinessUnits.length} selected</span>
                                            </div>
                                            <div className="p-4 space-y-4">
                                                {selectedBusinessUnits.map((unit: any, index: number) => (
                                                    <div key={unit.id || index} className="p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="font-bold text-gray-900 text-lg">{unit.name}</h4>
                                                            {unit.bookingMade && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                    Booking Made
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                            <div>
                                                                <span className="text-gray-500 block">Arrival Date</span>
                                                                <span className="font-medium text-gray-900">{unit.arrivalDate ? new Date(unit.arrivalDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 block">Departure Date</span>
                                                                <span className="font-medium text-gray-900">{unit.departureDate ? new Date(unit.departureDate).toLocaleDateString('en-GB') : 'N/A'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 block">No. of Nights</span>
                                                                <span className="font-medium text-gray-900">{unit.numberOfNights || 'N/A'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 block">No. of Rooms</span>
                                                                <span className="font-medium text-gray-900">{unit.numberOfRooms || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                            <div>
                                                                <span className="text-gray-500 block">Accommodation Type</span>
                                                                <span className="font-medium text-gray-900">{accommodationLabels[unit.accommodationType] || unit.accommodationType || 'N/A'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 block">Special Arrangements</span>
                                                                <span className="font-medium text-gray-900">{unit.specialArrangements || 'N/A'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    )}

                                    {/* Travel Document Section */}
                                    {hasTravelDocument && (
                                        <Card className="!p-0 overflow-hidden border-blue-200 shadow-sm">
                                            <div className="bg-blue-50/50 px-6 py-4 border-b border-blue-100">
                                                <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    Local Travel Authorization
                                                </h3>
                                            </div>
                                            <div className="p-6 space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">Date of Intended Travel</label>
                                                        <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">
                                                            {travelDocument.dateOfIntendedTravel ? new Date(travelDocument.dateOfIntendedTravel).toLocaleDateString('en-GB') : 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">Travel Mode</label>
                                                        <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2">{travelDocument.travelMode || 'N/A'}</div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">Purpose of Travel</label>
                                                    <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2 whitespace-pre-wrap">{travelDocument.purposeOfTravel || 'N/A'}</div>
                                                </div>
                                                {travelDocument.accompanyingAssociates && (
                                                    <div>
                                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1 block">Accompanying Associates</label>
                                                        <div className="text-text-primary font-medium text-base border-b border-gray-100 pb-2 whitespace-pre-wrap">{travelDocument.accompanyingAssociates}</div>
                                                    </div>
                                                )}

                                                {/* Travel Itinerary */}
                                                {travelDocument.itinerary && travelDocument.itinerary.length > 0 && (
                                                    <div>
                                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 block">Travel Itinerary</label>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                                                <thead className="bg-gray-50">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Date</th>
                                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">From</th>
                                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">To</th>
                                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">KM</th>
                                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Justification</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {travelDocument.itinerary.map((row: any, idx: number) => (
                                                                        <tr key={idx} className="border-t border-gray-100">
                                                                            <td className="px-3 py-2 text-gray-900">{row.date ? new Date(row.date).toLocaleDateString('en-GB') : '-'}</td>
                                                                            <td className="px-3 py-2 text-gray-900">{row.from || '-'}</td>
                                                                            <td className="px-3 py-2 text-gray-900">{row.to || '-'}</td>
                                                                            <td className="px-3 py-2 text-gray-900">{row.km || '-'}</td>
                                                                            <td className="px-3 py-2 text-gray-900">{row.justification || '-'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Travel Budget */}
                                                {travelDocument.budget && (
                                                    <div>
                                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 block">Travel Budget</label>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                                                                <thead className="bg-gray-50">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Item</th>
                                                                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Qty</th>
                                                                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Unit Cost</th>
                                                                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Total</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {travelDocument.budget.fuel?.totalCost && parseFloat(travelDocument.budget.fuel.totalCost) > 0 && (
                                                                        <tr className="border-t border-gray-100">
                                                                            <td className="px-3 py-2 text-gray-900">Fuel (Litres)</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">{travelDocument.budget.fuel.quantity}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">${travelDocument.budget.fuel.unitCost}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right font-medium">${travelDocument.budget.fuel.totalCost}</td>
                                                                        </tr>
                                                                    )}
                                                                    {travelDocument.budget.aaRates?.totalCost && parseFloat(travelDocument.budget.aaRates.totalCost) > 0 && (
                                                                        <tr className="border-t border-gray-100">
                                                                            <td className="px-3 py-2 text-gray-900">AA Rates (KM)</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">{travelDocument.budget.aaRates.quantity}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">${travelDocument.budget.aaRates.unitCost}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right font-medium">${travelDocument.budget.aaRates.totalCost}</td>
                                                                        </tr>
                                                                    )}
                                                                    {travelDocument.budget.airBusTickets?.totalCost && parseFloat(travelDocument.budget.airBusTickets.totalCost) > 0 && (
                                                                        <tr className="border-t border-gray-100">
                                                                            <td className="px-3 py-2 text-gray-900">Air/Bus Tickets</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">{travelDocument.budget.airBusTickets.quantity}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">${travelDocument.budget.airBusTickets.unitCost}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right font-medium">${travelDocument.budget.airBusTickets.totalCost}</td>
                                                                        </tr>
                                                                    )}
                                                                    {travelDocument.budget.conferencingCost?.totalCost && parseFloat(travelDocument.budget.conferencingCost.totalCost) > 0 && (
                                                                        <tr className="border-t border-gray-100">
                                                                            <td className="px-3 py-2 text-gray-900">Conferencing Cost</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">{travelDocument.budget.conferencingCost.quantity}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">${travelDocument.budget.conferencingCost.unitCost}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right font-medium">${travelDocument.budget.conferencingCost.totalCost}</td>
                                                                        </tr>
                                                                    )}
                                                                    {travelDocument.budget.tollgates?.totalCost && parseFloat(travelDocument.budget.tollgates.totalCost) > 0 && (
                                                                        <tr className="border-t border-gray-100">
                                                                            <td className="px-3 py-2 text-gray-900">Tollgates</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">{travelDocument.budget.tollgates.quantity}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">${travelDocument.budget.tollgates.unitCost}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right font-medium">${travelDocument.budget.tollgates.totalCost}</td>
                                                                        </tr>
                                                                    )}
                                                                    {travelDocument.budget.other?.totalCost && parseFloat(travelDocument.budget.other.totalCost) > 0 && (
                                                                        <tr className="border-t border-gray-100">
                                                                            <td className="px-3 py-2 text-gray-900">Other{travelDocument.budget.other.description ? ` (${travelDocument.budget.other.description})` : ''}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">{travelDocument.budget.other.quantity}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right">${travelDocument.budget.other.unitCost}</td>
                                                                            <td className="px-3 py-2 text-gray-900 text-right font-medium">${travelDocument.budget.other.totalCost}</td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                                <tfoot className="bg-primary-50">
                                                                    <tr className="border-t-2 border-primary-200">
                                                                        <td colSpan={3} className="px-3 py-3 text-right font-bold text-primary-800">Grand Total</td>
                                                                        <td className="px-3 py-3 text-right font-bold text-primary-800">
                                                                            ${(() => {
                                                                                const b = travelDocument.budget;
                                                                                const vals = [b.fuel?.totalCost, b.aaRates?.totalCost, b.airBusTickets?.totalCost, b.conferencingCost?.totalCost, b.tollgates?.totalCost, b.other?.totalCost];
                                                                                return vals.reduce((sum: number, v: any) => sum + (parseFloat(v) || 0), 0).toFixed(2);
                                                                            })()}
                                                                        </td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            )}

                            {activeTab === 'timeline' && (
                                <div className="space-y-6">
                                    <Card className="!p-6 border-gray-100 shadow-sm">
                                        <h3 className="text-lg font-bold text-text-primary mb-6 font-heading">Approval Timeline</h3>
                                        <ApprovalTimeline request={request} />
                                    </Card>
                                </div>
                            )}

                            {activeTab === 'documents' && (
                                <div className="space-y-6">
                                    {loadingDocuments ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                                        </div>
                                    ) : documents.length > 0 ? (
                                        <Card className="!p-0 overflow-hidden border-gray-200 shadow-sm">
                                            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                                                <h3 className="font-semibold text-text-primary font-heading">Uploaded Documents</h3>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                {documents.map((doc: any) => (
                                                    <div key={doc.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                                                                <p className="text-xs text-gray-500">{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}</p>
                                                            </div>
                                                        </div>
                                                        {doc.download_url && (
                                                            <Button variant="outline" size="sm" className="bg-white" onClick={() => window.open(doc.download_url, '_blank')}>
                                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                                Download
                                                            </Button>
                                                        )}
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
                                            <p className="text-text-secondary">No documents have been uploaded for this request.</p>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="space-y-6">
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

                        <Card className="!p-6 border-primary-100 bg-gradient-to-br from-white to-primary-50/50 shadow-sm relative overflow-hidden">
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
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</Button>
                                <Button variant="danger" onClick={handleDelete} disabled={deleting} isLoading={deleting}>
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
                                <button onClick={() => { setShowReviewModal(false); setReviewComment(''); setReviewError(null); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-semibold text-gray-900">{request.title}</h3>
                                    <p className="text-gray-600 leading-relaxed text-sm">{request.description || 'No description provided.'}</p>
                                </div>

                                <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                                    <div className="text-xs text-primary-600 uppercase tracking-wide font-medium mb-2">Your Signature</div>
                                    {userSignatureUrl ? (
                                        <div className="bg-white rounded-lg p-3 border border-primary-100">
                                            <img src={userSignatureUrl} alt="Your signature" className="h-16 mx-auto object-contain" />
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-lg p-4 border border-primary-100 text-center">
                                            <p className="text-sm text-gray-500">No signature found.</p>
                                            <a href="/profile" className="text-sm text-primary-600 hover:underline">Set up your signature →</a>
                                        </div>
                                    )}
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Review Comment <span className="text-gray-400 font-normal">(Required for rejection)</span></label>
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
                                <Button variant="outline" onClick={() => { setShowReviewModal(false); setReviewComment(''); setReviewError(null); }} disabled={reviewProcessing} className="bg-white hover:bg-gray-50">Cancel</Button>
                                <Button variant="danger" onClick={() => handleApprovalAction('reject')} disabled={reviewProcessing} className="min-w-[5rem]">{reviewProcessing ? '...' : 'Reject'}</Button>
                                <Button variant="primary" onClick={() => handleApprovalAction('approve')} disabled={reviewProcessing || !userSignatureUrl} className="min-w-[6rem]">{reviewProcessing ? 'Processing...' : 'Approve'}</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
