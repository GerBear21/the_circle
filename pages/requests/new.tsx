import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import Lottie from 'lottie-react';
import dynamic from 'next/dynamic';
import sendingApprovalAnimation from '@/lotties/sending brown.json';
import { AppLayout } from '../../components/layout';
import { Card } from '../../components/ui';

const ESignModal = dynamic(
  () => import('../../components/esign/ESignModal'),
  { ssr: false }
);

// Defined types for better type safety
type RequestCategory = 'System Functions' | 'Finance' | 'HR' | 'BIS forms';

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
  {
    id: 'petty_cash',
    title: 'Petty Cash Request',
    description: 'Request petty cash for approved operational spending',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'warning',
    href: '/requests/new/petty-cash',
    category: 'Finance',
  },
  {
    id: 'inter_unit_debit_note',
    title: 'Inter-Unit Debit Note',
    description: 'Issue a debit note between business units with line items and authorised signature',
    icon: 'M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm4 8h2m4 0h4',
    color: 'primary',
    href: '/requests/new/inter-unit-debit-note',
    category: 'Finance',
  },
  {
    id: 'inter_unit_credit_note',
    title: 'Inter-Unit Credit Note',
    description: 'Issue a credit note between business units to refund or adjust prior charges',
    icon: 'M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zm5 8l2 -3 2 3 2 -3',
    color: 'success',
    href: '/requests/new/inter-unit-credit-note',
    category: 'Finance',
  },
  {
    id: 'journals',
    title: 'Journals',
    description: 'Create a journal request for accounting entries and adjustments',
    icon: 'M12 6.253v11.494m-5.747-8.62h11.494M5.5 21h13a2 2 0 002-2V7.5a2 2 0 00-.586-1.414l-3-3A2 2 0 0015.5 3h-10a2 2 0 00-2 2v14a2 2 0 002 2z',
    color: 'accent',
    href: '/requests/new/journals',
    category: 'Finance',
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

  // --- HR Department ---
  {
    id: 'travel_authorization',
    title: 'Travel Authorization',
    description: 'Request authorization for local or international travel',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'indigo',
    href: '/requests/new/travel-authorization',
    category: 'HR',
  },
  {
    id: 'hotel',
    title: 'Complimentary Accommodation',
    description: 'Request a complimentary staff or external guest booking, or a voucher',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    color: 'primary',
    href: '/requests/new/accommodation',
    category: 'HR',
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

  // --- Form Requests ---
  {
    id: 'form_request',
    title: 'New Form Request',
    description: 'Browse and fill out available form templates',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'primary',
    href: '/requests/forms',
    category: 'Finance',
    popular: true,
  },

];

const getColorClasses = (color: string) => {
  // Unified clean, monochrome icon style matching the side navigation —
  // neutral glyphs, no per-item accent colours.
  const base = { bg: 'bg-transparent', icon: 'text-neutral-700', hover: 'hover:bg-neutral-100', border: 'hover:border-neutral-200' };
  return base;
};

export default function NewRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showESignModal, setShowESignModal] = useState(false);

  const handleESignComplete = async (signedPdfBlob: Blob, filename: string) => {
    // Download the signed PDF
    const url = URL.createObjectURL(signedPdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      <AppLayout title="New Request">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <>
    <AppLayout title="New Request">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

        {/* Hero Section with Animation */}
        <div className="rounded-2xl bg-gradient-to-br from-primary-50 via-white to-accent/5 border border-primary-100/50 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0">
              <Lottie
                animationData={sendingApprovalAnimation}
                loop={true}
                className="w-full h-full drop-shadow-lg"
              />
            </div>
            <div className="text-center sm:text-left flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-100/60 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
                Create New Request
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">
                What would you like to create?
              </h1>
              <p className="text-text-secondary mt-2 text-sm sm:text-base max-w-md">
                Pick a form below to start a new approval workflow. Search by name or jump to a department.
              </p>

              {/* Search Bar */}
              <div className="mt-5 relative max-w-md mx-auto sm:mx-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search for forms..."
                  className="block w-full pl-10 pr-10 py-3 rounded-xl border-gray-200 bg-white/70 backdrop-blur-sm text-text-primary placeholder-gray-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick-jump department nav — appears once results exist. Lets a user
            scroll straight to a department on long pages. */}
        {filteredItems.length > 0 && (
          <nav className="flex flex-wrap items-center gap-2 max-w-6xl mx-auto" aria-label="Jump to department">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-1">Jump to:</span>
            {(['Finance', 'HR', 'BIS forms'] as RequestCategory[]).map((cat) => {
              const count = filteredItems.filter(i => i.category === cat).length;
              if (count === 0) return null;
              const label = cat === 'BIS forms' ? 'BIS' : cat === 'HR' ? 'HR' : cat;
              const anchor = cat.toLowerCase().replace(/\s+/g, '-');
              return (
                <a
                  key={cat}
                  href={`#${anchor}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-medium text-text-secondary hover:text-primary-700 hover:border-primary-200 hover:bg-primary-50 transition-colors"
                >
                  {label}
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gray-100 text-[10px] font-bold">{count}</span>
                </a>
              );
            })}
          </nav>
        )}

        {/* Content Section */}
        <div className="space-y-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-lg">No request types found matching &ldquo;{searchQuery}&rdquo;</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-6 py-2 bg-white border border-gray-300 rounded-lg text-primary-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Clear Search
              </button>
            </div>
          ) : (
            (() => {
              // Group filtered items by department. System Functions sits at
              // the top because it's not tied to a specific department; the
              // remaining departments follow in their organisational order.
              const departmentOrder: {
                key: RequestCategory;
                label: string;
                description: string;
                iconPath: string;
                accent: string;    // header chip background
                accentText: string; // header chip text
                rail: string;       // left rail border colour
              }[] = [
                {
                  key: 'Finance',
                  label: 'Finance Department',
                  description: 'Approvals for finance, accounting and reimbursements',
                  iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                  accent: 'bg-neutral-100',
                  accentText: 'text-neutral-700',
                  rail: 'border-l-neutral-300',
                },
                {
                  key: 'HR',
                  label: 'Human Resources',
                  description: 'Travel authorisations, accommodation and people-related approvals',
                  iconPath: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0z',
                  accent: 'bg-neutral-100',
                  accentText: 'text-neutral-700',
                  rail: 'border-l-neutral-300',
                },
                {
                  key: 'BIS forms',
                  label: 'Business Information Systems',
                  description: 'IT, user access and BIS support requests',
                  iconPath: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
                  accent: 'bg-neutral-100',
                  accentText: 'text-neutral-700',
                  rail: 'border-l-neutral-300',
                },
              ];

              const grouped = departmentOrder
                .map((dept) => ({ dept, items: filteredItems.filter((i) => i.category === dept.key) }))
                .filter((g) => g.items.length > 0);

              return (
                <div className="space-y-6 max-w-6xl mx-auto">
                  {grouped.map(({ dept, items }) => (
                    <section
                      key={dept.key}
                      id={dept.key.toLowerCase().replace(/\s+/g, '-')}
                      className={`relative scroll-mt-24 rounded-2xl border border-gray-100 bg-white/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6 border-l-4 ${dept.rail}`}
                    >
                      <header className="flex items-start sm:items-center gap-3 mb-5">
                        <div className="flex items-center justify-center flex-shrink-0 text-neutral-700">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={dept.iconPath} />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base sm:text-lg font-bold text-text-primary font-heading">{dept.label}</h2>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${dept.accent} ${dept.accentText} text-[11px] font-semibold`}>
                              {items.length} {items.length === 1 ? 'form' : 'forms'}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{dept.description}</p>
                        </div>
                      </header>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {items.map((item) => {
                          const colors = getColorClasses(item.color);
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                if (item.id === 'esign') {
                                  setShowESignModal(true);
                                } else {
                                  router.push(item.href);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  if (item.id === 'esign') setShowESignModal(true);
                                  else router.push(item.href);
                                }
                              }}
                              className={`
                                group relative overflow-hidden bg-white rounded-xl border border-gray-100
                                p-4 cursor-pointer transition-all duration-300
                                hover:shadow-card-hover hover:border-[#E6D3B3] hover:-translate-y-0.5
                                focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-300
                              `}
                            >
                              {/* Decorative gradient corner — appears on hover */}
                              <div className={`
                                 absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100
                                 ${colors.bg.replace('50', '200')}
                               `} />

                              <div className="flex items-center gap-4 relative z-10">
                                <div className={`
                                  w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                                  ${colors.bg} transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3
                                `}>
                                  <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                                  </svg>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                                      {item.title}
                                    </h3>
                                    {item.popular && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-100 uppercase tracking-wide">
                                        Popular
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-gray-500 text-sm leading-snug line-clamp-2">
                                    {item.description}
                                  </p>
                                </div>

                                <div className="self-center opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                                  <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              );
            })()
          )}
        </div>

        {/* Footer Support Card
        <div className="mt-12 rounded-2xl bg-[#F3EADC] border border-[#E6D3B3] p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-[#9A7545]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-[#3F2D19] text-lg">Can't find what you're looking for?</h4>
              <p className="text-[#5E4426]/80">Check our documentation or contact the system administrator for help.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/help')}
            className="px-6 py-2.5 bg-white text-[#9A7545] font-semibold rounded-lg shadow-sm border border-[#C9B896] hover:bg-[#F3EADC] transition-all whitespace-nowrap"
          >
            Contact Support
          </button>
        </div> */}
      </div>
    </AppLayout>

      {/* E-Sign Modal */}
      <ESignModal
        isOpen={showESignModal}
        onClose={() => setShowESignModal(false)}
        onComplete={handleESignComplete}
      />
    </>
  );
}
