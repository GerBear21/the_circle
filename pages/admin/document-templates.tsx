import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import { Card, Button } from '../../components/ui';

interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'draft' | 'archived';
  fields: TemplateField[];
  created_at: string;
  updated_at: string;
  created_by: string;
  usage_count: number;
  icon: string;
}

const mockTemplates: DocumentTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Purchase Request',
    description: 'Standard template for requesting purchases of goods and services',
    category: 'Procurement',
    status: 'active',
    fields: [
      { id: 'f1', name: 'Item Description', type: 'textarea', required: true },
      { id: 'f2', name: 'Quantity', type: 'number', required: true },
      { id: 'f3', name: 'Estimated Cost', type: 'number', required: true },
      { id: 'f4', name: 'Vendor', type: 'text', required: false },
      { id: 'f5', name: 'Urgency', type: 'select', required: true, options: ['Low', 'Medium', 'High'] },
    ],
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-11-20T14:30:00Z',
    created_by: 'Admin User',
    usage_count: 234,
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    id: 'tpl-2',
    name: 'Leave Request',
    description: 'Employee leave and time-off request form',
    category: 'HR',
    status: 'active',
    fields: [
      { id: 'f1', name: 'Leave Type', type: 'select', required: true, options: ['Annual', 'Sick', 'Personal', 'Unpaid'] },
      { id: 'f2', name: 'Start Date', type: 'date', required: true },
      { id: 'f3', name: 'End Date', type: 'date', required: true },
      { id: 'f4', name: 'Reason', type: 'textarea', required: false },
    ],
    created_at: '2024-02-10T08:00:00Z',
    updated_at: '2024-10-15T11:00:00Z',
    created_by: 'HR Manager',
    usage_count: 456,
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    id: 'tpl-3',
    name: 'Expense Reimbursement',
    description: 'Submit expense claims with receipt attachments',
    category: 'Finance',
    status: 'active',
    fields: [
      { id: 'f1', name: 'Expense Type', type: 'select', required: true, options: ['Travel', 'Meals', 'Supplies', 'Other'] },
      { id: 'f2', name: 'Amount', type: 'number', required: true },
      { id: 'f3', name: 'Date of Expense', type: 'date', required: true },
      { id: 'f4', name: 'Description', type: 'textarea', required: true },
      { id: 'f5', name: 'Receipt', type: 'file', required: true },
    ],
    created_at: '2024-03-05T10:00:00Z',
    updated_at: '2024-11-01T16:45:00Z',
    created_by: 'Finance Lead',
    usage_count: 189,
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    id: 'tpl-4',
    name: 'IT Equipment Request',
    description: 'Request new IT equipment or hardware upgrades',
    category: 'IT',
    status: 'active',
    fields: [
      { id: 'f1', name: 'Equipment Type', type: 'select', required: true, options: ['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Other'] },
      { id: 'f2', name: 'Justification', type: 'textarea', required: true },
      { id: 'f3', name: 'Preferred Brand/Model', type: 'text', required: false },
    ],
    created_at: '2024-04-20T09:00:00Z',
    updated_at: '2024-09-10T13:00:00Z',
    created_by: 'IT Admin',
    usage_count: 78,
    icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    id: 'tpl-5',
    name: 'CAPEX Request',
    description: 'Capital expenditure approval for large investments',
    category: 'Finance',
    status: 'active',
    fields: [
      { id: 'f1', name: 'Project Name', type: 'text', required: true },
      { id: 'f2', name: 'Total Amount', type: 'number', required: true },
      { id: 'f3', name: 'Business Case', type: 'textarea', required: true },
      { id: 'f4', name: 'ROI Timeline', type: 'select', required: true, options: ['< 1 year', '1-2 years', '2-3 years', '> 3 years'] },
      { id: 'f5', name: 'Supporting Documents', type: 'file', required: false },
    ],
    created_at: '2024-05-15T14:00:00Z',
    updated_at: '2024-08-20T10:30:00Z',
    created_by: 'CFO',
    usage_count: 23,
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    id: 'tpl-6',
    name: 'Travel Request',
    description: 'Pre-approval for business travel arrangements',
    category: 'HR',
    status: 'draft',
    fields: [
      { id: 'f1', name: 'Destination', type: 'text', required: true },
      { id: 'f2', name: 'Travel Dates', type: 'date', required: true },
      { id: 'f3', name: 'Purpose', type: 'textarea', required: true },
      { id: 'f4', name: 'Estimated Budget', type: 'number', required: true },
    ],
    created_at: '2024-11-28T14:00:00Z',
    updated_at: '2024-11-28T14:00:00Z',
    created_by: 'HR Manager',
    usage_count: 0,
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

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
  archived: { label: 'Archived', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

const fieldTypeConfig: Record<string, { label: string; icon: string; color: string }> = {
  text: { label: 'Text', icon: 'M4 6h16M4 12h16m-7 6h7', color: 'text-gray-600' },
  number: { label: 'Number', icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14', color: 'text-blue-600' },
  date: { label: 'Date', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'text-purple-600' },
  select: { label: 'Dropdown', icon: 'M19 9l-7 7-7-7', color: 'text-teal-600' },
  textarea: { label: 'Long Text', icon: 'M4 6h16M4 10h16M4 14h10', color: 'text-orange-600' },
  file: { label: 'File Upload', icon: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13', color: 'text-pink-600' },
  checkbox: { label: 'Checkbox', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-green-600' },
};

type StatusFilter = 'all' | 'active' | 'draft' | 'archived';
type ViewMode = 'grid' | 'list';

export default function DocumentTemplatesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTemplates(mockTemplates);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  const filteredTemplates = templates.filter((tpl) => {
    const matchesStatus = statusFilter === 'all' || tpl.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || tpl.category === categoryFilter;
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const stats = {
    total: templates.length,
    active: templates.filter((t) => t.status === 'active').length,
    draft: templates.filter((t) => t.status === 'draft').length,
    archived: templates.filter((t) => t.status === 'archived').length,
    totalUsage: templates.reduce((sum, t) => sum + t.usage_count, 0),
  };

  const handleDuplicate = (template: DocumentTemplate) => {
    const newTemplate: DocumentTemplate = {
      ...template,
      id: `tpl-${Date.now()}`,
      name: `${template.name} (Copy)`,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      usage_count: 0,
    };
    setTemplates([newTemplate, ...templates]);
  };

  const handleDelete = (id: string) => {
    setTemplates(templates.filter((t) => t.id !== id));
    setShowDeleteConfirm(null);
  };

  const handleToggleStatus = (template: DocumentTemplate) => {
    const newStatus = template.status === 'active' ? 'archived' : 'active';
    setTemplates(
      templates.map((t) =>
        t.id === template.id ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t
      )
    );
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="Document Templates">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="Document Templates">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">Document Templates</h1>
            <p className="text-gray-500 mt-1">Create and manage request form templates</p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Template
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-500">{stats.archived}</div>
                <div className="text-sm text-gray-500">Archived</div>
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
              placeholder="Search templates..."
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
              <option value="archived">Archived</option>
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
            Showing {filteredTemplates.length} of {templates.length} templates
          </p>
        </div>

        {/* Templates Grid/List */}
        {filteredTemplates.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 mb-1">No templates found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first template to get started'}
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
                Create Template
              </Button>
            )}
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => setSelectedTemplate(template)}
                onDuplicate={() => handleDuplicate(template)}
                onDelete={() => setShowDeleteConfirm(template.id)}
                onToggleStatus={() => handleToggleStatus(template)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTemplates.map((template) => (
              <TemplateListItem
                key={template.id}
                template={template}
                onEdit={() => setSelectedTemplate(template)}
                onDuplicate={() => handleDuplicate(template)}
                onDelete={() => setShowDeleteConfirm(template.id)}
                onToggleStatus={() => handleToggleStatus(template)}
              />
            ))}
          </div>
        )}

        {/* Template Detail Modal */}
        {selectedTemplate && (
          <TemplateDetailModal
            template={selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
          />
        )}

        {/* Create Template Modal */}
        {showCreateModal && (
          <CreateTemplateModal
            onClose={() => setShowCreateModal(false)}
            onCreate={(newTemplate) => {
              setTemplates([newTemplate, ...templates]);
              setShowCreateModal(false);
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <DeleteConfirmModal
            templateName={templates.find((t) => t.id === showDeleteConfirm)?.name || ''}
            onConfirm={() => handleDelete(showDeleteConfirm)}
            onCancel={() => setShowDeleteConfirm(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}

// Template Card Component
function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
}: {
  template: DocumentTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const statusInfo = statusConfig[template.status];
  const categoryColor = categoryColors[template.category] || categoryColors.General;
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
                  Edit Template
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
                  {template.status === 'active' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      Archive
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

      {/* Template Info */}
      <div className="cursor-pointer" onClick={onEdit}>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={template.icon} />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{template.name}</h3>
            <p className="text-sm text-gray-500 line-clamp-2">{template.description}</p>
          </div>
        </div>

        {/* Category */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${categoryColor}`}>
            {template.category}
          </span>
          <span className="text-xs text-gray-400">{template.fields.length} fields</span>
        </div>

        {/* Fields Preview */}
        <div className="flex flex-wrap gap-1 mb-4">
          {template.fields.slice(0, 4).map((field) => {
            const fieldConfig = fieldTypeConfig[field.type];
            return (
              <span
                key={field.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-xs text-gray-600"
                title={field.name}
              >
                <svg className={`w-3 h-3 ${fieldConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={fieldConfig.icon} />
                </svg>
                <span className="truncate max-w-[80px]">{field.name}</span>
                {field.required && <span className="text-red-400">*</span>}
              </span>
            );
          })}
          {template.fields.length > 4 && (
            <span className="text-xs text-gray-400 px-2 py-1">+{template.fields.length - 4} more</span>
          )}
        </div>

        {/* Footer Stats */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {template.usage_count.toLocaleString()} uses
          </div>
          <span className="text-xs text-gray-400">
            Updated {new Date(template.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </Card>
  );
}

// Template List Item Component
function TemplateListItem({
  template,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
}: {
  template: DocumentTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const statusInfo = statusConfig[template.status];
  const categoryColor = categoryColors[template.category] || categoryColors.General;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={template.icon} />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onEdit}>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${categoryColor}`}>
              {template.category}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">{template.description}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
              {statusInfo.label}
            </span>
            <span className="text-xs text-gray-500">{template.fields.length} fields</span>
            <span className="text-xs text-gray-500">{template.usage_count.toLocaleString()} uses</span>
            <span className="text-xs text-gray-400">
              Updated {new Date(template.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
        </div>
      </div>
    </Card>
  );
}

// Template Detail Modal
function TemplateDetailModal({
  template,
  onClose,
}: {
  template: DocumentTemplate;
  onClose: () => void;
}) {
  const statusInfo = statusConfig[template.status];
  const categoryColor = categoryColors[template.category] || categoryColors.General;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={template.icon} />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{template.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${categoryColor}`}>
                  {template.category}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className="text-gray-600 mb-6">{template.description}</p>

          <h3 className="font-semibold text-gray-900 mb-4">Form Fields ({template.fields.length})</h3>
          <div className="space-y-3">
            {template.fields.map((field, index) => {
              const fieldConfig = fieldTypeConfig[field.type];
              return (
                <div key={field.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                    {index + 1}
                  </span>
                  <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center`}>
                    <svg className={`w-4 h-4 ${fieldConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={fieldConfig.icon} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{field.name}</span>
                      {field.required && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-600">Required</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{fieldConfig.label}</span>
                  </div>
                  {field.options && (
                    <div className="text-xs text-gray-400">
                      {field.options.length} options
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Meta Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Created by</span>
                <p className="font-medium text-gray-900">{template.created_by}</p>
              </div>
              <div>
                <span className="text-gray-500">Usage count</span>
                <p className="font-medium text-gray-900">{template.usage_count.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-gray-500">Created</span>
                <p className="font-medium text-gray-900">
                  {new Date(template.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Last updated</span>
                <p className="font-medium text-gray-900">
                  {new Date(template.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary">
            Edit Template
          </Button>
        </div>
      </div>
    </div>
  );
}

// Create Template Modal
function CreateTemplateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (template: DocumentTemplate) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');

  const handleCreate = () => {
    const newTemplate: DocumentTemplate = {
      id: `tpl-${Date.now()}`,
      name: name || 'Untitled Template',
      description: description || 'No description',
      category,
      status: 'draft',
      fields: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'Current User',
      usage_count: 0,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    };
    onCreate(newTemplate);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Template</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Purchase Request"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this template is for..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
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
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate}>
            Create Template
          </Button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  templateName,
  onConfirm,
  onCancel,
}: {
  templateName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Template</h3>
        <p className="text-gray-500 text-center mb-6">
          Are you sure you want to delete "<span className="font-medium">{templateName}</span>"? This action cannot be undone.
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} className="flex-1">
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
