import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button } from '../../../components/ui';
import { useHrimsDepartments } from '../../../hooks/useHrimsOrganogram';

interface FormTemplateItem {
    id: string;
    name: string;
    description: string | null;
    scope: string;
    category: string | null;
    icon: string;
    color: string;
    usage_count: number;
    created_at: string;
    department_id?: string | null;
    creator?: { display_name: string; email: string };
}

// Built-in forms that always show (hardcoded request types)
const BUILTIN_FORMS = [
    {
        id: '__capex',
        name: 'CAPEX Request',
        description: 'Capital expenditure approval form for significant investments and assets.',
        category: 'Finance',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        color: 'warning',
        href: '/requests/new/capex',
        scope: 'hotel_group',
        builtin: true,
        usage_count: 100,
        department_id: null,
    },
    {
        id: '__hotel_booking',
        name: 'Complimentary Hotel Guest Booking',
        description: 'Request complimentary hotel accommodation for guests and partners.',
        category: 'Travel & Hospitality',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        color: 'primary',
        href: '/requests/new/hotel-booking',
        scope: 'hotel_group',
        builtin: true,
        usage_count: 90,
        department_id: null,
    },
    {
        id: '__travel_auth',
        name: 'Local Travel Authorization',
        description: 'Authorization form for local business travel and related expenses.',
        category: 'Travel & Hospitality',
        icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        color: 'success',
        href: '/requests/new/travel-auth',
        scope: 'hotel_group',
        builtin: true,
        usage_count: 85,
        department_id: null,
    },
];

const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; hover: string; border: string; gradient: string }> = {
        primary: { bg: 'bg-primary-50', icon: 'text-primary-600', hover: 'hover:shadow-lg hover:border-primary-300 hover:-translate-y-0.5', border: 'border-primary-100', gradient: 'from-primary-500/10' },
        secondary: { bg: 'bg-gray-50', icon: 'text-gray-600', hover: 'hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5', border: 'border-gray-200', gradient: 'from-gray-500/10' },
        accent: { bg: 'bg-accent/10', icon: 'text-accent', hover: 'hover:shadow-lg hover:border-accent/30 hover:-translate-y-0.5', border: 'border-accent/20', gradient: 'from-accent/10' },
        success: { bg: 'bg-emerald-50', icon: 'text-emerald-600', hover: 'hover:shadow-lg hover:border-emerald-200 hover:-translate-y-0.5', border: 'border-emerald-100', gradient: 'from-emerald-500/10' },
        warning: { bg: 'bg-amber-50', icon: 'text-amber-600', hover: 'hover:shadow-lg hover:border-amber-200 hover:-translate-y-0.5', border: 'border-amber-100', gradient: 'from-amber-500/10' },
        danger: { bg: 'bg-red-50', icon: 'text-red-600', hover: 'hover:shadow-lg hover:border-red-200 hover:-translate-y-0.5', border: 'border-red-100', gradient: 'from-red-500/10' },
    };
    return colors[color] || colors.primary;
};

const SCOPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    hotel_group: { label: 'Hotel Group', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    business_unit: { label: 'Business Unit', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    departmental: { label: 'Departmental', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
};

type ViewMode = 'large' | 'medium' | 'compact' | 'list';

export default function AllFormsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedScope, setSelectedScope] = useState('All');
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [sortBy, setSortBy] = useState<'name' | 'popular' | 'newest'>('popular');
    const [viewMode, setViewMode] = useState<ViewMode>('medium');
    const [customTemplates, setCustomTemplates] = useState<FormTemplateItem[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    // Fetch HRIMS departments for filtering
    const { departments, loading: loadingDepartments } = useHrimsDepartments();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    // Fetch custom form templates from API
    useEffect(() => {
        if (!session?.user) return;
        setLoadingTemplates(true);
        fetch('/api/form-templates?published_only=true')
            .then(res => res.json())
            .then(data => {
                setCustomTemplates(data.templates || []);
            })
            .catch(err => {
                console.error('Error fetching form templates:', err);
            })
            .finally(() => setLoadingTemplates(false));
    }, [session?.user]);

    // Combine built-in + custom templates
    const allForms = useMemo(() => {
        const builtinMapped = BUILTIN_FORMS.map(b => ({
            ...b,
            isBuiltin: true,
            createdAt: '',
        }));
        const customMapped = customTemplates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category || 'Other',
            icon: t.icon || 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
            color: t.color || 'primary',
            href: '',
            scope: t.scope,
            builtin: false,
            isBuiltin: false,
            usage_count: t.usage_count || 0,
            createdAt: t.created_at,
            creator: t.creator,
            department_id: t.department_id,
        }));
        return [...builtinMapped, ...customMapped];
    }, [customTemplates]);

    // Categories from all forms
    const categories = useMemo(() => {
        const cats = new Set<string>();
        allForms.forEach(f => { if (f.category) cats.add(f.category); });
        return ['All', ...Array.from(cats).sort()];
    }, [allForms]);

    // Filtered + sorted
    const filteredForms = useMemo(() => {
        let list = allForms;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(f =>
                f.name.toLowerCase().includes(q) ||
                f.description?.toLowerCase().includes(q) ||
                f.category?.toLowerCase().includes(q)
            );
        }

        if (selectedCategory !== 'All') {
            list = list.filter(f => f.category === selectedCategory);
        }

        if (selectedScope !== 'All') {
            list = list.filter(f => f.scope === selectedScope);
        }

        if (selectedDepartment !== 'All') {
            list = list.filter(f => f.department_id === selectedDepartment);
        }

        if (sortBy === 'popular') {
            list = [...list].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0));
        } else if (sortBy === 'name') {
            list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'newest') {
            list = [...list].sort((a, b) => {
                if (!a.createdAt && !b.createdAt) return 0;
                if (!a.createdAt) return 1;
                if (!b.createdAt) return -1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
        }

        return list;
    }, [allForms, searchQuery, selectedCategory, selectedScope, selectedDepartment, sortBy]);

    const handleFormClick = (form: any) => {
        if (form.isBuiltin && form.href) {
            router.push(form.href);
        } else {
            router.push(`/requests/forms/${form.id}`);
        }
    };

    const handleEditForm = (e: React.MouseEvent, formId: string) => {
        e.stopPropagation(); // Prevent card click
        router.push(`/requests/forms/edit/${formId}`);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedCategory('All');
        setSelectedScope('All');
        setSelectedDepartment('All');
    };

    const ViewModeButton = ({ mode, icon, label }: { mode: ViewMode; icon: string; label: string }) => (
        <button
            onClick={() => setViewMode(mode)}
            className={`p-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                viewMode === mode
                    ? 'bg-primary-100 text-primary-700 shadow-sm'
                    : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
            title={label}
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
            </svg>
            <span className="hidden sm:inline text-xs font-medium">{label}</span>
        </button>
    );

    if (status === 'loading') {
        return (
            <AppLayout title="Form Templates">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
            </AppLayout>
        );
    }

    if (!session) return null;

    const hasActiveFilters = searchQuery || selectedCategory !== 'All' || selectedScope !== 'All' || selectedDepartment !== 'All';

    return (
        <AppLayout title="Form Templates">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Form Templates</h1>
                        <p className="text-gray-500 mt-1">Select a form to create a new request</p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => router.push('/requests/new/form')}
                        className="flex items-center gap-2 whitespace-nowrap"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Design New Form
                    </Button>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <Card className="!p-3 bg-gradient-to-br from-white to-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-gray-900">{allForms.length}</div>
                                <div className="text-xs text-gray-500">Total Forms</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="!p-3 bg-gradient-to-br from-white to-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-gray-900">{allForms.filter(f => f.scope === 'hotel_group').length}</div>
                                <div className="text-xs text-gray-500">Hotel Group</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="!p-3 bg-gradient-to-br from-white to-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-gray-900">{allForms.filter(f => f.scope === 'business_unit').length}</div>
                                <div className="text-xs text-gray-500">Business Unit</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="!p-3 bg-gradient-to-br from-white to-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <div className="text-xl font-bold text-gray-900">{allForms.filter(f => f.scope === 'departmental').length}</div>
                                <div className="text-xs text-gray-500">Departmental</div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Search & Filters Bar */}
                <Card className="mb-6 !p-4">
                    <div className="flex flex-col gap-4">
                        {/* Top Row: Search + View Mode */}
                        <div className="flex flex-col lg:flex-row gap-3">
                            <div className="flex-1 relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search forms by name, description, or category..."
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {/* View Mode Toggle */}
                                <div className="flex items-center border border-gray-200 rounded-xl p-1 bg-gray-50/50">
                                    <ViewModeButton mode="large" label="Large" icon="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    <ViewModeButton mode="medium" label="Medium" icon="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    <ViewModeButton mode="compact" label="Compact" icon="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                    <ViewModeButton mode="list" label="List" icon="M4 6h16M4 12h16M4 18h16" />
                                </div>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                        showFilters || hasActiveFilters
                                            ? 'bg-primary-50 border-primary-200 text-primary-700'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                    <span className="hidden sm:inline">Filters</span>
                                    {hasActiveFilters && (
                                        <span className="w-2 h-2 bg-primary-500 rounded-full" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Filter Pills (when not expanded) */}
                        {!showFilters && hasActiveFilters && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-500 font-medium">Active filters:</span>
                                {selectedCategory !== 'All' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium">
                                        {selectedCategory}
                                        <button onClick={() => setSelectedCategory('All')} className="hover:text-primary-900">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </span>
                                )}
                                {selectedScope !== 'All' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium">
                                        {SCOPE_LABELS[selectedScope]?.label}
                                        <button onClick={() => setSelectedScope('All')} className="hover:text-primary-900">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </span>
                                )}
                                {selectedDepartment !== 'All' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium">
                                        {departments.find(d => d.id === selectedDepartment)?.name || 'Department'}
                                        <button onClick={() => setSelectedDepartment('All')} className="hover:text-primary-900">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </span>
                                )}
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}

                        {/* Expanded Filters */}
                        {showFilters && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-gray-100">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                    >
                                        {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Scope</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                                        value={selectedScope}
                                        onChange={(e) => setSelectedScope(e.target.value)}
                                    >
                                        <option value="All">All Scopes</option>
                                        <option value="hotel_group">Hotel Group</option>
                                        <option value="business_unit">Business Unit</option>
                                        <option value="departmental">Departmental</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Department</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white disabled:bg-gray-50"
                                        value={selectedDepartment}
                                        onChange={(e) => setSelectedDepartment(e.target.value)}
                                        disabled={loadingDepartments}
                                    >
                                        <option value="All">{loadingDepartments ? 'Loading...' : 'All Departments'}</option>
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Sort By</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as any)}
                                    >
                                        <option value="popular">Most Popular</option>
                                        <option value="name">Name (A-Z)</option>
                                        <option value="newest">Newest First</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Loading State */}
                {loadingTemplates ? (
                    <div className="text-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto" />
                        <p className="text-sm text-gray-500 mt-3">Loading form templates...</p>
                    </div>
                ) : (
                    <>
                        {/* Results Count */}
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500">
                                {filteredForms.length} form{filteredForms.length !== 1 ? 's' : ''} available
                            </p>
                            {customTemplates.length > 0 && (
                                <p className="text-xs text-gray-400">
                                    {customTemplates.length} custom template{customTemplates.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>

                        {/* Empty State */}
                        {filteredForms.length === 0 ? (
                            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <h3 className="text-lg font-medium text-gray-600 mb-1">No forms found</h3>
                                <p className="text-gray-400 mb-4">Try adjusting your filters or search query</p>
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={clearFilters}
                                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Clear Filters
                                    </button>
                                    <Button variant="primary" onClick={() => router.push('/requests/new/form')}>
                                        Design New Form
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Large Cards View */}
                                {viewMode === 'large' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {filteredForms.map((form) => {
                                            const colors = getColorClasses(form.color);
                                            const scopeInfo = SCOPE_LABELS[form.scope] || SCOPE_LABELS.hotel_group;
                                            const deptName = departments.find(d => d.id === form.department_id)?.name;
                                            return (
                                                <Card
                                                    key={form.id}
                                                    variant="outlined"
                                                    className={`group cursor-pointer transition-all duration-300 ${colors.hover} border ${colors.border} relative overflow-hidden p-6`}
                                                    onClick={() => handleFormClick(form)}
                                                >
                                                    <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                                                    {!form.isBuiltin && (
                                                        <button
                                                            onClick={(e) => handleEditForm(e, form.id)}
                                                            className="absolute top-4 right-4 z-20 p-2 bg-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 border border-gray-200"
                                                            title="Edit form"
                                                        >
                                                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <div className="relative z-10">
                                                        <div className="flex items-start gap-5">
                                                            <div className={`w-16 h-16 ${colors.bg} rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                                                                <svg className={`w-8 h-8 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={form.icon} />
                                                                </svg>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <h3 className="font-semibold text-gray-900 text-lg group-hover:text-primary-600 transition-colors">
                                                                        {form.name}
                                                                    </h3>
                                                                    <svg className="w-5 h-5 text-gray-300 group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                                    </svg>
                                                                </div>
                                                                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{form.description || 'No description'}</p>
                                                                <div className="flex flex-wrap items-center gap-2 mt-4">
                                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${scopeInfo.color}`}>
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={scopeInfo.icon} />
                                                                        </svg>
                                                                        {scopeInfo.label}
                                                                    </span>
                                                                    {form.category && (
                                                                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                                                                            {form.category}
                                                                        </span>
                                                                    )}
                                                                    {deptName && (
                                                                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600">
                                                                            {deptName}
                                                                        </span>
                                                                    )}
                                                                    {form.isBuiltin ? (
                                                                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-50 text-primary-600">
                                                                            Built-in
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-600">
                                                                            Custom
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Medium Cards View */}
                                {viewMode === 'medium' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredForms.map((form) => {
                                            const colors = getColorClasses(form.color);
                                            const scopeInfo = SCOPE_LABELS[form.scope] || SCOPE_LABELS.hotel_group;
                                            const deptName = departments.find(d => d.id === form.department_id)?.name;
                                            return (
                                                <Card
                                                    key={form.id}
                                                    variant="outlined"
                                                    className={`group cursor-pointer transition-all duration-200 ${colors.hover} border ${colors.border} relative overflow-hidden`}
                                                    onClick={() => handleFormClick(form)}
                                                >
                                                    <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${colors.bg}`} />
                                                    {!form.isBuiltin && (
                                                        <button
                                                            onClick={(e) => handleEditForm(e, form.id)}
                                                            className="absolute top-3 right-3 z-20 p-1.5 bg-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 border border-gray-200"
                                                            title="Edit form"
                                                        >
                                                            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <div className="flex items-start gap-4 h-full relative z-10 p-5">
                                                        <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                                            <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={form.icon} />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1 min-w-0 flex flex-col h-full">
                                                            <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors text-sm">
                                                                {form.name}
                                                            </h3>
                                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 mb-3 flex-1">
                                                                {form.description || 'No description'}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-gray-100 w-full flex-wrap">
                                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${scopeInfo.color}`}>
                                                                    {scopeInfo.label}
                                                                </span>
                                                                {form.category && (
                                                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                                                                        {form.category}
                                                                    </span>
                                                                )}
                                                                {deptName && (
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                                                                        {deptName}
                                                                    </span>
                                                                )}
                                                                {form.isBuiltin ? (
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-50 text-primary-600">
                                                                        Built-in
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                                                                        Custom
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="self-center opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 flex-shrink-0">
                                                            <svg className="w-5 h-5 text-gray-300 group-hover:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Compact Cards View */}
                                {viewMode === 'compact' && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {filteredForms.map((form) => {
                                            const colors = getColorClasses(form.color);
                                            const scopeInfo = SCOPE_LABELS[form.scope] || SCOPE_LABELS.hotel_group;
                                            return (
                                                <Card
                                                    key={form.id}
                                                    variant="outlined"
                                                    className={`group cursor-pointer transition-all duration-200 ${colors.hover} border ${colors.border} p-4 text-center relative`}
                                                    onClick={() => handleFormClick(form)}
                                                >
                                                    {!form.isBuiltin && (
                                                        <button
                                                            onClick={(e) => handleEditForm(e, form.id)}
                                                            className="absolute top-2 right-2 z-20 p-1 bg-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 border border-gray-200"
                                                            title="Edit form"
                                                        >
                                                            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <div className={`w-10 h-10 ${colors.bg} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                                                        <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={form.icon} />
                                                        </svg>
                                                    </div>
                                                    <h3 className="font-medium text-gray-900 text-xs line-clamp-2 group-hover:text-primary-600 transition-colors mb-2">
                                                        {form.name}
                                                    </h3>
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${scopeInfo.color}`}>
                                                        {scopeInfo.label}
                                                    </span>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* List View */}
                                {viewMode === 'list' && (
                                    <div className="space-y-2">
                                        {filteredForms.map((form) => {
                                            const colors = getColorClasses(form.color);
                                            const scopeInfo = SCOPE_LABELS[form.scope] || SCOPE_LABELS.hotel_group;
                                            const deptName = departments.find(d => d.id === form.department_id)?.name;
                                            return (
                                                <div
                                                    key={form.id}
                                                    className={`group flex items-center gap-4 p-3 rounded-xl border ${colors.border} bg-white cursor-pointer transition-all duration-200 hover:shadow-md ${colors.hover}`}
                                                    onClick={() => handleFormClick(form)}
                                                >
                                                    <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                                                        <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={form.icon} />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="font-medium text-gray-900 text-sm group-hover:text-primary-600 transition-colors">
                                                                {form.name}
                                                            </h3>
                                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${scopeInfo.color}`}>
                                                                {scopeInfo.label}
                                                            </span>
                                                            {form.category && (
                                                                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded hidden sm:inline">
                                                                    {form.category}
                                                                </span>
                                                            )}
                                                            {deptName && (
                                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-600 hidden md:inline">
                                                                    {deptName}
                                                                </span>
                                                            )}
                                                            {form.isBuiltin ? (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary-50 text-primary-600">
                                                                    Built-in
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                                                                    Custom
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{form.description || 'No description'}</p>
                                                    </div>
                                                    {!form.isBuiltin && (
                                                        <button
                                                            onClick={(e) => handleEditForm(e, form.id)}
                                                            className="p-2 bg-white rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50 border border-gray-200 mr-2"
                                                            title="Edit form"
                                                        >
                                                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <svg className="w-5 h-5 text-gray-300 group-hover:text-primary-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
