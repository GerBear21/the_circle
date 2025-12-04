import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'storage' | 'hr' | 'finance' | 'security';
  iconComponent: React.ReactNode;
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  connected_at?: string;
  last_sync?: string;
  sync_frequency?: string;
  features?: string[];
}

// Microsoft Teams Icon - Official purple color #6264A7
const TeamsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full">
    <path fill="#5059C9" d="M20.625 8.5h-3.75c-.345 0-.625.28-.625.625v6.25c0 1.726-1.399 3.125-3.125 3.125H10v.875c0 .69.56 1.25 1.25 1.25h6.25l2.5 2.5v-2.5h.625c.69 0 1.25-.56 1.25-1.25v-9.625c0-.345-.28-.625-.625-.625z"/>
    <circle fill="#5059C9" cx="18.5" cy="5" r="2.5"/>
    <circle fill="#7B83EB" cx="11" cy="4" r="3.5"/>
    <path fill="#7B83EB" d="M15.625 8H4.375C3.615 8 3 8.616 3 9.375v7.25C3 20.044 5.956 23 9.375 23h.25C13.044 23 16 20.044 16 16.625v-7.25C16 8.616 15.384 8 14.625 8z"/>
    <rect fill="#4B53BC" x="1" y="8" width="10" height="10" rx="1"/>
    <path fill="#FFF" d="M8.5 11H7v5H5.5v-5H4v-1.5h4.5V11z"/>
  </svg>
);

// SharePoint Icon - Official teal color #038387
const SharePointIcon = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full">
    <circle fill="#036C70" cx="11" cy="7" r="5.5"/>
    <circle fill="#1A9BA1" cx="17.5" cy="12.5" r="4"/>
    <circle fill="#37C6D0" cx="11" cy="18" r="3"/>
    <rect fill="#038387" x="1" y="6" width="10" height="10" rx="1"/>
    <path fill="#FFF" d="M6 13.5c-1.38 0-2.5-1.12-2.5-2.5S4.62 8.5 6 8.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm0-4c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
  </svg>
);

// Outlook Icon - Official blue color #0078D4
const OutlookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full">
    <path fill="#0A2767" d="M13 7v10l6-5z"/>
    <path fill="#0364B8" d="M13 7l6 5 3-2.5V7z"/>
    <path fill="#28A8EA" d="M22 12l-3 2.5V20l3-2.5z"/>
    <path fill="#0078D4" d="M22 7l-3 2.5L22 12z"/>
    <path fill="#0364B8" d="M13 17l-6-5v8z"/>
    <path fill="#14447D" d="M7 7l6 5 6-5z"/>
    <rect fill="#0078D4" x="1" y="5" width="10" height="10" rx="1"/>
    <ellipse fill="#FFF" cx="6" cy="10" rx="2.5" ry="2.5"/>
  </svg>
);

// RTGAtlas Icon - Uses the actual logo image
const RTGAtlasIcon = () => (
  <img 
    src="/images/RTG_LOGO.png" 
    alt="RTGAtlas" 
    className="w-full h-full object-contain"
  />
);

// Sage 300 Icon - Official Sage green color #00D639
const Sage300Icon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <circle cx="50" cy="50" r="45" fill="#00D639"/>
    <path d="M30 55 Q35 35, 50 35 Q65 35, 70 55 Q65 70, 50 70 Q35 70, 30 55" fill="white"/>
    <path d="M40 50 Q45 40, 50 40 Q55 40, 60 50 Q55 58, 50 58 Q45 58, 40 50" fill="#00D639"/>
  </svg>
);

// Azure AD Icon - Official Azure blue color #0078D4
const AzureADIcon = () => (
  <svg viewBox="0 0 24 24" className="w-full h-full">
    <path fill="#0078D4" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
    <path fill="#50E6FF" d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path fill="#0078D4" d="M12 12L2 7v10l10 5V12z"/>
    <path fill="#1490DF" d="M12 12l10-5v10l-10 5V12z"/>
    <circle fill="#FFF" cx="12" cy="10" r="3"/>
    <path fill="#FFF" d="M12 14c-2.5 0-4.5 1.5-4.5 3v1h9v-1c0-1.5-2-3-4.5-3z"/>
  </svg>
);

const mockIntegrations: Integration[] = [
  {
    id: 'int-1',
    name: 'Microsoft Teams',
    description: 'Receive instant approval notifications, collaborate on requests, and manage workflows directly within Teams channels and chats.',
    category: 'communication',
    iconComponent: <TeamsIcon />,
    status: 'disconnected',
    features: ['Real-time notifications', 'Approval actions in chat', 'Channel integration', 'Bot commands'],
  },
  {
    id: 'int-2',
    name: 'SharePoint',
    description: 'Store and manage approval documents, attach files from SharePoint libraries, and maintain document version history.',
    category: 'storage',
    iconComponent: <SharePointIcon />,
    status: 'disconnected',
    features: ['Document storage', 'File attachments', 'Version control', 'Folder sync'],
  },
  {
    id: 'int-3',
    name: 'Outlook',
    description: 'Send and receive approval emails, calendar integration for deadlines, and quick actions directly from your inbox.',
    category: 'communication',
    iconComponent: <OutlookIcon />,
    status: 'connected',
    connected_at: '2024-10-15T10:00:00Z',
    last_sync: '2024-12-04T09:30:00Z',
    sync_frequency: 'Real-time',
    features: ['Email notifications', 'Calendar reminders', 'Quick approve/reject', 'Email templates'],
  },
  {
    id: 'int-4',
    name: 'RTGAtlas',
    description: 'Sync employee data, organizational hierarchy, and automate leave and HR request workflows with your HR management system.',
    category: 'hr',
    iconComponent: <RTGAtlasIcon />,
    status: 'connected',
    connected_at: '2024-08-20T14:30:00Z',
    last_sync: '2024-12-04T06:00:00Z',
    sync_frequency: 'Every 4 hours',
    features: ['Employee sync', 'Org hierarchy', 'Leave management', 'HR workflows'],
  },
  {
    id: 'int-5',
    name: 'Sage 300',
    description: 'Integrate financial approvals, sync expense reports, and streamline purchase order workflows with your accounting system.',
    category: 'finance',
    iconComponent: <Sage300Icon />,
    status: 'pending',
    features: ['Expense approvals', 'PO workflows', 'Budget tracking', 'Financial reports'],
  },
  {
    id: 'int-6',
    name: 'Azure AD',
    description: 'Enterprise single sign-on, user provisioning, and role-based access control with Azure Active Directory.',
    category: 'security',
    iconComponent: <AzureADIcon />,
    status: 'connected',
    connected_at: '2024-06-01T08:00:00Z',
    last_sync: '2024-12-04T10:00:00Z',
    sync_frequency: 'Real-time',
    features: ['Single sign-on', 'User provisioning', 'Role sync', 'MFA support'],
  },
];

const categoryConfig: Record<string, { label: string; icon: string; color: string; bg: string; gradient: string }> = {
  communication: {
    label: 'Communication',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    color: 'text-[#5059C9]',
    bg: 'bg-[#F3F2F1]',
    gradient: 'from-[#5059C9] to-[#7B83EB]',
  },
  storage: {
    label: 'Cloud Storage',
    icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
    color: 'text-[#038387]',
    bg: 'bg-[#E6F7F7]',
    gradient: 'from-[#036C70] to-[#1A9BA1]',
  },
  hr: {
    label: 'Human Resources',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    color: 'text-[#8B5A2B]',
    bg: 'bg-[#FDF6E3]',
    gradient: 'from-[#8B5A2B] to-[#A0522D]',
  },
  finance: {
    label: 'Finance & Accounting',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-[#00D639]',
    bg: 'bg-[#E6FBE6]',
    gradient: 'from-[#00D639] to-[#00B232]',
  },
  security: {
    label: 'Security & Identity',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: 'text-[#0078D4]',
    bg: 'bg-[#E6F2FA]',
    gradient: 'from-[#0078D4] to-[#0089D6]',
  },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  connected: { label: 'Connected', color: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' },
  disconnected: { label: 'Not Connected', color: 'text-gray-600', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  pending: { label: 'Pending Setup', color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  error: { label: 'Connection Error', color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
};

type CategoryFilter = 'all' | 'communication' | 'storage' | 'hr' | 'finance' | 'security';
type StatusFilter = 'all' | 'connected' | 'disconnected';

export default function AdminIntegrationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIntegrations(mockIntegrations);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const connectedIntegrations = integrations.filter((i) => i.status === 'connected');

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch =
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || integration.category === categoryFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'connected' && integration.status === 'connected') ||
      (statusFilter === 'disconnected' && integration.status !== 'connected');
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return formatDate(dateString);
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="Integrations">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Integrations">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header with radial gradient banner */}
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 mb-8">
          {/* Radial gradient background */}
          <div 
            className="absolute inset-0 z-0"
            style={{
              background: 'radial-gradient(125% 125% at 50% 10%, #2D9CDB 40%, #23285C 100%)'
            }}
          />
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-heading">Integrations</h1>
                <p className="text-white/80 mt-2 max-w-lg">
                  Connect your enterprise tools to automate workflows and boost productivity
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white/15 backdrop-blur-md rounded-xl text-white text-sm border border-white/20">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="font-medium">{connectedIntegrations.length} of {integrations.length} Connected</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="connected">Connected</option>
              <option value="disconnected">Not Connected</option>
            </select>
          </div>
        </div>

        {/* Integration Cards Grid */}
        {filteredIntegrations.length === 0 ? (
          <Card className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No integrations found</h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">Try adjusting your search or filters to find what you're looking for</p>
            <Button
              variant="secondary"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
            >
              Clear all filters
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((integration) => {
              const statusInfo = statusConfig[integration.status];
              const catInfo = categoryConfig[integration.category];
              const isExpanded = expandedCard === integration.id;

              return (
                <Card
                  key={integration.id}
                  variant="outlined"
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer group ${
                    isExpanded ? 'ring-2 ring-brand-500 shadow-lg' : ''
                  }`}
                  onClick={() => setExpandedCard(isExpanded ? null : integration.id)}
                >
                  {/* Category color accent */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${catInfo.gradient}`} />
                  
                  {/* Status indicator */}
                  <div className="absolute top-4 right-4">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusInfo.bg}`}>
                      <div className={`w-2 h-2 rounded-full ${statusInfo.dot} ${integration.status === 'connected' ? 'animate-pulse' : ''}`} />
                      <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    {/* Icon and Title */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-14 h-14 ${catInfo.bg} rounded-2xl flex items-center justify-center flex-shrink-0 ${catInfo.color} group-hover:scale-105 transition-transform duration-200`}>
                        {integration.iconComponent}
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <h3 className="font-semibold text-gray-900 text-lg">{integration.name}</h3>
                        <span className={`text-xs ${catInfo.color} font-medium`}>{catInfo.label}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className={`text-sm text-gray-600 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {integration.description}
                    </p>

                    {/* Features - shown when expanded or connected */}
                    {(isExpanded || integration.status === 'connected') && integration.features && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Features</p>
                        <div className="flex flex-wrap gap-2">
                          {integration.features.map((feature, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-xs text-gray-700"
                            >
                              <svg className="w-3 h-3 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Connection info for connected integrations */}
                    {integration.status === 'connected' && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Last sync: {formatLastSync(integration.last_sync)}</span>
                          </div>
                          <span className="text-gray-400">{integration.sync_frequency}</span>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-5 flex items-center gap-2">
                      {integration.status === 'connected' ? (
                        <>
                          <Button 
                            variant="secondary" 
                            onClick={(e) => { e.stopPropagation(); }} 
                            className="flex-1 text-sm"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Configure
                          </Button>
                          <Button 
                            variant="secondary" 
                            onClick={(e) => { e.stopPropagation(); }} 
                            className="text-sm text-red-600 hover:bg-red-50 hover:border-red-200"
                          >
                            Disconnect
                          </Button>
                        </>
                      ) : integration.status === 'pending' ? (
                        <Button 
                          variant="primary" 
                          onClick={(e) => { e.stopPropagation(); }} 
                          className="w-full text-sm"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Complete Setup
                        </Button>
                      ) : integration.status === 'error' ? (
                        <Button 
                          variant="primary" 
                          onClick={(e) => { e.stopPropagation(); }} 
                          className="w-full text-sm bg-red-500 hover:bg-red-600"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reconnect
                        </Button>
                      ) : (
                        <Button 
                          variant="primary" 
                          onClick={(e) => { e.stopPropagation(); }} 
                          className="w-full text-sm"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-10 p-6 rounded-2xl bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Need help with integrations?</h3>
              <p className="text-sm text-gray-600 mt-1">
                Our team can help you set up and configure integrations for your organization.
              </p>
            </div>
            <Button variant="secondary" onClick={() => {}} className="text-sm whitespace-nowrap">
              Contact Support
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
