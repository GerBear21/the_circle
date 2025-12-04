import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';

// Types
interface WorkflowStep {
  id: string;
  type: 'approval' | 'notification' | 'condition' | 'parallel' | 'escalation';
  name: string;
  description?: string;
  config: {
    approverType?: 'user' | 'role' | 'manager' | 'department_head' | 'dynamic';
    approverId?: string;
    approverName?: string;
    requiredApprovals?: number;
    escalateAfterHours?: number;
    escalateTo?: string;
    condition?: {
      field: string;
      operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
      value: string | number;
    };
    notifyUsers?: string[];
    notifyRoles?: string[];
  };
  position: { x: number; y: number };
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'draft' | 'active' | 'inactive';
  version: number;
  steps: WorkflowStep[];
  triggers: {
    requestTypes: string[];
    conditions?: { field: string; operator: string; value: string | number }[];
  };
  created_at: string;
  updated_at: string;
  created_by: string;
  usage_count: number;
}

// Mock data
const mockWorkflows: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Standard Purchase Request',
    description: 'Default approval workflow for purchase requests under $5,000',
    category: 'Procurement',
    status: 'active',
    version: 3,
    steps: [
      { id: 's1', type: 'approval', name: 'Manager Approval', config: { approverType: 'manager', requiredApprovals: 1 }, position: { x: 0, y: 0 } },
      { id: 's2', type: 'notification', name: 'Notify Finance', config: { notifyRoles: ['Finance'] }, position: { x: 1, y: 0 } },
    ],
    triggers: { requestTypes: ['purchase', 'procurement'] },
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-11-20T14:30:00Z',
    created_by: 'Admin User',
    usage_count: 156,
  },
  {
    id: 'wf-2',
    name: 'High Value CAPEX',
    description: 'Multi-level approval for capital expenditure over $50,000',
    category: 'Finance',
    status: 'active',
    version: 2,
    steps: [
      { id: 's1', type: 'approval', name: 'Department Head', config: { approverType: 'department_head', requiredApprovals: 1 }, position: { x: 0, y: 0 } },
      { id: 's2', type: 'approval', name: 'Finance Director', config: { approverType: 'role', approverName: 'Finance Director', requiredApprovals: 1 }, position: { x: 1, y: 0 } },
      { id: 's3', type: 'approval', name: 'CEO Approval', config: { approverType: 'role', approverName: 'CEO', requiredApprovals: 1 }, position: { x: 2, y: 0 } },
    ],
    triggers: { requestTypes: ['capex'], conditions: [{ field: 'amount', operator: 'greater_than', value: 50000 }] },
    created_at: '2024-02-10T08:00:00Z',
    updated_at: '2024-10-15T11:00:00Z',
    created_by: 'Admin User',
    usage_count: 23,
  },
  {
    id: 'wf-3',
    name: 'Leave Request',
    description: 'Simple manager approval for leave requests',
    category: 'HR',
    status: 'active',
    version: 1,
    steps: [
      { id: 's1', type: 'approval', name: 'Direct Manager', config: { approverType: 'manager', requiredApprovals: 1, escalateAfterHours: 48 }, position: { x: 0, y: 0 } },
    ],
    triggers: { requestTypes: ['leave'] },
    created_at: '2024-01-20T09:00:00Z',
    updated_at: '2024-01-20T09:00:00Z',
    created_by: 'HR Manager',
    usage_count: 342,
  },
  {
    id: 'wf-4',
    name: 'IT Equipment Request',
    description: 'IT approval with budget threshold conditions',
    category: 'IT',
    status: 'active',
    version: 4,
    steps: [
      { id: 's1', type: 'approval', name: 'IT Manager', config: { approverType: 'role', approverName: 'IT Manager', requiredApprovals: 1 }, position: { x: 0, y: 0 } },
      { id: 's2', type: 'condition', name: 'Check Amount', config: { condition: { field: 'amount', operator: 'greater_than', value: 2000 } }, position: { x: 1, y: 0 } },
      { id: 's3', type: 'approval', name: 'Finance Approval', config: { approverType: 'role', approverName: 'Finance Manager', requiredApprovals: 1 }, position: { x: 2, y: 0 } },
    ],
    triggers: { requestTypes: ['it_request'] },
    created_at: '2024-03-05T10:00:00Z',
    updated_at: '2024-11-01T16:45:00Z',
    created_by: 'IT Admin',
    usage_count: 89,
  },
  {
    id: 'wf-5',
    name: 'Expense Reimbursement',
    description: 'Draft workflow for expense claims - pending review',
    category: 'Finance',
    status: 'draft',
    version: 1,
    steps: [
      { id: 's1', type: 'approval', name: 'Manager Approval', config: { approverType: 'manager', requiredApprovals: 1 }, position: { x: 0, y: 0 } },
    ],
    triggers: { requestTypes: ['expense'] },
    created_at: '2024-11-28T14:00:00Z',
    updated_at: '2024-11-28T14:00:00Z',
    created_by: 'Finance Lead',
    usage_count: 0,
  },
  {
    id: 'wf-6',
    name: 'Legacy Travel Request',
    description: 'Old travel approval workflow - replaced by new policy',
    category: 'HR',
    status: 'inactive',
    version: 2,
    steps: [
      { id: 's1', type: 'approval', name: 'Manager', config: { approverType: 'manager', requiredApprovals: 1 }, position: { x: 0, y: 0 } },
      { id: 's2', type: 'approval', name: 'HR', config: { approverType: 'role', approverName: 'HR Manager', requiredApprovals: 1 }, position: { x: 1, y: 0 } },
    ],
    triggers: { requestTypes: ['travel'] },
    created_at: '2023-06-15T10:00:00Z',
    updated_at: '2024-08-01T09:00:00Z',
    created_by: 'Admin User',
    usage_count: 78,
  },
];

const stepTypeConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  approval: { label: 'Approval', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-green-600', bg: 'bg-green-100' },
  notification: { label: 'Notification', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: 'text-blue-600', bg: 'bg-blue-100' },
  condition: { label: 'Condition', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-purple-600', bg: 'bg-purple-100' },
  parallel: { label: 'Parallel', icon: 'M4 6h16M4 12h16m-7 6h7', color: 'text-orange-600', bg: 'bg-orange-100' },
  escalation: { label: 'Escalation', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: 'text-red-600', bg: 'bg-red-100' },
};

const categoryColors: Record<string, string> = {
  Procurement: 'bg-blue-100 text-blue-700',
  Finance: 'bg-green-100 text-green-700',
  HR: 'bg-purple-100 text-purple-700',
  IT: 'bg-cyan-100 text-cyan-700',
  Operations: 'bg-orange-100 text-orange-700',
  General: 'bg-gray-100 text-gray-700',
};

const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  draft: { label: 'Draft', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  inactive: { label: 'Inactive', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

type StatusFilter = 'all' | 'active' | 'draft' | 'inactive';
type ViewMode = 'grid' | 'list';

export default function WorkflowBuilderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setWorkflows(mockWorkflows);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const categories = Array.from(new Set(workflows.map((w) => w.category)));

  const filteredWorkflows = workflows.filter((wf) => {
    const matchesStatus = statusFilter === 'all' || wf.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || wf.category === categoryFilter;
    const matchesSearch =
      wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const stats = {
    total: workflows.length,
    active: workflows.filter((w) => w.status === 'active').length,
    draft: workflows.filter((w) => w.status === 'draft').length,
    inactive: workflows.filter((w) => w.status === 'inactive').length,
    totalUsage: workflows.reduce((sum, w) => sum + w.usage_count, 0),
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDuplicate = (workflow: Workflow) => {
    const newWorkflow: Workflow = {
      ...workflow,
      id: `wf-${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      status: 'draft',
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      usage_count: 0,
    };
    setWorkflows([newWorkflow, ...workflows]);
  };

  const handleDelete = (id: string) => {
    setWorkflows(workflows.filter((w) => w.id !== id));
    setShowDeleteConfirm(null);
  };

  const handleToggleStatus = (workflow: Workflow) => {
    const newStatus = workflow.status === 'active' ? 'inactive' : 'active';
    setWorkflows(
      workflows.map((w) =>
        w.id === workflow.id ? { ...w, status: newStatus, updated_at: new Date().toISOString() } : w
      )
    );
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="Workflow Builder">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Workflow Builder">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">Workflow Builder</h1>
            <p className="text-gray-500 mt-1">Design and manage approval workflows for your organization</p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Workflow
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                <div className="text-sm text-gray-500">Active</div>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
                <div className="text-sm text-gray-500">Drafts</div>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-500">{stats.inactive}</div>
                <div className="text-sm text-gray-500">Inactive</div>
              </div>
            </div>
          </Card>
          <Card className="!p-4 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-brand-600">{stats.totalUsage.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Total Uses</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <div className="hidden sm:flex items-center border border-gray-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 ${viewMode === 'grid' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 ${viewMode === 'list' ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            Showing {filteredWorkflows.length} of {workflows.length} workflows
          </p>
        </div>

        {/* Workflows Grid/List */}
        {filteredWorkflows.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 mb-1">No workflows found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first workflow to get started'}
            </p>
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                Create Workflow
              </Button>
            )}
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onEdit={() => setSelectedWorkflow(workflow)}
                onDuplicate={() => handleDuplicate(workflow)}
                onDelete={() => setShowDeleteConfirm(workflow.id)}
                onToggleStatus={() => handleToggleStatus(workflow)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorkflows.map((workflow) => (
              <WorkflowListItem
                key={workflow.id}
                workflow={workflow}
                onEdit={() => setSelectedWorkflow(workflow)}
                onDuplicate={() => handleDuplicate(workflow)}
                onDelete={() => setShowDeleteConfirm(workflow.id)}
                onToggleStatus={() => handleToggleStatus(workflow)}
              />
            ))}
          </div>
        )}

        {/* Workflow Detail Modal */}
        {selectedWorkflow && (
          <WorkflowDetailModal
            workflow={selectedWorkflow}
            onClose={() => setSelectedWorkflow(null)}
          />
        )}

        {/* Create Workflow Modal */}
        {showCreateModal && (
          <CreateWorkflowModal
            onClose={() => setShowCreateModal(false)}
            onCreate={(newWorkflow) => {
              setWorkflows([newWorkflow, ...workflows]);
              setShowCreateModal(false);
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <DeleteConfirmModal
            workflowName={workflows.find((w) => w.id === showDeleteConfirm)?.name || ''}
            onConfirm={() => handleDelete(showDeleteConfirm)}
            onCancel={() => setShowDeleteConfirm(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}

// Workflow Card Component
function WorkflowCard({
  workflow,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
}: {
  workflow: Workflow;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const statusInfo = statusConfig[workflow.status];
  const categoryColor = categoryColors[workflow.category] || categoryColors.General;
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Card className="relative group hover:shadow-lg transition-shadow">
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusInfo.dot} mr-1.5`}></span>
          {statusInfo.label}
        </span>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => { onEdit(); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Workflow
                </button>
                <button
                  onClick={() => { onDuplicate(); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Duplicate
                </button>
                <button
                  onClick={() => { onToggleStatus(); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {workflow.status === 'active' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Deactivate
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Activate
                    </>
                  )}
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { onDelete(); setShowMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Workflow Info */}
      <div className="cursor-pointer" onClick={onEdit}>
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{workflow.name}</h3>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{workflow.description}</p>

        {/* Category & Version */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${categoryColor}`}>
            {workflow.category}
          </span>
          <span className="text-xs text-gray-400">v{workflow.version}</span>
        </div>

        {/* Steps Preview */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {workflow.steps.slice(0, 4).map((step, idx) => {
            const stepConfig = stepTypeConfig[step.type];
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-lg ${stepConfig.bg} flex items-center justify-center flex-shrink-0`}
                  title={step.name}
                >
                  <svg className={`w-4 h-4 ${stepConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stepConfig.icon} />
                  </svg>
                </div>
                {idx < workflow.steps.length - 1 && idx < 3 && (
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            );
          })}
          {workflow.steps.length > 4 && (
            <span className="text-xs text-gray-400 ml-1">+{workflow.steps.length - 4}</span>
          )}
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {workflow.usage_count.toLocaleString()} uses
          </div>
          <span className="text-xs text-gray-400">
            Updated {new Date(workflow.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </Card>
  );
}

// Workflow List Item Component
function WorkflowListItem({
  workflow,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
}: {
  workflow: Workflow;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const statusInfo = statusConfig[workflow.status];
  const categoryColor = categoryColors[workflow.category] || categoryColors.General;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{workflow.name}</h3>
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${categoryColor}`}>
              {workflow.category}
            </span>
            <span className="text-xs text-gray-400">v{workflow.version}</span>
          </div>
          <p className="text-sm text-gray-500 truncate">{workflow.description}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
              {statusInfo.label}
            </span>
            <span className="text-xs text-gray-500">{workflow.steps.length} steps</span>
            <span className="text-xs text-gray-500">{workflow.usage_count.toLocaleString()} uses</span>
            <span className="text-xs text-gray-400">
              Updated {new Date(workflow.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={onDuplicate}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Workflow Detail Modal
function WorkflowDetailModal({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const statusInfo = statusConfig[workflow.status];
  const categoryColor = categoryColors[workflow.category] || categoryColors.General;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-gray-900">{workflow.name}</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-gray-500">{workflow.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Meta Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Category</div>
              <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${categoryColor}`}>
                {workflow.category}
              </span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Version</div>
              <div className="font-semibold text-gray-900">v{workflow.version}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Total Uses</div>
              <div className="font-semibold text-gray-900">{workflow.usage_count.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-sm text-gray-500 mb-1">Created By</div>
              <div className="font-semibold text-gray-900">{workflow.created_by}</div>
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Steps</h3>
            <div className="relative">
              {/* Connection Line */}
              <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200" />
              
              <div className="space-y-4">
                {workflow.steps.map((step, idx) => {
                  const stepConfig = stepTypeConfig[step.type];
                  return (
                    <div key={step.id} className="relative flex items-start gap-4">
                      {/* Step Number */}
                      <div className={`relative z-10 w-12 h-12 rounded-xl ${stepConfig.bg} flex items-center justify-center flex-shrink-0`}>
                        <svg className={`w-6 h-6 ${stepConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stepConfig.icon} />
                        </svg>
                      </div>
                      
                      {/* Step Content */}
                      <div className="flex-1 bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-400">Step {idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${stepConfig.bg} ${stepConfig.color}`}>
                            {stepConfig.label}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900">{step.name}</h4>
                        {step.config.approverType && (
                          <p className="text-sm text-gray-500 mt-1">
                            Approver: {step.config.approverName || step.config.approverType.replace('_', ' ')}
                          </p>
                        )}
                        {step.config.escalateAfterHours && (
                          <p className="text-sm text-gray-500 mt-1">
                            Escalates after {step.config.escalateAfterHours} hours
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Triggers */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Triggers</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="mb-3">
                <div className="text-sm text-gray-500 mb-2">Request Types</div>
                <div className="flex flex-wrap gap-2">
                  {workflow.triggers.requestTypes.map((type) => (
                    <span key={type} className="px-3 py-1 bg-white rounded-lg text-sm font-medium text-gray-700 border border-gray-200">
                      {type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
              {workflow.triggers.conditions && workflow.triggers.conditions.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-2">Conditions</div>
                  <div className="space-y-2">
                    {workflow.triggers.conditions.map((cond, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-700">{cond.field}</span>
                        <span className="text-gray-500">{cond.operator.replace('_', ' ')}</span>
                        <span className="font-medium text-gray-700">
                          {typeof cond.value === 'number' ? `$${cond.value.toLocaleString()}` : cond.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Workflow
          </Button>
        </div>
      </div>
    </div>
  );
}

// Create Workflow Modal
function CreateWorkflowModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (workflow: Workflow) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');

  const handleCreate = () => {
    if (!name.trim()) return;
    
    const newWorkflow: Workflow = {
      id: `wf-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category,
      status: 'draft',
      version: 1,
      steps: [],
      triggers: { requestTypes: [] },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'Current User',
      usage_count: 0,
    };
    onCreate(newWorkflow);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create New Workflow</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Standard Purchase Approval"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow is for..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="General">General</option>
              <option value="Procurement">Procurement</option>
              <option value="Finance">Finance</option>
              <option value="HR">HR</option>
              <option value="IT">IT</option>
              <option value="Operations">Operations</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!name.trim()}>
            Create Workflow
          </Button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  workflowName,
  onConfirm,
  onCancel,
}: {
  workflowName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Workflow</h3>
        <p className="text-gray-500 text-center mb-6">
          Are you sure you want to delete <span className="font-medium text-gray-900">"{workflowName}"</span>? This action cannot be undone.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete Workflow
          </Button>
        </div>
      </div>
    </div>
  );
}
