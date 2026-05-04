import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRBAC } from '../../contexts/RBACContext';

interface NavItem {
  href?: string;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
  requiredPermissions?: string[];
  requireAny?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
  requiredPermissions?: string[];
  requireAny?: boolean;
}

const navSections: NavSection[] = [
  {
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Requests',
    items: [
      // {
      //   href: '/requests',
      //   label: 'All Requests',
      //   icon: (
      //     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      //       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      //     </svg>
      //   ),
      // },

      {
        href: '/requests/new',
        label: 'Create New',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
      },
      {
        href: '/requests/my-requests',
        label: 'My requests',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
      },
      {
        href: '/approvals',
        label: 'My Approval Tasks',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      }
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        href: '/finance/capex-tracker',
        label: 'CAPEX Tracker',
        requiredPermissions: ['finance.view_tracker'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h3M9 17l-3 3m0 0l-3-3m3 3V4m6 13h6m-6-4h6m-6-4h6" />
          </svg>
        ),
      },
      {
        href: '/finance/budget',
        label: 'Budget Management',
        requiredPermissions: ['finance.view_budget'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        href: '/finance/commitments',
        label: 'Commitments & Spend',
        requiredPermissions: ['finance.view_tracker'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        href: '/finance/reports',
        label: 'Financial Reports',
        requiredPermissions: ['finance.view_tracker'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Reporting and Archives',
    items: [
      {
        href: '/archive',
        label: 'Archives',
        requiredPermissions: ['archives.view_own', 'archives.view_all'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        ),
      },
      {
        href: '/archive/audit',
        label: 'Audit Trail and Compliance',
        requiredPermissions: ['admin.audit_logs'],
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      /* {
        href: '/reports',
        label: 'Reports',
        requiredPermissions: ['reports.view_own', 'reports.view_team', 'reports.view_all', 'reports.analytics', 'reports.sla_compliance'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      }, */
    ],
  },
  {
    title: 'System',
    items: [
      {
        href: '/system/settings',
        label: 'My Settings',
        requiredPermissions: ['settings.view', 'settings.edit'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        href: '/admin/settings',
        label: 'System Config',
        requiredPermissions: ['admin.system_config'],
        requireAny: true,
        icon: (
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947z" />
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
           </svg>
        ),
      },
      {
        href: '/admin/roles',
        label: 'Roles & Access',
        requiredPermissions: ['admin.roles', 'users.assign_roles', 'users.manage_access'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      /* {
        href: '/admin/users',
        label: 'User Management',
        requiredPermissions: ['users.view', 'users.create', 'users.edit', 'users.assign_roles'],
        requireAny: true,
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      }, */
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { hasPermission, hasAnyPermission, hasAllPermissions, loading: rbacLoading } = useRBAC();
  const [expandedSections, setExpandedSections] = useState<string[]>(['Requests', 'Finance', 'Reporting and Archives', 'System']);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Filter nav items based on RBAC permissions
  const filteredNavSections = useMemo(() => {
    if (rbacLoading) return []; // Hide nav while RBAC loads to prevent unauthorized flash
    return navSections
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          if (!item.requiredPermissions || item.requiredPermissions.length === 0) return true;
          return item.requireAny
            ? hasAnyPermission(item.requiredPermissions)
            : hasAllPermissions(item.requiredPermissions);
        }),
      }))
      .filter(section => section.items.length > 0);
  }, [rbacLoading, hasAnyPermission, hasAllPermissions]);

  // Fetch profile data if session doesn't have it
  useEffect(() => {
    const sessionUser = session?.user as any;
    if (sessionUser?.profile_picture_url) {
      setProfilePhoto(sessionUser.profile_picture_url);
    }
    if (sessionUser?.display_name) {
      setDisplayName(sessionUser.display_name);
    }
    
    // If session doesn't have profile data, fetch from API
    if (session?.user?.id && (!sessionUser?.profile_picture_url || !sessionUser?.display_name)) {
      fetch('/api/user/profile')
        .then(res => res.json())
        .then(data => {
          if (data.profile_picture_url) {
            setProfilePhoto(data.profile_picture_url);
          }
          if (data.display_name) {
            setDisplayName(data.display_name);
          }
        })
        .catch(err => console.error('Error fetching profile:', err));
    }
  }, [session]);

  useEffect(() => {
    if (!router.pathname.startsWith('/finance')) return;
    setExpandedSections((prev) => (prev.includes('Finance') ? prev : [...prev, 'Finance']));
  }, [router.pathname]);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === '/requests' && router.pathname.startsWith('/requests')) return true;
    return router.pathname === href || router.pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Mobile overlay - only when expanded (isOpen true) on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 font-sans w-64 shadow-2xl lg:shadow-none transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <svg className="w-8 h-8" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="brandGradientSidebar" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#9A7545" />
                      <stop offset="100%" stopColor="#C9A574" />
                    </linearGradient>
                  </defs>
                  <path d="M 100 25
                     C 145 25, 180 60, 180 100
                     C 180 145, 145 180, 100 180
                     C 55 180, 20 145, 20 100
                     C 20 60, 52 28, 95 25
                     L 100 25
                     L 98 40
                     C 60 42, 35 65, 35 100
                     C 35 138, 65 167, 100 167
                     C 138 167, 167 138, 167 100
                     C 167 65, 140 38, 100 38
                     Z"
                    fill="url(#brandGradientSidebar)"
                  />
                </svg>
              </div>
              <span className="text-gray-900 font-bold text-xl whitespace-nowrap">
                The Circle
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 custom-scrollbar">
            {filteredNavSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className={sectionIndex > 0 ? 'mt-6' : ''}>
                {section.title && (
                  <div className="px-2 py-2 mb-1 flex items-center justify-between whitespace-nowrap">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {section.title}
                    </span>
                    <button onClick={() => toggleSection(section.title!)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <svg
                        className={`w-3 h-3 transition-transform duration-200 ${expandedSections.includes(section.title!) ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                )}

                <div
                  className={`space-y-1 transition-all duration-300 ${section.title && !expandedSections.includes(section.title!) ? 'hidden' : ''
                    }`}
                >
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href!}
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          onClose();
                        }
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                        ${isActive(item.href!)
                          ? 'bg-brand-50 text-brand-600 shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                        }
                      `}
                      title={item.label}
                    >
                      <span className={`shrink-0 ${isActive(item.href!) ? 'text-brand-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                        {item.icon}
                      </span>
                      <span className="whitespace-nowrap">
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User section at bottom */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <Link
              href="/system/settings"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-white hover:shadow-sm hover:text-gray-900 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-medium text-sm shrink-0 overflow-hidden ring-2 ring-white">
                {(session?.user as any)?.profile_picture_url || profilePhoto ? (
                  <img
                    src={(session?.user as any)?.profile_picture_url || profilePhoto || ''}
                    alt={(session?.user as any)?.display_name || displayName || 'Profile'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // If image fails to load, clear it and show initial
                      e.currentTarget.style.display = 'none';
                      setProfilePhoto(null);
                    }}
                  />
                ) : (
                  (session?.user as any)?.display_name?.charAt(0) || displayName?.charAt(0) || (session?.user as any)?.email?.charAt(0) || 'U'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{(session?.user as any)?.display_name || 'User Profile'}</p>
                <p className="text-xs text-gray-500 truncate">View settings</p>
              </div>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
