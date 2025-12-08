import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Input } from '../../../components/ui';

interface FormTemplate {
    id: string;
    title: string;
    description: string;
    category: string;
    department: string;
    icon: string;
    color: string; // 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger'
    href: string;
    popularity: number; // 0-100 for sorting
    isNew?: boolean;
}

const formTemplates: FormTemplate[] = [
    {
        id: 'capex',
        title: 'CAPEX Request',
        description: 'Capital expenditure approval form for significant investments and assets.',
        category: 'Finance',
        department: 'Finance',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        color: 'warning',
        href: '/requests/new/capex',
        popularity: 95,
    },
    {
        id: 'hotel_booking',
        title: 'Complimentary Hotel Guest Booking',
        description: 'Request complimentary hotel accommodation for guests and partners.',
        category: 'Travel & Hospitality',
        department: 'Operations',
        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
        color: 'primary',
        href: '/requests/new/hotel-booking',
        popularity: 88,
        isNew: true,
    },
    {
        id: 'travel_auth',
        title: 'Local Travel Authorization',
        description: 'Authorization form for local business travel and related expenses.',
        category: 'Travel',
        department: 'HR',
        icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        color: 'success',
        href: '/requests/new/travel-auth',
        popularity: 85,
        isNew: true,
    },
    {
        id: 'leave',
        title: 'Leave Request',
        description: 'Apply for annual leave, sick leave, or other time off.',
        category: 'HR',
        department: 'HR',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        color: 'accent',
        href: '/requests/new/leave', // Assuming this exists or will exist later
        popularity: 98,
    },
    {
        id: 'expense',
        title: 'Expense Claim',
        description: 'Submit claims for reimbursement of business expenses.',
        category: 'Finance',
        department: 'Finance',
        icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
        color: 'success',
        href: '/requests/new/expense', // Assuming this exists or will exist later
        popularity: 92,
    },
    {
        id: 'it_request',
        title: 'IT Service Request',
        description: 'Request new hardware, software, or technical support.',
        category: 'IT',
        department: 'IT',
        icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
        color: 'secondary',
        href: '/requests/new/it-request', // Assuming this exists or will exist later
        popularity: 75,
    },
    {
        id: 'procurement',
        title: 'Procurement Request',
        description: 'Request for purchasing goods and services.',
        category: 'Procurement',
        department: 'Finance',
        icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
        color: 'warning',
        href: '/requests/new/procurement', // Assuming this exists or will exist later
        popularity: 60,
    },
    {
        id: 'general_approval',
        title: 'General Approval',
        description: 'Generic approval request for items not covered by other forms.',
        category: 'General',
        department: 'Administration',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        color: 'secondary',
        href: '/requests/new/approval',
        popularity: 50,
    },
];

const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; hover: string; border: string }> = {
        primary: { bg: 'bg-primary-50', icon: 'text-primary-600', hover: 'hover:shadow-md hover:border-primary-200', border: 'border-primary-100' },
        secondary: { bg: 'bg-gray-50', icon: 'text-gray-600', hover: 'hover:shadow-md hover:border-gray-300', border: 'border-gray-200' },
        accent: { bg: 'bg-accent/10', icon: 'text-accent', hover: 'hover:shadow-md hover:border-accent/30', border: 'border-accent/20' },
        success: { bg: 'bg-success-50', icon: 'text-success-600', hover: 'hover:shadow-md hover:border-success-200', border: 'border-success-100' },
        warning: { bg: 'bg-warning-50', icon: 'text-warning-600', hover: 'hover:shadow-md hover:border-warning-200', border: 'border-warning-100' },
        danger: { bg: 'bg-danger-50', icon: 'text-danger-600', hover: 'hover:shadow-md hover:border-danger-200', border: 'border-danger-100' },
    };
    return colors[color] || colors.primary;
};

export default function AllFormsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [sortBy, setSortBy] = useState<'name' | 'popularity'>('popularity');

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/');
        }
    }, [status, router]);

    if (status === 'loading') {
        return (
            <AppLayout title="All Forms">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
            </AppLayout>
        );
    }

    if (!session) return null;

    const categories = ['All', ...Array.from(new Set(formTemplates.map(f => f.category)))];
    const departments = ['All', ...Array.from(new Set(formTemplates.map(f => f.department)))];

    const filteredForms = formTemplates
        .filter((form) => {
            const matchesSearch = form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                form.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || form.category === selectedCategory;
            const matchesDepartment = selectedDepartment === 'All' || form.department === selectedDepartment;
            return matchesSearch && matchesCategory && matchesDepartment;
        })
        .sort((a, b) => {
            if (sortBy === 'popularity') {
                return b.popularity - a.popularity;
            }
            return a.title.localeCompare(b.title);
        });

    return (
        <AppLayout title="All Forms">
            <div className="p-4 sm:p-6 max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-text-primary font-heading">All Forms</h1>
                    <p className="text-text-secondary mt-1">Browse and search for request forms</p>
                </div>

                {/* Filters and Search */}
                <Card className="mb-6 !p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search forms..."
                                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select
                                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
                            </select>
                            <select
                                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                            >
                                {departments.map(d => <option key={d} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
                            </select>
                            <select
                                className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                            >
                                <option value="popularity">Most Popular</option>
                                <option value="name">Name (A-Z)</option>
                            </select>
                        </div>
                    </div>
                </Card>

                {/* Forms Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredForms.map((form) => {
                        const colors = getColorClasses(form.color);
                        return (
                            <Card
                                key={form.id}
                                variant="outlined"
                                className={`group cursor-pointer transition-all duration-200 ${colors.hover} border ${colors.border}`}
                                onClick={() => router.push(form.href)}
                            >
                                <div className="flex items-start gap-4 h-full">
                                    <div className={`w-12 h-12 ${colors.bg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                        <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={form.icon} />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col h-full">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-semibold text-text-primary line-clamp-1 group-hover:text-primary-600 transition-colors">
                                                {form.title}
                                            </h3>
                                            {form.isNew && (
                                                <span className="bg-primary-100 text-primary-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                    New
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-text-secondary mt-1 line-clamp-2 mb-3 flex-1">
                                            {form.description}
                                        </p>
                                        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100 w-full">
                                            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                                {form.category}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {filteredForms.length === 0 && (
                    <div className="text-center py-12">
                        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-600 mb-1">No forms found</h3>
                        <p className="text-gray-400">Try adjusting your filters or search query</p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
