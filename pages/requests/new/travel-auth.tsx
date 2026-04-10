import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useUserHrimsProfile } from '../../../hooks/useUserHrimsProfile';
import { calculateTollgatesForItinerary, getTollgateRouteInfo, TollgateRouteType } from '../../../lib/formConfig';

interface ItineraryRow {
    date: string;
    from: string;
    fromCustom?: string;
    to: string;
    toCustom?: string;
    km: string;
    justification: string;
}

interface CostAllocation {
    corp: string;
    mrc: string;
    nah: string;
    rth: string;
    khcc: string;
    brh: string;
    vfrh: string;
    azam: string;
}

// Business units for travel itinerary (excluding RTG SA, Heritage Expeditions, Gateway Stream, Head Office)
const TRAVEL_LOCATIONS = [
    { code: 'MRC', name: 'Montclaire Resort and Conferencing (MRC)', city: 'Nyanga' },
    { code: 'NAH', name: 'New Ambassador Hotel (NAH)', city: 'Harare' },
    { code: 'RTH', name: 'Rainbow Towers Hotel (RTH)', city: 'Harare' },
    { code: 'KHCC', name: 'KHCC Conference Centre', city: 'Kadoma' },
    { code: 'BRH', name: 'Bulawayo Rainbow Hotel (BRH)', city: 'Bulawayo' },
    { code: 'VFRH', name: 'Victoria Falls Rainbow Hotel (VFRH)', city: 'Victoria Falls' },
    { code: 'AZAM', name: 'A\'Zambezi River Lodge (AZAM)', city: 'Victoria Falls' },
    { code: 'OTHER', name: 'Other (Manual Entry)', city: '' },
];

// Inter-business unit distances in KM (exact values from distance matrix)
const DISTANCE_MATRIX: Record<string, Record<string, number>> = {
    'RTH':  { 'RTH': 0,   'NAH': 2.1,   'KHCC': 139,   'BRH': 440,   'AZAM': 713,   'VFRH': 709,   'MRC': 272 },
    'NAH':  { 'RTH': 2.1, 'NAH': 0,     'KHCC': 136.9, 'BRH': 437.9, 'AZAM': 710.9, 'VFRH': 706.9, 'MRC': 269.9 },
    'KHCC': { 'RTH': 139, 'NAH': 140, 'KHCC': 0,     'BRH': 301,   'AZAM': 574,   'VFRH': 570,   'MRC': 133 },
    'BRH':  { 'RTH': 440, 'NAH': 437.9, 'KHCC': 301,   'BRH': 0,     'AZAM': 273,   'VFRH': 269,   'MRC': 168 },
    'AZAM': { 'RTH': 713, 'NAH': 710.9, 'KHCC': 574,   'BRH': 273,   'AZAM': 0,     'VFRH': 4,     'MRC': 441 },
    'VFRH': { 'RTH': 709, 'NAH': 706.9, 'KHCC': 570,   'BRH': 269,   'AZAM': 4,     'VFRH': 0,     'MRC': 437 },
    'MRC':  { 'RTH': 272, 'NAH': 269.9, 'KHCC': 133,   'BRH': 168,   'AZAM': 441,   'VFRH': 437,   'MRC': 0 },
};

// Get distance between two locations
const getDistance = (from: string, to: string): number => {
    if (!from || !to) return 0;
    return DISTANCE_MATRIX[from]?.[to] || 0;
};

interface BudgetItem {
    quantity: string;
    unitCost: string;
    totalCost: string;
    description?: string;
}

interface TollgateEntry {
    road: string;
    quantity: string;
    unitCost: string;
    totalCost: string;
}

interface AACalculatorData {
    engineCapacity: string;
    fuelType: 'petrol' | 'diesel';
}

// AA Rate table based on engine capacity and fuel type (USD per km)
const AA_RATES: Record<string, { petrol: number; diesel: number }> = {
    '1.1L-1.5L': { petrol: 0.28, diesel: 0.26 },
    '1.6L-2.0L': { petrol: 0.35, diesel: 0.32 },
    '2.1L-3.0L': { petrol: 0.48, diesel: 0.45 },
    'Above 3.0L': { petrol: 0.59, diesel: 0.56 },
};

interface TravelData {
    dateOfIntendedTravel: string;
    purposeOfTravel: string;
    accompanyingAssociates: string;
    travelMode: string;
    vehicleRegistration?: string;
    acceptConditions: boolean;
    itinerary: ItineraryRow[];
    budget: {
        fuel: BudgetItem;
        aaRates: BudgetItem;
        airBusTickets: BudgetItem;
        conferencingCost: BudgetItem;
        tollgates: TollgateEntry[];
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

    // AA Rates Calculator state (simplified)
    const [aaCalculator, setAACalculator] = useState<AACalculatorData>({
        engineCapacity: '1.6L-2.0L',
        fuelType: 'petrol',
    });

    // Get AA Rate based on engine capacity and fuel type
    const getAARate = (): number => {
        const rates = AA_RATES[aaCalculator.engineCapacity];
        if (!rates) return 0;
        return rates[aaCalculator.fuelType];
    };

    // Calculate and apply AA rate to travel budget
    const applyAARate = () => {
        const rate = getAARate();
        const totalKm = travelData.itinerary.reduce((sum, row) => sum + (parseFloat(row.km) || 0), 0);
        const travelCost = (totalKm * rate).toFixed(2);
        
        setTravelData(prev => ({
            ...prev,
            budget: {
                ...prev.budget,
                aaRates: {
                    quantity: totalKm.toString(),
                    unitCost: rate.toFixed(2),
                    totalCost: travelCost,
                }
            }
        }));
        setAaRatesLocked(true);
    };

    // State to track if AA rates are locked (applied from calculator)
    const [aaRatesLocked, setAaRatesLocked] = useState(false);

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
            tollgates: [{ road: '', quantity: '1', unitCost: '', totalCost: '' }],
            other: { description: '', quantity: '', unitCost: '', totalCost: '' },
        },
    });

    const approvalRoles = [
        { key: 'line_manager', label: 'Line Manager', description: 'Recommendation' },
        { key: 'functional_head', label: 'Functional Head', description: 'Functional Approval' },
        { key: 'hrd', label: 'HRD', description: 'HRD Approval' },
        { key: 'ceo', label: 'CEO', description: 'Authorisation' },
    ];

    const [users, setUsers] = useState<Array<{ id: string; display_name: string; email: string; job_title?: string }>>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [selectedApprovers, setSelectedApprovers] = useState<Record<string, string>>({
        line_manager: '', functional_head: '', hrd: '', ceo: '',
    });
    const [approverSearch, setApproverSearch] = useState<Record<string, string>>({
        line_manager: '', functional_head: '', hrd: '', ceo: '',
    });
    const [showApproverDropdown, setShowApproverDropdown] = useState<string | null>(null);
    const [useParallelApprovals, setUseParallelApprovals] = useState(false);

    // Emergency request state (for travel within 7 days)
    const [isEmergencyRequest, setIsEmergencyRequest] = useState(false);
    const [emergencyReason, setEmergencyReason] = useState('');

    // Tollgate route type selection (premium or standard)
    const [tollgateRouteType, setTollgateRouteType] = useState<TollgateRouteType>('premium');

    // Cost allocation is now auto-calculated, no need for state

    // Check if travel date is within 7 days
    const isTravelWithin7Days = () => {
        if (!travelData.dateOfIntendedTravel) return false;
        const travelDate = new Date(travelData.dateOfIntendedTravel);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffTime = travelDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays < 7 && diffDays >= 0;
    };

    const addItineraryRow = () => {
        setTravelData(prev => ({
            ...prev,
            itinerary: [...prev.itinerary, { date: '', from: '', to: '', km: '', justification: '' }]
        }));
    };

    const updateItineraryRow = (index: number, field: string, value: string) => {
        setTravelData(prev => {
            const updatedItinerary = prev.itinerary.map((row, i) => {
                if (i !== index) return row;
                const updatedRow = { ...row, [field]: value };
                // Auto-calculate KM when From or To changes (only if neither is 'OTHER')
                if (field === 'from' || field === 'to') {
                    const fromCode = field === 'from' ? value : row.from;
                    const toCode = field === 'to' ? value : row.to;
                    if (fromCode && toCode && fromCode !== 'OTHER' && toCode !== 'OTHER') {
                        updatedRow.km = getDistance(fromCode, toCode).toString();
                    } else if (fromCode === 'OTHER' || toCode === 'OTHER') {
                        // Clear KM when switching to OTHER so user can enter manually
                        updatedRow.km = '';
                    }
                }
                return updatedRow;
            });
            return { ...prev, itinerary: updatedItinerary };
        });
        // Unlock AA rates if itinerary changes (user needs to recalculate)
        if (field === 'from' || field === 'to' || field === 'km') {
            setAaRatesLocked(false);
        }
    };

    const removeItineraryRow = (index: number) => {
        if (travelData.itinerary.length > 1) {
            setTravelData(prev => ({ ...prev, itinerary: prev.itinerary.filter((_, i) => i !== index) }));
        }
    };

    // Calculate total tollgates cost
    const calculateTollgatesTotal = () => {
        return travelData.budget.tollgates.reduce((sum, t) => sum + (parseFloat(t.totalCost) || 0), 0);
    };

    const calculateGrandTotal = () => {
        const b = travelData.budget;
        const tollgatesTotal = calculateTollgatesTotal();
        return [b.aaRates.totalCost, b.airBusTickets.totalCost, b.conferencingCost.totalCost, b.other.totalCost]
            .reduce((sum, val) => sum + (parseFloat(val) || 0), tollgatesTotal).toFixed(2);
    };

    // Calculate cost allocation based on itinerary destinations
    const calculateCostAllocation = (): CostAllocation => {
        const grandTotal = parseFloat(calculateGrandTotal()) || 0;
        const unitCodes = ['MRC', 'NAH', 'RTH', 'KHCC', 'BRH', 'VFRH', 'AZAM'];
        const unitKeys: (keyof CostAllocation)[] = ['mrc', 'nah', 'rth', 'khcc', 'brh', 'vfrh', 'azam'];
        
        // Count visits to each unit from itinerary (both from and to)
        const visitCounts: Record<string, number> = {};
        travelData.itinerary.forEach(row => {
            if (row.from && row.from !== 'OTHER') {
                visitCounts[row.from] = (visitCounts[row.from] || 0) + 1;
            }
            if (row.to && row.to !== 'OTHER') {
                visitCounts[row.to] = (visitCounts[row.to] || 0) + 1;
            }
        });
        
        const totalVisits = Object.values(visitCounts).reduce((sum, count) => sum + count, 0);
        
        const allocation: CostAllocation = { corp: '', mrc: '', nah: '', rth: '', khcc: '', brh: '', vfrh: '', azam: '' };
        
        if (totalVisits > 0 && grandTotal > 0) {
            unitCodes.forEach((code, idx) => {
                const visits = visitCounts[code] || 0;
                if (visits > 0) {
                    const share = (visits / totalVisits) * grandTotal;
                    allocation[unitKeys[idx]] = share.toFixed(2);
                }
            });
        }
        
        return allocation;
    };

    const updateBudgetItem = (item: 'fuel' | 'aaRates' | 'airBusTickets' | 'conferencingCost' | 'other', field: string, value: string) => {
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

    // Tollgate management functions
    const addTollgateRow = () => {
        setTravelData(prev => ({
            ...prev,
            budget: {
                ...prev.budget,
                tollgates: [...prev.budget.tollgates, { road: '', quantity: '1', unitCost: '', totalCost: '' }]
            }
        }));
    };

    const updateTollgateRow = (index: number, field: keyof TollgateEntry, value: string) => {
        setTravelData(prev => {
            const updatedTollgates = prev.budget.tollgates.map((t, i) => {
                if (i !== index) return t;
                const updated = { ...t, [field]: value };
                if (field === 'quantity' || field === 'unitCost') {
                    const qty = parseFloat(field === 'quantity' ? value : updated.quantity) || 0;
                    const uc = parseFloat(field === 'unitCost' ? value : updated.unitCost) || 0;
                    updated.totalCost = (qty * uc).toFixed(2);
                }
                return updated;
            });
            return { ...prev, budget: { ...prev.budget, tollgates: updatedTollgates } };
        });
    };

    const removeTollgateRow = (index: number) => {
        if (travelData.budget.tollgates.length > 1) {
            setTravelData(prev => ({
                ...prev,
                budget: {
                    ...prev.budget,
                    tollgates: prev.budget.tollgates.filter((_, i) => i !== index)
                }
            }));
        }
    };

    // Auto-calculate tollgates based on itinerary routes
    const autoCalculateTollgates = () => {
        const calculatedTollgates = calculateTollgatesForItinerary(travelData.itinerary, tollgateRouteType);
        setTravelData(prev => ({
            ...prev,
            budget: {
                ...prev.budget,
                tollgates: calculatedTollgates,
            }
        }));
    };

    // Get tollgate summary for display
    const getTollgateSummary = () => {
        const routes: string[] = [];
        for (const row of travelData.itinerary) {
            if (!row.from || !row.to || row.from === 'OTHER' || row.to === 'OTHER') continue;
            const info = getTollgateRouteInfo(row.from, row.to);
            if (info && (info.premium > 0 || info.standard > 0)) {
                routes.push(`${row.from}→${row.to}: ${info.premium} premium ($${info.premiumCost}), ${info.standard} standard ($${info.standardCost})`);
            }
        }
        return routes;
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
        
        // 7-day advance validation
        if (travelData.dateOfIntendedTravel && isTravelWithin7Days()) {
            if (!isEmergencyRequest) {
                errors.push('Travel within 7 days requires flagging as an emergency request');
            } else if (!emergencyReason.trim()) {
                errors.push('Emergency reason is required for travel within 7 days');
            }
        }

        if (!travelData.purposeOfTravel.trim()) errors.push('Purpose of travel is required');
        if (!travelData.travelMode.trim()) errors.push('Travel mode is required');
        if (travelData.travelMode === 'personal_motor_vehicle' && !travelData.vehicleRegistration?.trim()) {
            errors.push('Vehicle registration number is required for personal motor vehicle');
        }
        if (!travelData.acceptConditions) errors.push('You must accept the travel conditions');

        const hasValidItinerary = travelData.itinerary.some(row => row.date || row.from || row.to);
        if (!hasValidItinerary) errors.push('At least one travel itinerary row is required');

        const b = travelData.budget;
        const tollgatesTotal = calculateTollgatesTotal();
        const hasValidBudget = [b.fuel.totalCost, b.aaRates.totalCost, b.airBusTickets.totalCost, b.conferencingCost.totalCost, b.other.totalCost]
            .some(val => parseFloat(val) > 0) || tollgatesTotal > 0;
        if (!hasValidBudget) errors.push('At least one travel budget item is required');

        if (!selectedApprovers.line_manager) errors.push('Please select an approver for Line Manager');
        if (!selectedApprovers.functional_head) errors.push('Please select an approver for Functional Head');
        if (!selectedApprovers.hrd) errors.push('Please select an approver for HRD');
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
            const approversArray = [selectedApprovers.line_manager, selectedApprovers.functional_head, selectedApprovers.hrd, selectedApprovers.ceo].filter(Boolean);
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
                        costAllocation: calculateCostAllocation(),
                        grandTotal: calculateGrandTotal(),
                        isEmergencyRequest: isTravelWithin7Days() ? isEmergencyRequest : false,
                        emergencyReason: isTravelWithin7Days() && isEmergencyRequest ? emergencyReason : '',
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
            const approversArray = [selectedApprovers.line_manager, selectedApprovers.functional_head, selectedApprovers.hrd, selectedApprovers.ceo].filter(Boolean);
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
            const approversArray = [selectedApprovers.line_manager, selectedApprovers.functional_head, selectedApprovers.hrd, selectedApprovers.ceo].filter(Boolean);
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
                        costAllocation: calculateCostAllocation(),
                        grandTotal: calculateGrandTotal(),
                        isEmergencyRequest: isTravelWithin7Days() ? isEmergencyRequest : false,
                        emergencyReason: isTravelWithin7Days() && isEmergencyRequest ? emergencyReason : '',
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
            const approversArray = [selectedApprovers.line_manager, selectedApprovers.functional_head, selectedApprovers.hrd, selectedApprovers.ceo].filter(Boolean);
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
                        type: 'travel_authorization',
                        dateOfIntendedTravel: travelData.dateOfIntendedTravel,
                        purposeOfTravel: travelData.purposeOfTravel,
                        accompanyingAssociates: travelData.accompanyingAssociates,
                        travelMode: travelData.travelMode,
                        isEmergencyRequest: isTravelWithin7Days() ? isEmergencyRequest : false,
                        emergencyReason: isTravelWithin7Days() && isEmergencyRequest ? emergencyReason : '',
                        acceptConditions: travelData.acceptConditions,
                        itinerary: travelData.itinerary,
                        budget: travelData.budget,
                        costAllocation: calculateCostAllocation(),
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
                    <p className="text-xs text-gray-500 mt-1">DOC NO: HR APX – 27 LOCAL TRAVEL AUTHORISATION</p>
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
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1 uppercase">Travel Mode <span className="text-danger-500">*</span></label>
                                    <select
                                        value={travelData.travelMode}
                                        onChange={(e) => setTravelData({ ...travelData, travelMode: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                                        required
                                    >
                                        <option value="">Select Travel Mode</option>
                                        <option value="personal_motor_vehicle">Personal Motor Vehicle</option>
                                        <option value="air_transport">Air Transport</option>
                                        <option value="bus_public_transport">Bus / Public Transport</option>
                                    </select>
                                </div>
                            </div>
                            {/* Vehicle Registration - only for Personal Motor Vehicle */}
                            {travelData.travelMode === 'personal_motor_vehicle' && (
                                <div className="mt-4">
                                    <Input
                                        label="Vehicle Registration Number *"
                                        value={travelData.vehicleRegistration || ''}
                                        onChange={(e) => setTravelData({ ...travelData, vehicleRegistration: e.target.value })}
                                        placeholder="e.g., ABC 1234"
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Emergency Request Warning - Shows when travel is within 7 days */}
                    {isTravelWithin7Days() && (
                        <Card className="p-6 bg-red-50 border-2 border-red-300">
                            <div className="flex items-start gap-3 mb-4">
                                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <h4 className="font-bold text-red-800 uppercase text-sm">Emergency Travel Request Required</h4>
                                    <p className="text-sm text-red-700 mt-1">
                                        Your travel date is within 7 days. Per company policy, authorization must be sought at least 7 days prior to departure. 
                                        To proceed, you must flag this as an emergency request and provide a valid reason.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4 bg-white rounded-xl p-4 border border-red-200">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="isEmergencyRequest"
                                        checked={isEmergencyRequest}
                                        onChange={(e) => setIsEmergencyRequest(e.target.checked)}
                                        className="w-5 h-5 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="isEmergencyRequest" className="text-sm font-semibold text-red-800 cursor-pointer">
                                        I confirm this is an emergency travel request <span className="text-red-600">*</span>
                                    </label>
                                </div>
                                {isEmergencyRequest && (
                                    <div>
                                        <label className="block text-sm font-semibold text-red-800 mb-1 uppercase">
                                            Reason for Emergency Travel <span className="text-red-600">*</span>
                                        </label>
                                        <textarea
                                            className="w-full px-4 py-2 rounded-xl border border-red-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none min-h-[80px]"
                                            value={emergencyReason}
                                            onChange={(e) => setEmergencyReason(e.target.value)}
                                            placeholder="Please explain why this travel request could not be submitted 7 days in advance..."
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

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
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Date/Time</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">From</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">To</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700 w-20">KM</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Justification</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {travelData.itinerary.map((row, index) => {
                                        const isFromOther = row.from === 'OTHER';
                                        const isToOther = row.to === 'OTHER';
                                        const isManualEntry = isFromOther || isToOther;
                                        return (
                                            <tr key={index} className="border-b border-gray-100">
                                                <td className="px-2 py-2">
                                                    <input type="date" value={row.date} onChange={(e) => updateItineraryRow(index, 'date', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <div className="space-y-1">
                                                        <select value={row.from} onChange={(e) => updateItineraryRow(index, 'from', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm">
                                                            <option value="">Select Origin</option>
                                                            {TRAVEL_LOCATIONS.map(loc => (
                                                                <option key={loc.code} value={loc.code}>{loc.name}</option>
                                                            ))}
                                                        </select>
                                                        {isFromOther && (
                                                            <input type="text" value={row.fromCustom || ''} onChange={(e) => updateItineraryRow(index, 'fromCustom', e.target.value)} className="w-full px-2 py-1 rounded border border-orange-300 focus:ring-1 focus:ring-orange-500 outline-none text-sm bg-orange-50" placeholder="Enter custom origin" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <div className="space-y-1">
                                                        <select value={row.to} onChange={(e) => updateItineraryRow(index, 'to', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm">
                                                            <option value="">Select Destination</option>
                                                            {TRAVEL_LOCATIONS.map(loc => (
                                                                <option key={loc.code} value={loc.code}>{loc.name}</option>
                                                            ))}
                                                        </select>
                                                        {isToOther && (
                                                            <input type="text" value={row.toCustom || ''} onChange={(e) => updateItineraryRow(index, 'toCustom', e.target.value)} className="w-full px-2 py-1 rounded border border-orange-300 focus:ring-1 focus:ring-orange-500 outline-none text-sm bg-orange-50" placeholder="Enter custom destination" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="number" value={row.km} readOnly={!isManualEntry} onChange={(e) => isManualEntry && updateItineraryRow(index, 'km', e.target.value)} className={`w-full px-2 py-1 rounded border outline-none text-sm text-center font-medium ${isManualEntry ? 'border-orange-300 bg-orange-50 focus:ring-1 focus:ring-orange-500' : 'border-gray-200 bg-gray-50'}`} placeholder="0" />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input type="text" value={row.justification} onChange={(e) => updateItineraryRow(index, 'justification', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="Reason" />
                                                </td>
                                                <td className="px-2 py-2">
                                                    {travelData.itinerary.length > 1 && (
                                                        <button type="button" onClick={() => removeItineraryRow(index)} className="text-red-500 hover:text-red-700">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-primary-50 font-semibold">
                                        <td colSpan={3} className="px-3 py-2 text-right text-primary-700">Total Distance:</td>
                                        <td className="px-2 py-2 text-center text-primary-900">{travelData.itinerary.reduce((sum, row) => sum + (parseFloat(row.km) || 0), 0)} km</td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* AA Rates Calculator - Only for Personal Motor Vehicle */}
                    {travelData.travelMode === 'personal_motor_vehicle' && (
                        <Card className="p-6 bg-[#F3EADC] border border-[#C9B896]">
                            <div className="flex items-center gap-2 mb-4">
                                <svg className="w-5 h-5 text-[#9A7545]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <h4 className="font-semibold text-[#3F2D19] uppercase text-sm">Travel Cost Calculator</h4>
                            </div>
                            <p className="text-sm text-[#5E4426] mb-4">Select your vehicle details to calculate travel cost using AA rates.</p>

                            <div className="bg-white rounded-xl p-4 border border-[#C9B896] space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Engine Size <span className="text-danger-500">*</span></label>
                                        <select
                                            value={aaCalculator.engineCapacity}
                                            onChange={(e) => { setAACalculator({ ...aaCalculator, engineCapacity: e.target.value }); setAaRatesLocked(false); }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#9A7545] focus:border-transparent outline-none text-sm"
                                        >
                                            <option value="1.1L-1.5L">1.1L – 1.5L</option>
                                            <option value="1.6L-2.0L">1.6L – 2.0L</option>
                                            <option value="2.1L-3.0L">2.1L – 3.0L</option>
                                            <option value="Above 3.0L">Above 3.0L</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type <span className="text-danger-500">*</span></label>
                                        <select
                                            value={aaCalculator.fuelType}
                                            onChange={(e) => { setAACalculator({ ...aaCalculator, fuelType: e.target.value as 'petrol' | 'diesel' }); setAaRatesLocked(false); }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#9A7545] focus:border-transparent outline-none text-sm"
                                        >
                                            <option value="petrol">Petrol</option>
                                            <option value="diesel">Diesel</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Rate Display */}
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="text-gray-500 text-sm block">AA Rate per km</span>
                                            <span className="font-bold text-[#3F2D19] text-xl">USD {getAARate().toFixed(2)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-gray-500 text-sm block">Total Distance</span>
                                            <span className="font-bold text-gray-800 text-xl">{travelData.itinerary.reduce((sum, row) => sum + (parseFloat(row.km) || 0), 0)} km</span>
                                        </div>
                                        <div className="text-right bg-[#F3EADC] rounded-lg p-3">
                                            <span className="text-[#5E4426] text-sm block font-medium">Estimated Travel Cost</span>
                                            <span className="font-bold text-[#3F2D19] text-xl">USD {(travelData.itinerary.reduce((sum, row) => sum + (parseFloat(row.km) || 0), 0) * getAARate()).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* AA Rate Reference Table */}
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <h5 className="font-medium text-gray-700 mb-2 text-xs uppercase">AA Rate Reference (USD/km)</h5>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-gray-200">
                                                    <th className="text-left py-1 px-2 font-medium text-gray-600">Engine Capacity</th>
                                                    <th className="text-center py-1 px-2 font-medium text-gray-600">Petrol</th>
                                                    <th className="text-center py-1 px-2 font-medium text-gray-600">Diesel</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className={`border-b border-gray-100 ${aaCalculator.engineCapacity === '1.1L-1.5L' ? 'bg-[#F3EADC]' : ''}`}>
                                                    <td className="py-1 px-2">1.1L – 1.5L</td>
                                                    <td className={`text-center py-1 px-2 ${aaCalculator.engineCapacity === '1.1L-1.5L' && aaCalculator.fuelType === 'petrol' ? 'font-bold text-[#5E4426]' : ''}`}>0.28</td>
                                                    <td className={`text-center py-1 px-2 ${aaCalculator.engineCapacity === '1.1L-1.5L' && aaCalculator.fuelType === 'diesel' ? 'font-bold text-[#5E4426]' : ''}`}>0.26</td>
                                                </tr>
                                                <tr className={`border-b border-gray-100 ${aaCalculator.engineCapacity === '1.6L-2.0L' ? 'bg-[#F3EADC]' : ''}`}>
                                                    <td className="py-1 px-2">1.6L – 2.0L</td>
                                                    <td className={`text-center py-1 px-2 ${aaCalculator.engineCapacity === '1.6L-2.0L' && aaCalculator.fuelType === 'petrol' ? 'font-bold text-[#5E4426]' : ''}`}>0.35</td>
                                                    <td className={`text-center py-1 px-2 ${aaCalculator.engineCapacity === '1.6L-2.0L' && aaCalculator.fuelType === 'diesel' ? 'font-bold text-[#5E4426]' : ''}`}>0.32</td>
                                                </tr>
                                                <tr className={`border-b border-gray-100 ${aaCalculator.engineCapacity === '2.1L-3.0L' ? 'bg-[#F3EADC]' : ''}`}>
                                                    <td className="py-1 px-2">2.1L – 3.0L</td>
                                                    <td className={`text-center py-1 px-2 ${aaCalculator.engineCapacity === '2.1L-3.0L' && aaCalculator.fuelType === 'petrol' ? 'font-bold text-[#5E4426]' : ''}`}>0.48</td>
                                                    <td className={`text-center py-1 px-2 ${aaCalculator.engineCapacity === '2.1L-3.0L' && aaCalculator.fuelType === 'diesel' ? 'font-bold text-[#5E4426]' : ''}`}>0.45</td>
                                                </tr>
                                                <tr className={`${aaCalculator.engineCapacity === 'Above 3.0L' ? 'bg-[#F3EADC]' : ''}`}>
                                                    <td className="py-1 px-2">Above 3.0L</td>
                                                    <td className={`text-center py-1 px-2 ${aaCalculator.engineCapacity === 'Above 3.0L' && aaCalculator.fuelType === 'petrol' ? 'font-bold text-[#5E4426]' : ''}`}>0.59</td>
                                                    <td className={`text-center py-1 px-2 ${aaCalculator.engineCapacity === 'Above 3.0L' && aaCalculator.fuelType === 'diesel' ? 'font-bold text-[#5E4426]' : ''}`}>0.56</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex justify-end mt-4">
                                    <button type="button" onClick={applyAARate} className="px-4 py-2 bg-[#9A7545] text-white rounded-lg hover:bg-[#5E4426] transition-colors font-medium text-sm flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Apply to Budget
                                    </button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Travel Budget */}
                    <Card className="p-6">
                        <h4 className="font-semibold text-gray-700 uppercase text-sm mb-3">Travel Budget <span className="text-danger-500">*</span></h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-gray-100"><th className="px-3 py-2 text-left font-semibold text-gray-700">Expenditure Item</th><th className="px-3 py-2 text-left font-semibold text-gray-700 w-24">Quantity</th><th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Unit Cost (USD)</th><th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Total Cost (USD)</th></tr></thead>
                                <tbody>
                                    {travelData.travelMode === 'personal_motor_vehicle' && (
                                        <tr className={`border-b border-gray-100 ${aaRatesLocked ? 'bg-green-50' : ''}`}>
                                            <td className="px-3 py-2 text-gray-700">
                                                Travel Cost (AA Rate × Distance)
                                                {aaRatesLocked && <span className="ml-2 text-xs text-green-600 font-medium">(Applied)</span>}
                                            </td>
                                            <td className="px-2 py-2">
                                                <input type="number" value={travelData.budget.aaRates.quantity} onChange={(e) => !aaRatesLocked && updateBudgetItem('aaRates', 'quantity', e.target.value)} readOnly={aaRatesLocked} className={`w-full px-2 py-1 rounded border outline-none text-sm ${aaRatesLocked ? 'border-green-200 bg-green-50 text-green-800 font-medium' : 'border-gray-300 focus:ring-1 focus:ring-primary-500'}`} placeholder="0" min="0" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input type="number" value={travelData.budget.aaRates.unitCost} onChange={(e) => !aaRatesLocked && updateBudgetItem('aaRates', 'unitCost', e.target.value)} readOnly={aaRatesLocked} className={`w-full px-2 py-1 rounded border outline-none text-sm ${aaRatesLocked ? 'border-green-200 bg-green-50 text-green-800 font-medium' : 'border-gray-300 focus:ring-1 focus:ring-primary-500'}`} placeholder="0.28" step="0.01" min="0" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <input type="number" value={travelData.budget.aaRates.totalCost} readOnly className={`w-full px-2 py-1 rounded border outline-none text-sm ${aaRatesLocked ? 'border-green-200 bg-green-50 text-green-800 font-medium' : 'border-gray-200 bg-gray-50'}`} placeholder="0.00" />
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="border-b border-gray-100"><td className="px-3 py-2 text-gray-700">Air/Bus Tickets</td><td className="px-2 py-2"><input type="number" value={travelData.budget.airBusTickets.quantity} onChange={(e) => updateBudgetItem('airBusTickets', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.airBusTickets.unitCost} onChange={(e) => updateBudgetItem('airBusTickets', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.airBusTickets.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    <tr className="border-b border-gray-100"><td className="px-3 py-2 text-gray-700">Conferencing Cost</td><td className="px-2 py-2"><input type="number" value={travelData.budget.conferencingCost.quantity} onChange={(e) => updateBudgetItem('conferencingCost', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.conferencingCost.unitCost} onChange={(e) => updateBudgetItem('conferencingCost', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.conferencingCost.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    {/* Tollgates Section - Only for Personal Motor Vehicle */}
                                    {travelData.travelMode === 'personal_motor_vehicle' && (
                                        <>
                                            <tr className="bg-orange-50 border-b border-orange-200">
                                                <td className="px-3 py-3 text-orange-800 font-medium" colSpan={4}>
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="font-semibold">Tollgates</span>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <label className="flex items-center gap-1 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name="tollgateRouteType"
                                                                        value="premium"
                                                                        checked={tollgateRouteType === 'premium'}
                                                                        onChange={(e) => setTollgateRouteType(e.target.value as TollgateRouteType)}
                                                                        className="text-orange-600 focus:ring-orange-500"
                                                                    />
                                                                    <span>Premium ($4)</span>
                                                                </label>
                                                                <label className="flex items-center gap-1 cursor-pointer">
                                                                    <input
                                                                        type="radio"
                                                                        name="tollgateRouteType"
                                                                        value="standard"
                                                                        checked={tollgateRouteType === 'standard'}
                                                                        onChange={(e) => setTollgateRouteType(e.target.value as TollgateRouteType)}
                                                                        className="text-orange-600 focus:ring-orange-500"
                                                                    />
                                                                    <span>Standard ($3)</span>
                                                                </label>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={autoCalculateTollgates}
                                                                className="text-xs bg-orange-600 text-white hover:bg-orange-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                                Auto-Calculate from Itinerary
                                                            </button>
                                                        </div>
                                                        <button type="button" onClick={addTollgateRow} className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                            Add Tollgate
                                                        </button>
                                                    </div>
                                                    {/* Tollgate route summary */}
                                                    {getTollgateSummary().length > 0 && (
                                                        <div className="mt-2 text-xs text-orange-700 bg-orange-100/50 rounded-lg px-2 py-1.5">
                                                            <span className="font-medium">Available routes:</span> {getTollgateSummary().join('; ')}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            {travelData.budget.tollgates.map((toll, idx) => (
                                                <tr key={idx} className="border-b border-gray-100 bg-orange-50/30">
                                                    <td className="px-2 py-2">
                                                        <input type="text" value={toll.road} onChange={(e) => updateTollgateRow(idx, 'road', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-orange-500 outline-none text-sm" placeholder="Road/Route name" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input type="number" value={toll.quantity} onChange={(e) => updateTollgateRow(idx, 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-orange-500 outline-none text-sm" placeholder="1" min="1" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input type="number" value={toll.unitCost} onChange={(e) => updateTollgateRow(idx, 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-orange-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" />
                                                    </td>
                                                    <td className="px-2 py-2 flex items-center gap-1">
                                                        <input type="number" value={toll.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" />
                                                        {travelData.budget.tollgates.length > 1 && (
                                                            <button type="button" onClick={() => removeTollgateRow(idx)} className="text-red-500 hover:text-red-700 p-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    )}
                                    <tr className="border-b border-gray-100"><td className="px-2 py-2"><input type="text" value={travelData.budget.other.description || ''} onChange={(e) => updateBudgetItem('other', 'description', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="Other (specify)" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.other.quantity} onChange={(e) => updateBudgetItem('other', 'quantity', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.other.unitCost} onChange={(e) => updateBudgetItem('other', 'unitCost', e.target.value)} className="w-full px-2 py-1 rounded border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm" placeholder="0.00" step="0.01" min="0" /></td><td className="px-2 py-2"><input type="number" value={travelData.budget.other.totalCost} readOnly className="w-full px-2 py-1 rounded border border-gray-200 bg-gray-50 outline-none text-sm" placeholder="0.00" /></td></tr>
                                    <tr className="bg-gray-100 font-semibold"><td className="px-3 py-2 text-gray-900" colSpan={3}>GRAND TOTAL</td><td className="px-3 py-2 text-gray-900">USD {calculateGrandTotal()}</td></tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Cost Allocation Table - Auto-filled based on itinerary */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h4 className="font-semibold text-gray-700 uppercase text-sm mb-3">Allocation Cost to Unit <span className="text-gray-500 text-xs font-normal">(Auto-calculated based on itinerary destinations)</span></h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border border-gray-200">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">Corp</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">MRC</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">NAH</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">RTH</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">KHCC</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">BRH</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-700 border-r border-gray-200">VFRH</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-700">AZAM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {(() => {
                                                const allocation = calculateCostAllocation();
                                                return (['corp', 'mrc', 'nah', 'rth', 'khcc', 'brh', 'vfrh', 'azam'] as const).map((unit, idx) => (
                                                    <td key={unit} className={`px-1 py-2 text-center ${idx < 7 ? 'border-r border-gray-200' : ''} ${allocation[unit] ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-400'}`}>
                                                        {allocation[unit] ? `$${allocation[unit]}` : '-'}
                                                    </td>
                                                ));
                                            })()}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">* Costs are automatically distributed based on the proportion of visits to each business unit in your itinerary.</p>
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
