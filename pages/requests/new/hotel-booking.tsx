import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useUserHrimsProfile } from '../../../hooks/useUserHrimsProfile';

interface SelectedBusinessUnit {
    id: string;
    name: string;
    bookingMade: boolean;
    arrivalDate: string;
    departureDate: string;
    numberOfNights: string;
    numberOfRooms: string;
    accommodationType: string;
    specialArrangements: string;
}

export default function HotelBookingPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { user } = useCurrentUser();
    const { departmentName, businessUnitName } = useUserHrimsProfile();
    const [businessUnits, setBusinessUnits] = useState<Array<{ id: string; name: string }>>([]);
    const [businessUnitsLoading, setBusinessUnitsLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedBusinessUnits, setSelectedBusinessUnits] = useState<SelectedBusinessUnit[]>([]);

    // Edit mode state
    const { edit: editRequestId, approver: isApproverEdit } = router.query;
    const isEditMode = !!editRequestId;
    const isApproverEditing = isApproverEdit === 'true';
    const [loadingRequest, setLoadingRequest] = useState(false);
    const [originalFormData, setOriginalFormData] = useState<any>(null);
    const [originalTravelData, setOriginalTravelData] = useState<any>(null);
    const [originalBusinessUnits, setOriginalBusinessUnits] = useState<SelectedBusinessUnit[]>([]);
    const [originalApprovers, setOriginalApprovers] = useState<Record<string, string> | null>(null);
    const [originalUseParallelApprovals, setOriginalUseParallelApprovals] = useState<boolean | null>(null);
    const [requestStatus, setRequestStatus] = useState<string>('draft');

    // Initial date for display
    const today = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Today's date in ISO format for min date validation
    const todayISO = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState({
        guestNames: '',
        isExternalGuest: false,
        allocationType: 'marketing_domestic',
        percentageDiscount: '',
        reason: '',
        processTravelDocument: false,
    });

    // Approver selection state - 4 fixed roles
    const approvalRoles = [
        { key: 'hod', label: 'Head of Department', description: 'Department Approval' },
        { key: 'hr_director', label: 'HR Director', description: 'HR Review' },
        { key: 'finance_director', label: 'Finance Director', description: 'Financial Review' },
        { key: 'ceo', label: 'CEO', description: 'Final Authorization' },
    ];
    const [users, setUsers] = useState<Array<{ id: string; display_name: string; email: string; job_title?: string }>>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [selectedApprovers, setSelectedApprovers] = useState<Record<string, string>>({
        hod: '',
        hr_director: '',
        finance_director: '',
        ceo: '',
    });
    const [approverSearch, setApproverSearch] = useState<Record<string, string>>({
        hod: '',
        hr_director: '',
        finance_director: '',
        ceo: '',
    });
    const [showApproverDropdown, setShowApproverDropdown] = useState<string | null>(null);
    const [useParallelApprovals, setUseParallelApprovals] = useState(false);

    // Travel document state
    const [travelData, setTravelData] = useState({
        dateOfIntendedTravel: '',
        purposeOfTravel: '',
        accompanyingAssociates: '',
        travelMode: '',
        acceptConditions: false,
        itinerary: [{ date: '', from: '', to: '', km: '', justification: '' }],
        hotelReservation: '',
        budget: {
            fuel: { quantity: '', unitCost: '', totalCost: '' },
            aaRates: { quantity: '', unitCost: '', totalCost: '' },
            airBusTickets: { quantity: '', unitCost: '', totalCost: '' },
            conferencingCost: { quantity: '', unitCost: '', totalCost: '' },
            tollgates: { quantity: '', unitCost: '', totalCost: '' },
            other: { description: '', quantity: '', unitCost: '', totalCost: '' },
        },
    });

    const addItineraryRow = () => {
        setTravelData(prev => ({
            ...prev,
            itinerary: [...prev.itinerary, { date: '', from: '', to: '', km: '', justification: '' }]
        }));
    };

    const updateItineraryRow = (index: number, field: string, value: string) => {
        setTravelData(prev => ({
            ...prev,
            itinerary: prev.itinerary.map((row, i) => 
                i === index ? { ...row, [field]: value } : row
            )
        }));
    };

    const removeItineraryRow = (index: number) => {
        if (travelData.itinerary.length > 1) {
            setTravelData(prev => ({
                ...prev,
                itinerary: prev.itinerary.filter((_, i) => i !== index)
            }));
        }
    };

    const calculateGrandTotal = () => {
        const budget = travelData.budget;
        const values = [
            budget.fuel.totalCost,
            budget.aaRates.totalCost,
            budget.airBusTickets.totalCost,
            budget.conferencingCost.totalCost,
            budget.tollgates.totalCost,
            budget.other.totalCost,
        ];
        return values.reduce((sum, val) => sum + (parseFloat(val) || 0), 0).toFixed(2);
    };

    const updateBudgetItem = (item: keyof typeof travelData.budget, field: string, value: string) => {
        setTravelData(prev => {
            const currentItem = prev.budget[item];
            const updatedItem = { ...currentItem, [field]: value };
            
            // Auto-calculate total cost when quantity or unit cost changes
            if (field === 'quantity' || field === 'unitCost') {
                const quantity = parseFloat(field === 'quantity' ? value : updatedItem.quantity) || 0;
                const unitCost = parseFloat(field === 'unitCost' ? value : updatedItem.unitCost) || 0;
                updatedItem.totalCost = (quantity * unitCost).toFixed(2);
            }
            
            return {
                ...prev,
                budget: {
                    ...prev.budget,
                    [item]: updatedItem,
                },
            };
        });
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
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

                // Store original data for comparison
                setOriginalFormData({
                    guestNames: metadata.guestNames || '',
                    isExternalGuest: metadata.isExternalGuest || false,
                    allocationType: metadata.allocationType || 'marketing_domestic',
                    percentageDiscount: metadata.percentageDiscount || '',
                    reason: metadata.reason || request.description || '',
                    processTravelDocument: metadata.processTravelDocument || false,
                });

                // Pre-fill form with existing data
                setFormData({
                    guestNames: metadata.guestNames || '',
                    isExternalGuest: metadata.isExternalGuest || false,
                    allocationType: metadata.allocationType || 'marketing_domestic',
                    percentageDiscount: metadata.percentageDiscount || '',
                    reason: metadata.reason || request.description || '',
                    processTravelDocument: metadata.processTravelDocument || false,
                });

                // Set business units
                if (metadata.selectedBusinessUnits && Array.isArray(metadata.selectedBusinessUnits)) {
                    setSelectedBusinessUnits(metadata.selectedBusinessUnits);
                    setOriginalBusinessUnits(metadata.selectedBusinessUnits);
                }

                // Set travel data if present
                if (metadata.travelDocument) {
                    setTravelData(metadata.travelDocument);
                    setOriginalTravelData(metadata.travelDocument);
                }

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

    // Fetch business units
    useEffect(() => {
        const fetchBusinessUnits = async () => {
            try {
                const response = await fetch('/api/business-units');
                if (response.ok) {
                    const data = await response.json();
                    setBusinessUnits(data.businessUnits || []);
                }
            } catch (err) {
                console.error('Failed to fetch business units:', err);
            } finally {
                setBusinessUnitsLoading(false);
            }
        };

        if (status === 'authenticated') {
            fetchBusinessUnits();
        }
    }, [status]);

    // Fetch users for approver selection
    useEffect(() => {
        const fetchUsers = async () => {
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

        if (status === 'authenticated') {
            fetchUsers();
        }
    }, [status]);

    // Filter users by search for a specific role
    const getFilteredUsersForRole = (roleKey: string) => {
        const searchTerm = approverSearch[roleKey] || '';
        const alreadySelectedIds = Object.values(selectedApprovers).filter(id => id);
        return users.filter(u => {
            const matchesSearch = searchTerm
                ? (u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
                : true;
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

    const handleBusinessUnitToggle = (unitId: string, unitName: string) => {
        setSelectedBusinessUnits(prev => {
            const exists = prev.find(u => u.id === unitId);
            if (exists) {
                return prev.filter(u => u.id !== unitId);
            }
            return [...prev, {
                id: unitId,
                name: unitName,
                bookingMade: false,
                arrivalDate: '',
                departureDate: '',
                numberOfNights: '',
                numberOfRooms: '',
                accommodationType: 'accommodation_only',
                specialArrangements: 'N/A',
            }];
        });
    };

    const handleBusinessUnitFieldChange = (unitId: string, field: keyof SelectedBusinessUnit, value: string | boolean) => {
        setSelectedBusinessUnits(prev =>
            prev.map(u => {
                if (u.id !== unitId) return u;
                const updated = { ...u, [field]: value };
                // Auto-calculate nights when dates change
                if ((field === 'arrivalDate' || field === 'departureDate') && updated.arrivalDate && updated.departureDate) {
                    const start = new Date(updated.arrivalDate);
                    const end = new Date(updated.departureDate);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    updated.numberOfNights = diffDays.toString();
                }
                return updated;
            })
        );
    };

    // Helper to get approver display name
    const getApproverName = (approverId: string) => {
        const user = users.find(u => u.id === approverId);
        return user ? user.display_name : approverId || 'None';
    };

    // Helper to collect field changes for approver edit tracking
    const collectFieldChanges = () => {
        if (!originalFormData) return [];
        const changes: { fieldName: string; oldValue: any; newValue: any }[] = [];

        if (formData.guestNames !== originalFormData.guestNames) {
            changes.push({ fieldName: 'guestNames', oldValue: originalFormData.guestNames, newValue: formData.guestNames });
        }
        if (formData.isExternalGuest !== originalFormData.isExternalGuest) {
            changes.push({ fieldName: 'isExternalGuest', oldValue: originalFormData.isExternalGuest, newValue: formData.isExternalGuest });
        }
        if (formData.allocationType !== originalFormData.allocationType) {
            changes.push({ fieldName: 'allocationType', oldValue: originalFormData.allocationType, newValue: formData.allocationType });
        }
        if (formData.percentageDiscount !== originalFormData.percentageDiscount) {
            changes.push({ fieldName: 'percentageDiscount', oldValue: originalFormData.percentageDiscount, newValue: formData.percentageDiscount });
        }
        if (formData.reason !== originalFormData.reason) {
            changes.push({ fieldName: 'reason', oldValue: originalFormData.reason, newValue: formData.reason });
        }
        if (JSON.stringify(selectedBusinessUnits) !== JSON.stringify(originalBusinessUnits)) {
            changes.push({ fieldName: 'selectedBusinessUnits', oldValue: JSON.stringify(originalBusinessUnits), newValue: JSON.stringify(selectedBusinessUnits) });
        }
        if (formData.processTravelDocument && originalTravelData && JSON.stringify(travelData) !== JSON.stringify(originalTravelData)) {
            changes.push({ fieldName: 'travelDocument', oldValue: JSON.stringify(originalTravelData), newValue: JSON.stringify(travelData) });
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
            const approversArray = [selectedApprovers.hod, selectedApprovers.hr_director, selectedApprovers.finance_director, selectedApprovers.ceo].filter(Boolean);

            const response = await fetch(`/api/requests/${editRequestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Hotel Booking: ${formData.guestNames}`,
                    description: formData.reason,
                    metadata: {
                        type: 'hotel_booking',
                        guestNames: formData.guestNames,
                        isExternalGuest: formData.isExternalGuest,
                        selectedBusinessUnits: selectedBusinessUnits,
                        allocationType: formData.allocationType,
                        percentageDiscount: formData.percentageDiscount,
                        reason: formData.reason,
                        processTravelDocument: formData.processTravelDocument,
                        ...(formData.processTravelDocument && { travelDocument: travelData }),
                        approvers: approversArray,
                        approverRoles: selectedApprovers,
                        useParallelApprovals: useParallelApprovals,
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
                    title: `Hotel Booking: ${formData.guestNames || 'Draft'}`,
                    description: formData.reason || 'Draft request',
                    metadata: {
                        type: 'hotel_booking',
                        guestNames: formData.guestNames,
                        isExternalGuest: formData.isExternalGuest,
                        selectedBusinessUnits: selectedBusinessUnits,
                        allocationType: formData.allocationType,
                        percentageDiscount: formData.percentageDiscount,
                        reason: formData.reason,
                        processTravelDocument: formData.processTravelDocument,
                        ...(formData.processTravelDocument && { travelDocument: travelData }),
                        approvers: approversArray,
                        approverRoles: selectedApprovers,
                        useParallelApprovals: useParallelApprovals,
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

        // Validation
        const errors: string[] = [];

        // Required: At least one business unit
        if (selectedBusinessUnits.length === 0) {
            errors.push('Please select at least one business unit');
        }

        // Required: Business unit fields
        for (const unit of selectedBusinessUnits) {
            if (!unit.arrivalDate) {
                errors.push(`Arrival date is required for ${unit.name}`);
            }
            if (!unit.departureDate) {
                errors.push(`Departure date is required for ${unit.name}`);
            }
            if (!unit.numberOfNights) {
                errors.push(`Number of nights is required for ${unit.name}`);
            }
            if (!unit.numberOfRooms) {
                errors.push(`Number of rooms is required for ${unit.name}`);
            }
            if (!unit.accommodationType) {
                errors.push(`Accommodation type is required for ${unit.name}`);
            }
        }

        // Required: Reason for complimentary
        if (!formData.reason.trim()) {
            errors.push('Reason for complimentary is required');
        }

        // Required: All 4 approvers
        if (!selectedApprovers.hod) {
            errors.push('Please select an approver for Head of Department');
        }
        if (!selectedApprovers.hr_director) {
            errors.push('Please select an approver for HR Director');
        }
        if (!selectedApprovers.finance_director) {
            errors.push('Please select an approver for Finance Director');
        }
        if (!selectedApprovers.ceo) {
            errors.push('Please select an approver for CEO');
        }

        // Validate dates are not in the past
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        
        for (const unit of selectedBusinessUnits) {
            if (unit.arrivalDate) {
                const arrivalDate = new Date(unit.arrivalDate);
                if (arrivalDate < todayDate) {
                    errors.push(`Arrival date for ${unit.name} cannot be in the past`);
                }
            }
            if (unit.departureDate) {
                const departureDate = new Date(unit.departureDate);
                if (departureDate < todayDate) {
                    errors.push(`Departure date for ${unit.name} cannot be in the past`);
                }
            }
        }

        // If processTravelDocument is checked, validate travel fields
        if (formData.processTravelDocument) {
            if (!travelData.dateOfIntendedTravel) {
                errors.push('Date of intended travel is required');
            } else {
                const travelDate = new Date(travelData.dateOfIntendedTravel);
                if (travelDate < todayDate) {
                    errors.push('Date of intended travel cannot be in the past');
                }
            }
            if (!travelData.purposeOfTravel.trim()) {
                errors.push('Purpose of travel is required');
            }
            if (!travelData.travelMode.trim()) {
                errors.push('Travel mode is required');
            }
            if (!travelData.acceptConditions) {
                errors.push('You must accept the travel conditions');
            }
            // At least one itinerary row with data
            const hasValidItinerary = travelData.itinerary.some(
                row => row.date || row.from || row.to
            );
            if (!hasValidItinerary) {
                errors.push('At least one travel itinerary row is required');
            }
            // At least one budget row with data
            const budget = travelData.budget;
            const hasValidBudget = 
                (budget.fuel.totalCost && parseFloat(budget.fuel.totalCost) > 0) ||
                (budget.aaRates.totalCost && parseFloat(budget.aaRates.totalCost) > 0) ||
                (budget.airBusTickets.totalCost && parseFloat(budget.airBusTickets.totalCost) > 0) ||
                (budget.conferencingCost.totalCost && parseFloat(budget.conferencingCost.totalCost) > 0) ||
                (budget.tollgates.totalCost && parseFloat(budget.tollgates.totalCost) > 0) ||
                (budget.other.totalCost && parseFloat(budget.other.totalCost) > 0);
            if (!hasValidBudget) {
                errors.push('At least one travel budget item is required');
            }
        }

        if (errors.length > 0) {
            setError(errors.join('. '));
            setLoading(false);
            return;
        }

        try {
            // Convert approvers object to ordered array for sequential approval
            // Order: HOD -> HR Director -> Finance Director -> CEO
            const approversArray = [
                selectedApprovers.hod,
                selectedApprovers.hr_director,
                selectedApprovers.finance_director,
                selectedApprovers.ceo,
            ].filter(Boolean); // Remove any empty values

            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: `Hotel Booking: ${formData.guestNames}`,
                    description: formData.reason,
                    priority: 'normal',
                    category: 'hotel',
                    requestType: 'hotel_booking',
                    status: 'pending', // Submit for approval immediately
                    metadata: {
                        guestNames: formData.guestNames,
                        isExternalGuest: formData.isExternalGuest,
                        selectedBusinessUnits: selectedBusinessUnits,
                        allocationType: formData.allocationType,
                        percentageDiscount: formData.percentageDiscount,
                        reason: formData.reason,
                        processTravelDocument: formData.processTravelDocument,
                        ...(formData.processTravelDocument && { travelDocument: travelData }),
                        approvers: approversArray, // Sequential array of approver IDs
                        approverRoles: selectedApprovers, // Keep original object for reference
                        useParallelApprovals: useParallelApprovals, // Parallel or sequential approval mode
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create hotel booking request');
            }

            router.push(`/requests/comp/${data.request.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to create hotel booking request');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        setSavingDraft(true);
        setError(null);

        try {
            // Convert approvers object to ordered array for sequential approval
            const approversArray = [
                selectedApprovers.hod,
                selectedApprovers.hr_director,
                selectedApprovers.finance_director,
                selectedApprovers.ceo,
            ].filter(Boolean);

            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: `Hotel Booking: ${formData.guestNames || 'Draft'}`,
                    description: formData.reason || 'Draft request',
                    priority: 'normal',
                    category: 'hotel',
                    requestType: 'hotel_booking',
                    status: 'draft',
                    metadata: {
                        guestNames: formData.guestNames,
                        isExternalGuest: formData.isExternalGuest,
                        selectedBusinessUnits: selectedBusinessUnits,
                        allocationType: formData.allocationType,
                        percentageDiscount: formData.percentageDiscount,
                        reason: formData.reason,
                        processTravelDocument: formData.processTravelDocument,
                        ...(formData.processTravelDocument && { travelDocument: travelData }),
                        approvers: approversArray,
                        approverRoles: selectedApprovers,
                        useParallelApprovals: useParallelApprovals,
                    },
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save draft');
            }

            router.push(`/requests/comp/${data.request.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to save draft');
        } finally {
            setSavingDraft(false);
        }
    };

    if (status === 'loading' || loadingRequest) {
        return (
            <AppLayout title="Hotel Booking" showBack onBack={() => router.back()}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
            </AppLayout>
        );
    }

    if (!session) return null;

    const pageTitle = isApproverEditing ? 'Edit Hotel Booking (Approver)' : isEditMode ? 'Edit Hotel Booking' : 'Hotel Booking';

    return (
        <AppLayout title={pageTitle} showBack onBack={() => router.back()} hideNav>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 max-w-5xl mx-auto pb-32">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-text-primary font-heading uppercase tracking-wide">
                        {isApproverEditing ? 'Edit Hotel Booking' : 'Complimentary Hotel Guest Booking Form'}
                    </h1>
                    {isApproverEditing && (
                        <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-xl">
                            <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span className="text-sm font-medium text-primary-700">Editing as Approver - Changes will be tracked</span>
                        </div>
                    )}
                </div>

                {error && (
                    <Card className="mb-4 bg-danger-50 border-danger-200">
                        <p className="text-danger-600 text-sm">{error}</p>
                    </Card>
                )}

                <div className="space-y-6">
                    {/* Requestor Information Section */}
                    <Card className="p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase border-b pb-2">Requestor Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Name</label>
                                <div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">
                                    {user?.display_name || session?.user?.name || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Business Unit</label>
                                <div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">
                                    {businessUnitName || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Department</label>
                                <div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">
                                    {departmentName || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Date</label>
                                <div className="px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600">
                                    {today}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Guest Section */}
                    <Card className="p-6">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Guest Name(s)</label>
                                <textarea
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[80px]"
                                    placeholder="Enter full names of all guests"
                                    value={formData.guestNames}
                                    onChange={(e) => setFormData({ ...formData, guestNames: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="isExternalGuest"
                                    checked={formData.isExternalGuest}
                                    onChange={(e) => setFormData({ ...formData, isExternalGuest: e.target.checked })}
                                    className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <label htmlFor="isExternalGuest" className="text-sm font-medium text-gray-700 cursor-pointer">
                                    External Guest (not part of staff)
                                </label>
                            </div>
                        </div>
                    </Card>

                    {/* Business Units Selection */}
                    <Card className="p-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase border-b pb-2">Select Business Units <span className="text-danger-500">*</span></h3>
                        <p className="text-sm text-gray-500 mb-4">Select at least one business unit for this booking. Each unit has its own booking details.</p>
                        <div className="space-y-4">
                            {businessUnits.map((unit) => {
                                const isSelected = selectedBusinessUnits.some(u => u.id === unit.id);
                                const selectedUnit = selectedBusinessUnits.find(u => u.id === unit.id);
                                return (
                                    <div
                                        key={unit.id}
                                        className={`rounded-xl border transition-all ${
                                            isSelected
                                                ? 'border-primary-300 bg-primary-50/50'
                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="p-4">
                                            <div className="flex items-center justify-between flex-wrap gap-4">
                                                <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-[200px]">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleBusinessUnitToggle(unit.id, unit.name)}
                                                        className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                                    />
                                                    <span className="font-semibold text-gray-900">{unit.name}</span>
                                                </label>
                                                {isSelected && (
                                                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-200">
                                                        <span className="text-sm text-gray-600">Tel / Telex / Booking Made?</span>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedUnit?.bookingMade || false}
                                                                onChange={() => handleBusinessUnitFieldChange(unit.id, 'bookingMade', !selectedUnit?.bookingMade)}
                                                                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                                            />
                                                            <span className="text-sm font-medium text-gray-700">Yes</span>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {isSelected && selectedUnit && (
                                            <div className="border-t border-primary-200 bg-white p-4 rounded-b-xl space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <Input 
                                                        type="date"
                                                        label ="Arrival Date *"
                                                        value={selectedUnit.arrivalDate}
                                                        onChange={(e) => handleBusinessUnitFieldChange(unit.id, 'arrivalDate', e.target.value)}
                                                        required
                                                        min={todayISO}
                                                    />
                                                    <Input
                                                        type="date"
                                                        label="Departure Date *"
                                                        value={selectedUnit.departureDate}
                                                        onChange={(e) => handleBusinessUnitFieldChange(unit.id, 'departureDate', e.target.value)}
                                                        required
                                                        min={selectedUnit.arrivalDate || todayISO}
                                                    />
                                                    <Input
                                                        type="number"
                                                        label="No. Of Nights *"
                                                        value={selectedUnit.numberOfNights}
                                                        placeholder="Auto-calculated"
                                                        readOnly
                                                        className="bg-gray-50"
                                                    />
                                                    <Input
                                                        type="number"
                                                        label="No. Of Rooms *"
                                                        value={selectedUnit.numberOfRooms}
                                                        onChange={(e) => handleBusinessUnitFieldChange(unit.id, 'numberOfRooms', e.target.value)}
                                                        required
                                                        min="1"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase">Accommodation Type <span className="text-danger-500">*</span></label>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                                            <input
                                                                type="radio"
                                                                name={`accommodationType_${unit.id}`}
                                                                value="accommodation_only"
                                                                checked={selectedUnit.accommodationType === 'accommodation_only'}
                                                                onChange={(e) => handleBusinessUnitFieldChange(unit.id, 'accommodationType', e.target.value)}
                                                                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                                            />
                                                            <span className="text-sm text-gray-700">Accommodation Only (Bed only)</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                                            <input
                                                                type="radio"
                                                                name={`accommodationType_${unit.id}`}
                                                                value="accommodation_and_breakfast"
                                                                checked={selectedUnit.accommodationType === 'accommodation_and_breakfast'}
                                                                onChange={(e) => handleBusinessUnitFieldChange(unit.id, 'accommodationType', e.target.value)}
                                                                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                                            />
                                                            <span className="text-sm text-gray-700">Bed & Breakfast</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                                            <input
                                                                type="radio"
                                                                name={`accommodationType_${unit.id}`}
                                                                value="accommodation_and_meals"
                                                                checked={selectedUnit.accommodationType === 'accommodation_and_meals'}
                                                                onChange={(e) => handleBusinessUnitFieldChange(unit.id, 'accommodationType', e.target.value)}
                                                                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                                            />
                                                            <span className="text-sm text-gray-700">Accommodation & Meals</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                                            <input
                                                                type="radio"
                                                                name={`accommodationType_${unit.id}`}
                                                                value="accommodation_meals_drink"
                                                                checked={selectedUnit.accommodationType === 'accommodation_meals_drink'}
                                                                onChange={(e) => handleBusinessUnitFieldChange(unit.id, 'accommodationType', e.target.value)}
                                                                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                                                            />
                                                            <span className="text-sm text-gray-700">Accommodation, Meals & Soft Drink</span>
                                                        </label>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Special Arrangements</label>
                                                    <textarea
                                                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[60px]"
                                                        value={selectedUnit.specialArrangements}
                                                        onChange={(e) => handleBusinessUnitFieldChange(unit.id, 'specialArrangements', e.target.value)}
                                                        placeholder="Any special arrangements for this business unit..."
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {businessUnitsLoading && (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto mb-2" />
                                    <p>Loading business units...</p>
                                </div>
                            )}
                            {!businessUnitsLoading && businessUnits.length === 0 && (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No business units available.</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Allocation */}
                    <Card className="p-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase">Allocation of Comp Booking</label>
                        <select
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all appearance-none"
                            value={formData.allocationType}
                            onChange={(e) => setFormData({ ...formData, allocationType: e.target.value })}
                        >
                            <option value="marketing_domestic">Marketing – Domestic</option>
                            <option value="marketing_international">Marketing – International</option>
                            <option value="administration">Administration</option>
                            <option value="promotions">Promotions</option>
                            <option value="personnel">Personnel</option>
                        </select>
                    </Card>

                    {/* Details */}
                    <Card className="p-6 space-y-6">
                        <div>
                            <Input
                                label="Percentage Discount (On accommodation only)"
                                placeholder="%"
                                type="number"
                                min="0"
                                max="100"
                                value={formData.percentageDiscount}
                                onChange={(e) => setFormData({ ...formData, percentageDiscount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Reason for complimentary <span className="text-danger-500">*</span></label>
                            <textarea
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[80px]"
                                value={formData.reason}
                                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            />
                        </div>
                    </Card>

                    {/* Travel Document Processing */}
                    <Card className="p-6">
                        <div className="flex items-start gap-4">
                            <input
                                type="checkbox"
                                id="processTravelDocument"
                                checked={formData.processTravelDocument}
                                onChange={(e) => setFormData({ ...formData, processTravelDocument: e.target.checked })}
                                className="mt-1 w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
                            />
                            <label htmlFor="processTravelDocument" className="cursor-pointer">
                                <span className="font-semibold text-gray-900 block">Process Travel Document</span>
                                <span className="text-sm text-gray-500 mt-1 block">
                                    Check this box if you would like to process your travel authorization document along with this booking request.
                                </span>
                            </label>
                        </div>
                    </Card>

                    {/* Travel Authorization Form - Conditionally Rendered */}
                    {formData.processTravelDocument && (
                        <Card className="p-6 border-primary-200 bg-primary-50/30">
                            <div className="mb-4 text-center border-b pb-4">
                                <h3 className="text-lg font-bold text-gray-800 uppercase">Local Travel Authorization</h3>
                                <p className="text-xs text-gray-500 mt-1">DOC NO: HR APX – 1 LOCAL TRAVEL AUTHORISATION</p>
                            </div>

                            <div className="space-y-6">
                                {/* Travel Details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        type="date"
                                        label="Date of Intended Travel *"
                                        value={travelData.dateOfIntendedTravel}
                                        onChange={(e) => setTravelData({ ...travelData, dateOfIntendedTravel: e.target.value })}
                                        required
                                        min={todayISO}
                                    />
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Purpose of Travel <span className="text-danger-500">*</span></label>
                                        <textarea
                                            className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[60px]"
                                            value={travelData.purposeOfTravel}
                                            onChange={(e) => setTravelData({ ...travelData, purposeOfTravel: e.target.value })}
                                            placeholder="Enter purpose of travel"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Accompanying Associates</label>
                                        <textarea
                                            className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none min-h-[60px]"
                                            value={travelData.accompanyingAssociates}
                                            onChange={(e) => setTravelData({ ...travelData, accompanyingAssociates: e.target.value })}
                                            placeholder="Enter names of accompanying associates (if any)"
                                        />
                                    </div>
                                    <Input
                                        label="Travel Mode (Vehicle Registration if Driving) *"
                                        value={travelData.travelMode}
                                        onChange={(e) => setTravelData({ ...travelData, travelMode: e.target.value })}
                                        placeholder="e.g., Company Vehicle ABC 1234"
                                    />
                                </div>

                                {/* Conditions */}
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                    <h4 className="font-semibold text-amber-800 mb-3 uppercase text-sm">Conditions of Travel</h4>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-amber-900">
                                        <li>Authorization must be sought using this form at least 7 days prior to departure.</li>
                                        <li>Travel expenses must be claimed within 30 days after completion of travel, otherwise the claim shall be void.</li>
                                        <li>It is an act of misconduct to travel without authority.</li>
                                    </ol>
                                    <div className="mt-4 flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="acceptConditions"
                                            checked={travelData.acceptConditions}
                                            onChange={(e) => setTravelData({ ...travelData, acceptConditions: e.target.checked })}
                                            className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                            required
                                        />
                                        <label htmlFor="acceptConditions" className="text-sm font-medium text-amber-900 cursor-pointer">
                                            I have read these conditions and accept them. <span className="text-danger-500">*</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Travel Itinerary */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-semibold text-gray-700 uppercase text-sm">Travel Itinerary <span className="text-danger-500">*</span></h4>
                                        <button
                                            type="button"
                                            onClick={addItineraryRow}
                                            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Add Row
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Date/Time</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">From</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">To</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">KM</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Justification</th>
                                                    <th className="px-3 py-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {travelData.itinerary.map((row, index) => (
                                                    <tr key={index} className="border-b border-gray-100">
                                                        <td className="px-2 py-2">
                                                            <input
                                                                type="date"
                                                                value={row.date}
                                                                onChange={(e) => updateItineraryRow(index, 'date', e.target.value)}
                                                                className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <input
                                                                type="text"
                                                                value={row.from}
                                                                onChange={(e) => updateItineraryRow(index, 'from', e.target.value)}
                                                                className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                                placeholder="Origin"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <input
                                                                type="text"
                                                                value={row.to}
                                                                onChange={(e) => updateItineraryRow(index, 'to', e.target.value)}
                                                                className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                                placeholder="Destination"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <input
                                                                type="number"
                                                                value={row.km}
                                                                onChange={(e) => updateItineraryRow(index, 'km', e.target.value)}
                                                                className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                                placeholder="0"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <input
                                                                type="text"
                                                                value={row.justification}
                                                                onChange={(e) => updateItineraryRow(index, 'justification', e.target.value)}
                                                                className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                                placeholder="Reason"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            {travelData.itinerary.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItineraryRow(index)}
                                                                    className="text-red-500 hover:text-red-700"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                

                                {/* Travel Budget */}
                                <div>
                                    <h4 className="font-semibold text-gray-700 uppercase text-sm mb-3">Travel Budget <span className="text-danger-500">*</span></h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Expenditure Item</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">Quantity</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Unit Cost (USD)</th>
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Total Cost (USD)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-gray-100">
                                                    <td className="px-3 py-2 text-gray-700">Fuel (Litres)</td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.fuel.quantity}
                                                            onChange={(e) => updateBudgetItem('fuel', 'quantity', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.fuel.unitCost}
                                                            onChange={(e) => updateBudgetItem('fuel', 'unitCost', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.fuel.totalCost}
                                                            readOnly
                                                            className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="px-3 py-2 text-gray-700">AA Rates (KM)</td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.aaRates.quantity}
                                                            onChange={(e) => updateBudgetItem('aaRates', 'quantity', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.aaRates.unitCost}
                                                            onChange={(e) => updateBudgetItem('aaRates', 'unitCost', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0.28"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.aaRates.totalCost}
                                                            readOnly
                                                            className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="px-3 py-2 text-gray-700">Air/Bus Tickets</td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.airBusTickets.quantity}
                                                            onChange={(e) => updateBudgetItem('airBusTickets', 'quantity', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.airBusTickets.unitCost}
                                                            onChange={(e) => updateBudgetItem('airBusTickets', 'unitCost', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.airBusTickets.totalCost}
                                                            readOnly
                                                            className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="px-3 py-2 text-gray-700">Conferencing Cost</td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.conferencingCost.quantity}
                                                            onChange={(e) => updateBudgetItem('conferencingCost', 'quantity', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.conferencingCost.unitCost}
                                                            onChange={(e) => updateBudgetItem('conferencingCost', 'unitCost', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.conferencingCost.totalCost}
                                                            readOnly
                                                            className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="px-3 py-2 text-gray-700">Tollgates</td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.tollgates.quantity}
                                                            onChange={(e) => updateBudgetItem('tollgates', 'quantity', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.tollgates.unitCost}
                                                            onChange={(e) => updateBudgetItem('tollgates', 'unitCost', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.tollgates.totalCost}
                                                            readOnly
                                                            className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-gray-100">
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="text"
                                                            value={travelData.budget.other.description}
                                                            onChange={(e) => updateBudgetItem('other', 'description', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="Other (specify)"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.other.quantity}
                                                            onChange={(e) => updateBudgetItem('other', 'quantity', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.other.unitCost}
                                                            onChange={(e) => updateBudgetItem('other', 'unitCost', e.target.value)}
                                                            className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={travelData.budget.other.totalCost}
                                                            readOnly
                                                            className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm"
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                </tr>
                                                <tr className="bg-gray-100 font-semibold">
                                                    <td className="px-3 py-2 text-gray-900" colSpan={3}>GRAND TOTAL</td>
                                                    <td className="px-3 py-2 text-gray-900">USD {calculateGrandTotal()}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Approval Section - 4 Fixed Roles */}
                    <Card className="p-6">
                        <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
                            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Select Approvers <span className="text-danger-500">*</span>
                        </h3>
                        <p className="text-sm text-text-secondary mb-4">
                            Select a user to act as each approver role. All 4 approvers are required.
                        </p>

                        {/* Parallel vs Sequential Approval Toggle */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useParallelApprovals}
                                    onChange={(e) => setUseParallelApprovals(e.target.checked)}
                                    className="mt-1 w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <div>
                                    <span className="font-semibold text-gray-900 block">Use Parallel Approvals</span>
                                    <span className="text-sm text-gray-500 mt-1 block">
                                        {useParallelApprovals 
                                            ? 'All approvers will be notified immediately and can review the request simultaneously. Any approver can approve or reject at any time.'
                                            : 'Approvals will be processed sequentially in the order shown below. Each approver must complete their review before the next approver is notified.'}
                                    </span>
                                </div>
                            </label>
                        </div>

                        {/* Click outside to close any dropdown */}
                        {showApproverDropdown && (
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowApproverDropdown(null)}
                            />
                        )}

                        {/* Approval Roles */}
                        <div className="space-y-4">
                            {approvalRoles.map((role, index) => {
                                const selectedUserId = selectedApprovers[role.key];
                                const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null;
                                const filteredUsers = getFilteredUsersForRole(role.key);

                                return (
                                    <div key={role.key} className="relative">
                                        <div className="flex items-start gap-4">
                                            {/* Step Number */}
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-primary-50 border-primary-200 text-primary-600 flex-shrink-0 mt-1">
                                                <span className="font-bold text-sm">{index + 1}</span>
                                            </div>

                                            <div className="flex-1">
                                                {/* Role Label */}
                                                <div className="mb-2">
                                                    <h4 className="font-semibold text-gray-900">{role.label}</h4>
                                                    <p className="text-xs text-gray-500">{role.description}</p>
                                                </div>

                                                {/* Selected User or Search Input */}
                                                {selectedUser ? (
                                                    <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 p-3 rounded-xl">
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-sm font-medium text-primary-600">
                                                                {selectedUser.display_name?.charAt(0)?.toUpperCase() || '?'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 truncate">{selectedUser.display_name}</p>
                                                            <p className="text-xs text-gray-500 truncate">{selectedUser.email}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveApprover(role.key)}
                                                            className="p-1.5 rounded-lg hover:bg-danger-50 text-gray-400 hover:text-danger-500 transition-colors"
                                                            title="Remove"
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
                                                                className="w-full pl-10 pr-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                                                placeholder={`Search for ${role.label}...`}
                                                                value={approverSearch[role.key] || ''}
                                                                onChange={(e) => {
                                                                    setApproverSearch(prev => ({ ...prev, [role.key]: e.target.value }));
                                                                    setShowApproverDropdown(role.key);
                                                                }}
                                                                onFocus={() => setShowApproverDropdown(role.key)}
                                                            />
                                                        </div>

                                                        {/* Dropdown Results */}
                                                        {showApproverDropdown === role.key && (
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
                                                                    filteredUsers.slice(0, 10).map((u) => (
                                                                        <button
                                                                            key={u.id}
                                                                            type="button"
                                                                            onClick={() => handleSelectApprover(role.key, u.id)}
                                                                            className="w-full px-4 py-3 text-left hover:bg-primary-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                                                                        >
                                                                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                                                                <span className="text-sm font-medium text-primary-600">
                                                                                    {u.display_name?.charAt(0)?.toUpperCase() || '?'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-sm font-medium text-gray-900 truncate">{u.display_name}</p>
                                                                                <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                                                            </div>
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Connecting line between steps */}
                                        {index < approvalRoles.length - 1 && (
                                            <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200 -mb-4 h-8" style={{ transform: 'translateX(-50%)' }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>

                {/* Footer Action Bar */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64 z-10 shadow-lg">
                    <div className="flex gap-3 max-w-5xl mx-auto">
                        {isApproverEditing ? (
                            <>
                                <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1 shadow-primary-500/25 shadow-lg" isLoading={loading}>Save Changes</Button>
                            </>
                        ) : isEditMode ? (
                            <>
                                <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>Cancel</Button>
                                <Button type="submit" variant="primary" className="flex-1 shadow-primary-500/25 shadow-lg" isLoading={loading || savingDraft}>Save Changes</Button>
                            </>
                        ) : (
                            <>
                                <Button type="button" variant="secondary" className="flex-1" onClick={() => router.back()}>Cancel</Button>
                                <Button type="button" variant="secondary" className="flex-1 border-primary-300 text-primary-600 hover:bg-primary-50" onClick={handleSaveDraft} isLoading={savingDraft} disabled={loading}>Save as Draft</Button>
                                <Button type="submit" variant="primary" className="flex-1 shadow-primary-500/25 shadow-lg" isLoading={loading} disabled={savingDraft}>Submit Request</Button>
                            </>
                        )}
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
