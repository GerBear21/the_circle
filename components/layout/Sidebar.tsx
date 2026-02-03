import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useCurrentUser } from '@/hooks';

interface NavItem {
  href?: string;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
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
        href: 'requests/my-requests',
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
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        href: '/system/settings',
        label: 'Settings',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const { user: appUser } = useCurrentUser();
  const [expandedSections, setExpandedSections] = useState<string[]>(['Requests', 'System']);

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
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out font-sans
          ${isOpen ? 'w-64' : 'w-16'} 
          lg:w-64
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
                      <stop offset="0%" stopColor="#2D9CDB" />
                      <stop offset="100%" stopColor="#A78BFA" />
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
              <span className={`text-gray-900 font-bold text-xl whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-100 hidden lg:block'}`}>
                The Circle
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
            {navSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className={sectionIndex > 0 ? 'mt-6' : ''}>
                {section.title && (
                  <div className={`px-2 py-2 mb-1 flex items-center justify-between whitespace-nowrap ${isOpen ? 'opacity-100' : 'opacity-0 lg:opacity-100 hidden lg:flex'}`}>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {section.title}
                    </span>
                    <button onClick={() => toggleSection(section.title!)} className="text-gray-400 hover:text-gray-600">
                      <svg
                        className={`w-3 h-3 transition-transform ${expandedSections.includes(section.title!) ? 'rotate-180' : ''}`}
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
                  className={`space-y-1 ${section.title && isOpen && !expandedSections.includes(section.title!) ? 'hidden' : ''
                    }`}
                >
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href!}
                      onClick={() => {
                        if (window.innerWidth < 1024 && isOpen) {
                          onClose();
                        }
                      }}
                      className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all group
                        ${isActive(item.href!)
                          ? 'bg-brand-50 text-brand-600'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }
                        ${isOpen ? 'gap-3' : 'justify-center'} lg:justify-start lg:gap-3
                      `}
                      title={!isOpen ? item.label : undefined}
                    >
                      <span className={`shrink-0 ${isActive(item.href!) ? 'text-brand-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                        {item.icon}
                      </span>
                      <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 hidden'} lg:opacity-100 lg:w-auto lg:block`}>
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User section at bottom */}
          <div className="p-4 border-t border-gray-200 overflow-hidden">
            <Link
              href="/profile"
              className={`flex items-center rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all
                 ${isOpen ? 'gap-3 px-3 py-2.5' : 'justify-center py-2 px-0'} lg:justify-start lg:gap-3 lg:px-3 lg:py-2.5
              `}
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-medium text-sm shrink-0 overflow-hidden">
                {appUser?.profile_picture_url ? (
                  <img 
                    src={appUser.profile_picture_url} 
                    alt={appUser.display_name || 'Profile'} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  appUser?.display_name?.charAt(0) || appUser?.email?.charAt(0) || 'U'
                )}
              </div>
              <div className={`flex-1 min-w-0 ${isOpen ? 'block' : 'hidden lg:block'}`}>
                <p className="text-sm font-medium text-gray-900 truncate">User Profile</p>
                <p className="text-xs text-gray-500 truncate">View settings</p>
              </div>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
