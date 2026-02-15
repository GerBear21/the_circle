import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import Lottie from 'lottie-react';
import sendingApprovalAnimation from '../../Sending approval lottie.json';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';

// Defined types for better type safety
type RequestCategory = 'Finance' | 'Travel & Events' | 'BIS forms' | 'System & Design';

interface RequestItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  // Simplified color palette to semantic names or specific categories if needed, 
  // keeping the string for compatibility with existing logic but we can map it.
  color: 'primary' | 'accent' | 'success' | 'warning' | 'secondary' | 'indigo' | 'rose';
  href: string;
  category: RequestCategory;
  popular?: boolean;
}

const allRequestItems: RequestItem[] = [
  // --- Finance ---
  // {
  //   id: 'approval',
  //   title: 'General Approval',
  //   description: 'Submit a generic request for approval',
  //   icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  //   color: 'primary',
  //   href: '/requests/new/approval',
  //   category: 'Finance',
  // },
  {
    id: 'capex',
    title: 'CAPEX Request',
    description: 'Capital expenditure approval form',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'warning',
    href: '/requests/new/capex',
    category: 'Finance',
    popular: true,
  },
  // {
  //   id: 'expense',
  //   title: 'Expense Claim',
  //   description: 'Submit expenses for reimbursement',
  //   icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  //   color: 'success',
  //   href: '/requests/new/expense',
  //   category: 'Finance',
  //   popular: true,
  // },

  // --- Travel & Events ---
  {
    id: 'travel',
    title: 'Travel Authorization',
    description: 'Local travel authorization form',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'indigo',
    href: '/requests/new/travel-auth',
    category: 'Travel & Events',
  },
  {
    id: 'hotel',
    title: 'Complimentary Hotel Booking',
    description: 'Complimentary hotel accommodation',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    color: 'primary',
    href: '/requests/new/hotel-booking',
    category: 'Travel & Events',
  },


  // --- BIS forms ---
  // {
  //   id: 'it_help',
  //   title: 'IT Help Desk',
  //   description: 'Report technical issues or requests',
  //   icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  //   color: 'secondary',
  //   href: '/requests/new/it-request',
  //   category: 'BIS forms',
  // },
  // {
  //   id: 'add_user',
  //   title: 'Add User',
  //   description: 'Request to add a new user to the system',
  //   icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  //   color: 'success',
  //   href: '/requests/new/add-user',
  //   category: 'BIS forms',
  // },
  // {
  //   id: 'remove_user',
  //   title: 'Remove User',
  //   description: 'Request to remove a user from the system',
  //   icon: 'M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6',
  //   color: 'rose',
  //   href: '/requests/new/remove-user',
  //   category: 'BIS forms',
  // },

  // --- System & Design ---
  // {
  //   id: 'form',
  //   title: 'Design New Form',
  //   description: 'Create a custom form with fields',
  //   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  //   color: 'accent',
  //   href: '/requests/new/form',
  //   category: 'System & Design',
  // },
  // {
  //   id: 'template',
  //   title: 'Create Template',
  //   description: 'Build reusable approval templates',
  //   icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  //   color: 'accent',
  //   href: '/requests/new/template',
  //   category: 'System & Design',
  // },
  {
    id: 'workflow',
    title: 'Custom Workflow',
    description: 'Design your own custom approval flow',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
    color: 'accent',
    href: '/requests/new/workflow',
    category: 'System & Design',
  },
];

const getColorClasses = (color: string) => {
  const colors: Record<string, { bg: string; icon: string; hover: string; border: string }> = {
    primary: { bg: 'bg-primary-50', icon: 'text-primary-600', hover: 'hover:bg-primary-50 hover:shadow-primary-100', border: 'hover:border-primary-200' },
    accent: { bg: 'bg-accent/10', icon: 'text-accent', hover: 'hover:bg-accent/5 hover:shadow-accent/20', border: 'hover:border-accent/30' },
    success: { bg: 'bg-emerald-50', icon: 'text-emerald-600', hover: 'hover:bg-emerald-50 hover:shadow-emerald-100', border: 'hover:border-emerald-200' },
    warning: { bg: 'bg-amber-50', icon: 'text-amber-600', hover: 'hover:bg-amber-50 hover:shadow-amber-100', border: 'hover:border-amber-200' },
    secondary: { bg: 'bg-gray-100', icon: 'text-gray-600', hover: 'hover:bg-gray-50 hover:shadow-gray-200', border: 'hover:border-gray-300' },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600', hover: 'hover:bg-indigo-50 hover:shadow-indigo-100', border: 'hover:border-indigo-200' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', hover: 'hover:bg-rose-50 hover:shadow-rose-100', border: 'hover:border-rose-200' },
  };
  return colors[color] || colors.primary;
};

export default function NewRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allRequestItems;
    const query = searchQuery.toLowerCase();
    return allRequestItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Order of categories - kept for reference if needed but not used in display
  // const categoryOrder: RequestCategory[] = ['System & Design', 'Finance', 'Travel & Events', 'BIS forms'];

  if (status === 'loading') {
    return (
      <AppLayout title="Create New">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Create New">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-8">

        {/* Hero Section with Animation - Restored Original Design */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-primary-50 via-white to-accent/5 border border-primary-100/50 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0">
              <Lottie
                animationData={sendingApprovalAnimation}
                loop={true}
                className="w-full h-full drop-shadow-lg"
              />
            </div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">
                What would you like to create?
              </h1>
              <p className="text-text-secondary mt-2 text-base sm:text-lg max-w-md">
                Select an option below to get started with your approval workflow
              </p>

              {/* Search Bar */}
              <div className="mt-6 relative max-w-md mx-auto sm:mx-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search for forms..."
                  className="block w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 bg-white/50 backdrop-blur-sm text-text-primary placeholder-gray-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-8">
          {filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">No request types found matching "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-6 py-2 bg-white border border-gray-300 rounded-lg text-primary-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
              {filteredItems.map((item) => {
                const colors = getColorClasses(item.color);
                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(item.href)}
                    className={`
                      group relative overflow-hidden bg-white rounded-xl border border-gray-100 
                      p-4 cursor-pointer transition-all duration-300
                      hover:shadow-md hover:border-gray-200 ${colors.border} hover:border
                    `}
                  >
                    {/* Background Decorative Blob - Smaller and more subtle */}
                    <div className={`
                       absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100
                       ${colors.bg.replace('50', '200')}
                     `} />

                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`
                        w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
                        ${colors.bg} transition-transform duration-300 group-hover:scale-105
                      `}>
                        <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                            {item.title}
                          </h3>
                          {item.popular && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary-50 text-primary-600 border border-primary-100 uppercase tracking-wide">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm leading-snug line-clamp-1">
                          {item.description}
                        </p>
                      </div>

                      <div className="self-center opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                        <svg className="w-5 h-5 text-gray-300 group-hover:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Support Card
        <div className="mt-12 rounded-2xl bg-blue-50 border border-blue-100 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-blue-900 text-lg">Can't find what you're looking for?</h4>
              <p className="text-blue-700/80">Check our documentation or contact the system administrator for help.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/help')}
            className="px-6 py-2.5 bg-white text-blue-600 font-semibold rounded-lg shadow-sm border border-blue-200 hover:bg-blue-50 transition-all whitespace-nowrap"
          >
            Contact Support
          </button>
        </div> */}
      </div>
    </AppLayout>
  );
}
