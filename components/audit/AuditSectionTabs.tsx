import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutGrid,
  ScrollText,
  ShieldAlert,
  ServerCog,
  MousePointerClick,
  GitBranch,
  FileBarChart2,
} from 'lucide-react';

const tabs = [
  { href: '/audit', label: 'Dashboard', icon: LayoutGrid },
  { href: '/audit/logs', label: 'Immutable Logs', icon: ScrollText },
  { href: '/audit/security', label: 'Security', icon: ShieldAlert },
  { href: '/audit/system', label: 'System', icon: ServerCog },
  { href: '/audit/activity', label: 'Activity', icon: MousePointerClick },
  { href: '/audit/transactions', label: 'Transactions & Workflows', icon: GitBranch },
  { href: '/audit/reports', label: 'Reports', icon: FileBarChart2 },
];

/** Horizontal sub-navigation shared by every page in the /audit section. */
export default function AuditSectionTabs() {
  const router = useRouter();
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 custom-scrollbar">
      {tabs.map((tab) => {
        const active = router.pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300 hover:text-brand-700'
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.5} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
