import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useUserHrimsProfile } from '../../../hooks/useUserHrimsProfile';

interface ItineraryRow {
    date: string;
    from: string;
    to: string;
    km: string;
    justification: string;
}

interface BudgetItem {
    quantity: string;
    unitCost: string;
    totalCost: string;
    description?: string;
}

interface TravelData {
    dateOfIntendedTravel: string;
    purposeOfTravel: string;
    accompanyingAssociates: string;
    travelMode: string;
    acceptConditions: boolean;
    itinerary: ItineraryRow[];
    budget: {
        fuel: BudgetItem;
        aaRates: BudgetItem;
        airBusTickets: BudgetItem;
        conferencingCost: BudgetItem;
        tollgates: BudgetItem;
        other: BudgetItem;
    };
}

export default function TravelAuthPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { user } = useCurrentUser();
    const { departmentName, businessUnitName } = useUserHrimsProfile();
    const [loading, setLoading] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit mode state
    const { edit: editRequestId, approver: isApproverEdit } = router.query;
    const isEditMode = !!editRequestId;
    const isApproverEditing = isApproverEdit === 'true';
    const [loadingRequest, setLoadingRequest] = useState(false);
    const [originalTravelData, setOriginalTravelData] = useState<TravelData | null>(null);
    const [originalApprovers, setOriginalApprovers] = useState<Record<string, string> | null>(null);
    const [originalUseParallelApprovals, setOriginalUseParallelApprovals] = useState<boolean | null>(null);
    const [requestStatus, setRequestStatus] = useState<string>('draft');

    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const todayISO = new Date().toISOString().split('T')[0];

    const [travelData, setTravelData] = useState<TravelData>({
        dateOfIntendedTravel: '',
        purposeOfTravel: '',
        accompanyingAssociates: '',
        travelMode: '',
        acceptConditions: false,
        itinerary: [{ date: '', from: '', to: '', km: '', justification: '' }],
        budget: {
            fuel: { quantity: '', unitCost: '', totalCost: '' },
            aaRates: { quantity: '', unitCost: '0.28', totalCost: '' },
            airBusTickets: { quantity: '', unitCost: '', totalCost: '' },
            conferencingCost: { quantity: '', unitCost: '', totalCost: '' },
            tollgates: { quantity: '', unitCost: '', totalCost: '' },
            other: { description: '', quantity: '', unitCost: '', totalCost: '' },
        },
    });

    const approvalRoles = [
        { key: 'hod', label: 'Head of Department', description: 'Department Approval' },
        { key: 'hr_director', label: 'HR Director', description: 'HR Review' },
        { key: 'finance_director', label: 'Finance Director', description: 'Financial Review' },
        { key: 'ceo', label: 'CEO', description: 'Final Authorization' },
    ];

    const [users, setUsers] = useState<Array<{ id: string; display_name: string; email: string; job_title?: string }>>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [selectedApprovers, setSelectedApprovers] = useState<Record<string, string>>({
        hod: '', hr_director: '', finance_director: '', ceo: '',
    });
    const [approverSearch, setApproverSearch] = useState<Record<string, string>>({
        hod: '', hr_director: '', finance_director: '', ceo: '',
    });
    const [showApproverDropdown, setShowApproverDropdown] = useState<string | null>(null);
    const [useParallelApprovals, setUseParallelApprovals] = useState(false);

    const addItineraryRow = () => {
        setTravelData(prev => ({
            ...prev,
            itinerary: [...prev.itinerary, { date: '', from: '', to: '', km: '', justification: '' }]
        }));
    };

    const updateItineraryRow = (index: number, field: string, value: string) => {
        setTravelData(prev => ({
            ...prev,
            itinerary: prev.itinerary.map((row, i) => i === index ? { ...row, [field]: value } : row)
        }));
    };

    const removeItineraryRow = (index: number) => {
        if (travelData.itinerary.length > 1) {
            setTravelData(prev => ({ ...prev, itinerary: prev.itinerary.filter((_, i) => i !== index) }));
        }
    };

    const calculateGrandTotal = () => {
        const b = travelData.budget;
        return [b.fuel.totalCost, b.aaRates.totalCost, b.airBusTickets.totalCost, b.conferencingCost.totalCost, b.tollgates.totalCost, b.other.totalCost]
            .reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(2);
    };

    const updateBudgetItem = (item: keyof TravelData['budget'], field: string, value: string) => {
        setTravelData(prev => {
            const currentItem = prev.budget[item];
            const updatedItem = { ...currentItem, [field]: value };
            if (field === 'quantity' || field === 'unitCost') {
                const qty = parseFloat(field === 'quantity' ? value : updatedItem.quantity) || 0;
                const uc = parseFloat(field === 'unitCost' ? value : updatedItem.unitCost) || 0;
                updatedItem.totalCost = (qty * uc).toFixed(2);
            }
            return { ...prev, budget: { ...prev.budget, [item]: updatedItem } };
        });
    };

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/');
    }, [status, router]);

    // Fetch existing request data when in edit mode
    useEffect(() => {
        const fetchExistingRequest = async () => {
            if (!editRequestId || typeof editRequestId !== 'string') return;
            
            setLoadingRequest(true);
            try {
                const response = await fetch(`/api/requests/${editRequestId}`);
                if (!response.ok) throw new Error('Failed to fetch request');
                const data = await response.json();
                const request = data.request;
                const metadata = request.metadata || {};

                setRequestStatus(request.status || 'draft');

                // Default budget structure
                const defaultBudget = {
                    fuel: { quantity: '', unitCost: '', totalCost: '' },
                    aaRates: { quantity: '', unitCost: '0.28', totalCost: '' },
                    airBusTickets: { quantity: '', unitCost: '', totalCost: '' },
                    conferencingCost: { quantity: '', unitCost: '', totalCost: '' },
                    tollgates: { quantity: '', unitCost: '', totalCost: '' },
                    other: { description: '', quantity: '', unitCost: '', totalCost: '' },
                };

                // Merge existing budget with defaults to ensure all items exist
                const existingBudget = metadata.budget || {};
                const mergedBudget = {
                    fuel: { ...defaultBudget.fuel, ...(existingBudget.fuel || {}) },
                    aaRates: { ...defaultBudget.aaRates, ...(existingBudget.aaRates || {}) },
                    airBusTickets: { ...defaultBudget.airBusTickets, ...(existingBudget.airBusTickets || {}) },
                    conferencingCost: { ...defaultBudget.conferencingCost, ...(existingBudget.conferencingCost || {}) },
                    tollgates: { ...defaultBudget.tollgates, ...(existingBudget.tollgates || {}) },
                    other: { ...defaultBudget.other, ...(existingBudget.other || {}) },
                };

                // Store original data for comparison
                const originalData: TravelData = {
                    dateOfIntendedTravel: metadata.dateOfIntendedTravel || '',
                    purposeOfTravel: metadata.purposeOfTravel || request.description || '',
                    accompanyingAssociates: metadata.accompanyingAssociates || '',
                    travelMode: metadata.travelMode || '',
                    acceptConditions: metadata.acceptConditions || false,
                    itinerary: metadata.itinerary || [{ date: '', from: '', to: '', km: '', justification: '' }],
                    budget: mergedBudget,
                };
                setOriginalTravelData(originalData);

                // Pre-fill form with existing data
                setTravelData(originalData);

                // Set approvers and store original for change tracking
                const approverRolesData = metadata.approverRoles || {};
                if (approverRolesData && typeof approverRolesData === 'object') {
                    setSelectedApprovers(prev => ({ ...prev, ...approverRolesData }));
                    setOriginalApprovers({ hod: '', hr_director: '', finance_director: '', ceo: '', ...approverRolesData });
                }

                // Set parallel approvals and store original
                const parallelApprovals = metadata.useParallelApprovals || false;
                setUseParallelApprovals(parallelApprovals);
                setOriginalUseParallelApprovals(parallelApprovals);
            } catch (err: any) {
                console.error('Error fetching request:', err);
                setError('Failed to load request data');
            } finally {
                setLoadingRequest(false);
            }
        };

        if (status === 'authenticated' && editRequestId) {
            fetchExistingRequest();
        }
    }, [editRequestId, status]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await fetch('/api/users');
                if (response.ok) {
                    const data = await response.json();
                    setUsers(data.users || []);
                }
            } catch (err) { console.error('Failed to fetch users:', err); }
            finally { setLoadingUsers(false); }
        };
        if (status === 'authenticated') fetchUsers();
    }, [status]);

    const getFilteredUsersForRole = (roleKey: string) => {
        const searchTerm = approverSearch[roleKey] || '';
        const alreadySelectedIds = Object.values(selectedApprovers).filter(id => id);
        return users.filter(u => {
            const matchesSearch = searchTerm ? (u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())) : true;
            const notAlreadySelected = !alreadySelectedIds.includes(u.id) || selectedApprovers[roleKey] === u.id;
            return matchesSearch && notAlreadySelected;
        });
    };

    const handleSelectApprover = (roleKey: string, userId: string) => {
        setSelectedApprovers(prev => ({ ...prev, [roleKey]: userId }));
        setApproverSearch(prev => ({ ...prev, [roleKey]: '' }));
        setShowApproverDropdown(null);
    };

    const handleRemoveApprover = (roleKey: string) => {
        setSelectedApprovers(prev => ({ ...prev, [roleKey]: '' }));
    };

    const validateForm = (): string[] => {
        const errors: string[] = [];
        const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);

        if (!travelData.dateOfIntendedTravel) errors.push('Date of intended travel is required');
        else if (new Date(travelData.dateOfIntendedTravel) < todayDate) errors.push('Date of intended travel cannot be in the past');
        if (!travelData.purposeOfTravel.trim()) errors.push('Purpose of travel is required');
        if (!travelData.travelMode.trim()) errors.push('Travel mode is required');
        if (!travelData.acceptConditions) errors.push('You must accept the travel conditions');

        const hasValidItinerary = travelData.itinerary.some(row => row.date || row.from || row.to);
        if (!hasValidItinerary) errors.push('At least one travel itinerary row is required');

        const b = travelData.budget;
        const hasValidBudget = [b.fuel, b.aaRates, b.airBusTickets, b.conferencingCost, b.tollgates, b.other].some(item => parseFloat(item.totalCost) > 0);
        if (!hasValidBudget) errors.push('At least one travel budget item is required');

        if (!selectedApprovers.hod) errors.push('Please select an approver for Head of Department');
        if (!selectedApprovers.hr_director) errors.push('Please select an approver for HR Director');
        if (!selectedApprovers.finance_director) errors.push('Please select an approver for Finance Director');
        if (!selectedApprovers.ceo) errors.push('Please select an approver for CEO');

        return errors;
    };

    // Helper to get approver display name
    const getApproverName = (approverId: string) => {
        const user = users.find(u => u.id === approverId);
        return user ? user.display_name : approverId || 'None';
    };

    // Helper to collect field changes for approver edit tracking
    const collectFieldChanges = () => {
        if (!originalTravelData) return [];
        const changes: { fieldName: string; oldValue: any; newValue: any }[] = [];

        if (travelData.dateOfIntendedTravel !== originalTravelData.dateOfIntendedTravel) {
            changes.push({ fieldName: 'dateOfIntendedTravel', oldValue: originalTravelData.dateOfIntendedTravel, newValue: travelData.dateOfIntendedTravel });
        }
        if (travelData.purposeOfTravel !== originalTravelData.purposeOfTravel) {
            changes.push({ fieldName: 'purposeOfTravel', oldValue: originalTravelData.purposeOfTravel, newValue: travelData.purposeOfTravel });
        }
        if (travelData.accompanyingAssociates !== originalTravelData.accompanyingAssociates) {
            changes.push({ fieldName: 'accompanyingAssociates', oldValue: originalTravelData.accompanyingAssociates, newValue: travelData.accompanyingAssociates });
        }
        if (travelData.travelMode !== originalTravelData.travelMode) {
            changes.push({ fieldName: 'travelMode', oldValue: originalTravelData.travelMode, newValue: travelData.travelMode });
        }
        if (JSON.stringify(travelData.itinerary) !== JSON.stringify(originalTravelData.itinerary)) {
            changes.push({ fieldName: 'itinerary', oldValue: JSON.stringify(originalTravelData.itinerary), newValue: JSON.stringify(travelData.itinerary) });
        }
        if (JSON.stringify(travelData.budget) !== JSON.stringify(originalTravelData.budget)) {
            changes.push({ fieldName: 'budget', oldValue: JSON.stringify(originalTravelData.budget), newValue: JSON.stringify(travelData.budget) });
        }

        // Track approval workflow changes
        if (originalApprovers) {
            const roleLabels: Record<string, string> = {
                hod: 'HOD Approver',
                hr_director: 'HR Director Approver',
                finance_director: 'Finance Director Approver',
                ceo: 'CEO Approver',
            };
            for (const role of Object.keys(roleLabels)) {
                const oldApprover = originalApprovers[role] || '';
                const newApprover = selectedApprovers[role] || '';
                if (oldApprover !== newApprover) {
                    changes.push({
                        fieldName: roleLabels[role],
                        oldValue: getApproverName(oldApprover),
                        newValue: getApproverName(newApprover),
                    });
                }
            }
        }

        // Track parallel approvals change
        if (originalUseParallelApprovals !== null && useParallelApprovals !== originalUseParallelApprovals) {
            changes.push({
                fieldName: 'Parallel Approvals',
                oldValue: originalUseParallelApprovals ? 'Enabled' : 'Disabled',
                newValue: useParallelApprovals ? 'Enabled' : 'Disabled',
            });
        }

        return changes;
    };

    // Handle approver save (edit mode with change tracking)
    const handleApproverSave = async () => {
        setLoading(true);
        setError(null);

        try {
            const fieldChanges = collectFieldChanges();

            // Update the request metadata
            const approversArray = [selectedApprovers.hod, selectedApprovers.hr_director, selectedApprovers.finance_director, selectedApprovers.ceo].filter(Boolean);
            const response = await fetch(`/api/requests/${editRequestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Travel Auth: ${travelData.purposeOfTravel.substring(0, 50)}`,
                    description: travelData.purposeOfTravel,
                    metadata: {
                        type: 'travel_authorization',
                        dateOfIntendedTravel: travelData.dateOfIntendedTravel,
                        purposeOfTravel: travelData.purposeOfTravel,
                        accompanyingAssociates: travelData.accompanyingAssociates,
                        travelMode: travelData.travelMode,
                        acceptConditions: travelData.acceptConditions,
                        itinerary: travelData.itinerary,
                        budget: travelData.budget,
                        grandTotal: calculateGrandTotal(),
                        approvers: approversArray,
                        approverRoles: selectedApprovers,
                        useParallelApprovals,
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save changes');
            }

            // Record modifications if there are changes
            if (fieldChanges.length > 0) {
                await fetch(`/api/requests/${editRequestId}/approver-edit`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fieldChanges }),
                });
            }

            router.push(`/requests/${editRequestId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to save changes');
        } finally {
            setLoading(false);
        }
    };

    // Handle draft owner save (edit mode)
    const handleDraftSave = async () => {
        setSavingDraft(true);
        setError(null);

        try {
            const approversArray = [selectedApprovers.hod, selectedApprovers.hr_director, selectedApprovers.finance_director, selectedApprovers.ceo].filter(Boolean);
            const response = await fetch(`/api/requests/${editRequestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Travel Auth: ${travelData.purposeOfTravel?.substring(0, 50) || 'Draft'}`,
                    description: travelData.purposeOfTravel || 'Draft request',
                    metadata: {
                        type: 'travel_authorization',
                        dateOfIntendedTravel: travelData.dateOfIntendedTravel,
                        purposeOfTravel: travelData.purposeOfTravel,
                        accompanyingAssociates: travelData.accompanyingAssociates,
                        travelMode: travelData.travelMode,
                        acceptConditions: travelData.acceptConditions,
                        itinerary: travelData.itinerary,
                        budget: travelData.budget,
                        grandTotal: calculateGrandTotal(),
                        approvers: approversArray,
                        approverRoles: selectedApprovers,
                        useParallelApprovals,
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save draft');
            }

            router.push(`/requests/${editRequestId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to save draft');
        } finally {
            setSavingDraft(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // If approver editing, use approver save
        if (isApproverEditing && isEditMode) {
            await handleApproverSave();
            return;
        }

        // If editing a draft, use draft save
        if (isEditMode && !isApproverEditing) {
            await handleDraftSave();
            return;
        }

        setLoading(true);
        setError(null);

        const errors = validateForm();
        if (errors.length > 0) {
            setError(errors.join('. '));
            setLoading(false);
            return;
        }

        try {
            const approversArray = [selectedApprovers.hod, selectedApprovers.hr_director, selectedApprovers.finance_director, selectedApprovers.ceo].filter(Boolean);
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Travel Auth: ${travelData.purposeOfTravel.substring(0, 50)}`,
                    description: travelData.purposeOfTravel,
                    priority: 'normal',
                    category: 'travel',
                    requestType: 'travel_authorization',
                    status: 'pending',
                    metadata: {
                        type: 'travel_authorization',
                        dateOfIntendedTravel: travelData.dateOfIntendedTravel,
                        purposeOfTravel: travelData.purposeOfTravel,
                        accompanyingAssociates: travelData.accompanyingAssociates,
                        travelMode: travelData.travelMode,
                        acceptConditions: travelData.acceptConditions,
                        itinerary: travelData.itinerary,
                        budget: travelData.budget,
                        grandTotal: calculateGrandTotal(),
                        approvers: approversArray,
                        approverRoles: selectedApprovers,
                        useParallelApprovals,
                    },
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to create travel authorization');
            router.push(`/requests/${data.request.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to create travel authorization');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        setSavingDraft(true);
        setError(null);
        try {
            const approversArray = [selectedApprovers.hod, selectedApprovers.hr_director, selectedApprovers.finance_director, selectedApprovers.ceo].filter(Boolean);
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Travel Auth: ${travelData.purposeOfTravel?.substring(0, 50) || 'Draft'}`,
                    description: travelData.purposeOfTravel || 'Draft request',
                    priority: 'normal',
                    category: 'travel',
                    requestType: 'travel_authorization',
                    status: 'draft',
                    metadata: {
                        dateOfIntendedTravel: travelData.dateOfIntendedTravel,
                        purposeOfTravel: travelData.purposeOfTravel,
                        accompanyingAssociates: travelData.accompanyingAssociates,
                        travelMode: travelData.travelMode,
                        acceptConditions: travelData.acceptConditions,
                        itinerary: travelData.itinerary,
                        budget: travelData.budget,
                        grandTotal: calculateGrandTotal(),
                        approvers: approversArray,
                        approverRoles: selectedApprovers,
                        useParallelApprovals,
                    },
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to save draft');
            router.push(`/requests/${data.request.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to save draft');
        } finally {
            setSavingDraft(false);
        }
    };

    if (status === 'loading' || loadingRequest) {
        return (
            <AppLayout title="Travel Authorization" showBack onBack={() => router.back()}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
            </AppLayout>
        );
    }

    if (!session) return null;

    const pageTitle = isApproverEditing ? 'Edit Travel Authorization (Approver)' : isEditMode ? 'Edit Travel Authorization' : 'Travel Authorization';

    return (
        <AppLayout title={pageTitle} showBack onBack={() => router.back()} hideNav>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 max-w-5xl mx-auto pb-32">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-text-primary font-heading uppercase tracking-wide">
                        {isApproverEditing ? 'Edit Travel Authorization' : 'Local Travel Authorization'}
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">DOC NO: HR APX – 1 LOCAL TRAVEL AUTHORISATION</p>
                    {isApproverEditing && (
                        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-xl">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span className="text-sm font-medium text-primary-700">Editing as Approver - Changes will be tracked</span>
                        </div>
                    )}
                </div>

                {error && <Card className="mb-4 bg-danger-50 border-danger-200"><p className="text-danger-600 text-sm">{error}</p></Card>}

                <div className="space-y-6">
                    {/* Requestor Information */}
                    <Card className="p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase border-b pb-2">Requestor Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div><label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Name</label><div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">{user?.display_name || session?.user?.name || 'N/A'}</div></div>
                            <div><label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Business Unit</label><div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">{businessUnitName || 'N/A'}</div></div>
                            <div><label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Department</label><div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">{departmentName || 'N/A'}</div></div>
                            <div><label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Date</label><div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">{today}</div></div>
                        </div>
                    </Card>

                    {/* Travel Details */}
                    <Card className="p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase border-b pb-2">Travel Details</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input type="date" label="Date of Intended Travel *" value={travelData.dateOfIntendedTravel} onChange={(e) => setTravelData({ ...travelData, dateOfIntendedTravel: e.target.value })} required min={todayISO} />
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Purpose of Travel <span className="text-danger-500">*</span></label><textarea className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[60px]" value={travelData.purposeOfTravel} onChange={(e) => setTravelData({ ...travelData, purposeOfTravel: e.target.value })} placeholder="Enter purpose of travel" required /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Accompanying Associates</label><textarea className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[60px]" value={travelData.accompanyingAssociates} onChange={(e) => setTravelData({ ...travelData, accompanyingAssociates: e.target.value })} placeholder="Enter names of accompanying associates (if any)" /></div>
                                <Input label="Travel Mode (Vehicle Registration if Driving) *" value={travelData.travelMode} onChange={(e) => setTravelData({ ...travelData, travelMode: e.target.value })} placeholder="e.g., Company Vehicle ABC 1234" />
                            </div>
                        </div>
                    </Card>

                    {/* Conditions */}
                    <Card className="p-6 bg-amber-50 border border-amber-200">
                        <h4 className="font-semibold text-amber-800 mb-3 uppercase text-sm">Conditions of Travel</h4>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-amber-900">
                            <li>Authorization must be sought using this form at least 7 days prior to departure.</li>
                            <li>Travel expenses must be claimed within 30 days after completion of travel, otherwise the claim shall be void.</li>
                            <li>It is an act of misconduct to travel without authority.</li>
                        </ol>
                        <div className="mt-4 flex items-center gap-3">
                            <input type="checkbox" id="acceptConditions" checked={travelData.acceptConditions} onChange={(e) => setTravelData({ ...travelData, acceptConditions: e.target.checked })} className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" required />
                            <label htmlFor="acceptConditions" className="text-sm font-medium text-amber-900 cursor-pointer">I have read these conditions and accept them. <span className="text-danger-500">*</span></label>
                        </div>
                    </Card>

                    {/* Travel Itinerary */}
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-gray-700 uppercase text-sm">Travel Itinerary <span className="text-danger-500">*</span></h4>
                            <button type="button" onClick={addItineraryRow} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Row
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-gray-100"><th className="px-3 py-2 text-left font-semibold text-gray-700">Date/Time</th><th className="px-3 py-2 text-left font-semibold text-gray-700">From</th><th className="px-3 py-2 text-left font-semibold text-gray-700">To</th><th className="px-3 py-2 text-left font-semibold text-gray-700">KM</th><th className="px-3 py-2 text-left font-semibold text-gray-700">Justification</th><th className="px-3 py-2 w-10"></th></tr></thead>
                                <tbody>
                                    {travelData.itinerary.map((row, index) => (
                                        <tr key={index} className="border-b border-gray-100">
                                            <td className="px-2 py-2"><input type="date" value={row.date} onChange={(e) => updateItineraryRow(index, 'date', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" /></td>
                                            <td className="px-2 py-2"><input type="text" value={row.from} onChange={(e) => updateItineraryRow(index, 'from', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="Origin" /></td>
                                            <td className="px-2 py-2"><input type="text" value={row.to} onChange={(e) => updateItineraryRow(index, 'to', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="Destination" /></td>
                                            <td className="px-2 py-2"><input type="number" value={row.km} onChange={(e) => updateItineraryRow(index, 'km', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" /></td>
                                            <td className="px-2 py-2"><input type="text" value={row.justification} onChange={(e) => updateItineraryRow(index, 'justification', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="Reason" /></td>
                                            <td className="px-2 py-2">{travelData.itinerary.length > 1 && <button type="button" onClick={() => removeItineraryRow(index)} className="text-red-500 hover:text-red-700"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Travel Budget */}
                    <Card className="p-6">
                        <h4 className="font-semibold text-gray-700 uppercase text-sm mb-3">Travel Budget <span className="text-danger-500">*</span></h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-gray-100"><th className="px-3 py-2 text-left font-semibold text-gray-700">Expenditure Item</th><th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">Quantity</th><th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Unit Cost (USD)</th><th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Total Cost (USD)</th></tr></thead>
                                <tbody>
                                    <tr className="border-b border-gray-100"><td className="px-3 py-2 text-gray-700">Fuel (Litres)</td><td className="px-2 py-2"><input type="number" value={travelData.budget.fuel.quantity} onChange={(e) => updateBudgetItem('fuel', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.fuel.unitCost} onChange={(e) => updateBudgetItem('fuel', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.fuel.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    <tr className="border-b border-gray-100"><td className="px-3 py-2 text-gray-700">AA Rates (KM)</td><td className="px-2 py-2"><input type="number" value={travelData.budget.aaRates.quantity} onChange={(e) => updateBudgetItem('aaRates', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.aaRates.unitCost} onChange={(e) => updateBudgetItem('aaRates', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.28" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.aaRates.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    <tr className="border-b border-gray-100"><td className="px-3 py-2 text-gray-700">Air/Bus Tickets</td><td className="px-2 py-2"><input type="number" value={travelData.budget.airBusTickets.quantity} onChange={(e) => updateBudgetItem('airBusTickets', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.airBusTickets.unitCost} onChange={(e) => updateBudgetItem('airBusTickets', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.airBusTickets.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    <tr className="border-b border-gray-100"><td className="px-3 py-2 text-gray-700">Conferencing Cost</td><td className="px-2 py-2"><input type="number" value={travelData.budget.conferencingCost.quantity} onChange={(e) => updateBudgetItem('conferencingCost', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.conferencingCost.unitCost} onChange={(e) => updateBudgetItem('conferencingCost', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.conferencingCost.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    <tr className="border-b border-gray-100"><td className="px-3 py-2 text-gray-700">Tollgates</td><td className="px-2 py-2"><input type="number" value={travelData.budget.tollgates.quantity} onChange={(e) => updateBudgetItem('tollgates', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.tollgates.unitCost} onChange={(e) => updateBudgetItem('tollgates', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.tollgates.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    <tr className="border-b border-gray-100"><td className="px-2 py-2"><input type="text" value={travelData.budget.other.description || ''} onChange={(e) => updateBudgetItem('other', 'description', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="Other (specify)" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.other.quantity} onChange={(e) => updateBudgetItem('other', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.other.unitCost} onChange={(e) => updateBudgetItem('other', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.other.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    <tr className="bg-gray-100 font-semibold"><td className="px-3 py-2 text-gray-900" colSpan={3}>GRAND TOTAL</td><td className="px-3 py-2 text-gray-900">USD {calculateGrandTotal()}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Approval Section */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
                            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Select Approvers <span className="text-danger-500">*</span>
                        </h3>
                        <p className="text-sm text-text-secondary mb-4">Select a user to act as each approver role. All 4 approvers are required.</p>

                        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" checked={useParallelApprovals} onChange={(e) => setUseParallelApprovals(e.target.checked)} className="mt-1 w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                                <div>
                                    <span className="font-semibold text-gray-900 block">Use Parallel Approvals</span>
                                    <span className="text-sm text-gray-500 mt-1 block">{useParallelApprovals ? 'All approvers will be notified immediately and can review the request simultaneously.' : 'Approvals will be processed sequentially in the order shown below.'}</span>
                                </div>
                            </label>
                        </div>

                        {showApproverDropdown && <div className="fixed inset-0 z-10" onClick={() => setShowApproverDropdown(null)} />}

                        <div className="space-y-4">
                            {approvalRoles.map((role, index) => {
                                const selectedUserId = selectedApprovers[role.key];
                                const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null;
                                const filteredUsers = getFilteredUsersForRole(role.key);

                                return (
                                    <div key={role.key} className="relative">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-primary-50 border-primary-200 text-primary-600 flex-shrink-0 mt-1"><span className="font-bold text-sm">{index + 1}</span></div>
                                            <div className="flex-1">
                                                <div className="mb-2"><h4 className="font-semibold text-gray-900">{role.label}</h4><p className="text-xs text-gray-500">{role.description}</p></div>
                                                {selectedUser ? (
                                                    <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 p-3 rounded-xl">
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0"><span className="text-sm font-medium text-primary-600">{selectedUser.display_name?.charAt(0)?.toUpperCase() || '?'}</span></div>
                                                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{selectedUser.display_name}</p><p className="text-xs text-gray-500 truncate">{selectedUser.email}</p></div>
                                                        <button type="button" onClick={() => handleRemoveApprover(role.key)} className="p-1.5 rounded-lg hover:bg-danger-50 text-gray-400 hover:text-danger-500 transition-colors" title="Remove"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <div className="relative">
                                                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                            <input type="text" className="w-full pl-10 pr-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" placeholder={`Search for ${role.label}...`} value={approverSearch[role.key]} onChange={(e) => { setApproverSearch(prev => ({ ...prev, [role.key]: e.target.value })); setShowApproverDropdown(role.key); }} onFocus={() => setShowApproverDropdown(role.key)} />
                                                        </div>
                                                        {showApproverDropdown === role.key && (
                                                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                                {loadingUsers ? <div className="p-3 text-center text-gray-500 text-sm">Loading users...</div> : filteredUsers.length === 0 ? <div className="p-3 text-center text-gray-500 text-sm">No users found</div> : filteredUsers.slice(0, 10).map(u => (
                                                                    <button key={u.id} type="button" onClick={() => handleSelectApprover(role.key, u.id)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left">
                                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><span className="text-sm font-medium text-gray-600">{u.display_name?.charAt(0)?.toUpperCase() || '?'}</span></div>
                                                                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{u.display_name}</p><p className="text-xs text-gray-500 truncate">{u.email}</p></div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* Fixed Bottom Actions */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64">
                    <div className="flex gap-3 max-w-5xl mx-auto">
                        {isApproverEditing ? (
                            <>
                                <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1" isLoading={loading}>Save Changes</Button>
                            </>
                        ) : isEditMode ? (
                            <>
                                <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1" isLoading={loading || savingDraft}>Save Changes</Button>
                            </>
                        ) : (
                            <>
                                <Button type="button" variant="secondary" onClick={handleSaveDraft} isLoading={savingDraft} disabled={loading}>Save Draft</Button>
                                <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1" isLoading={loading} disabled={savingDraft}>Submit Authorization</Button>
                            </>
                        )}
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
