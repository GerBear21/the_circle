import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';

interface User {
  id: string;
  display_name: string;
  email: string;
  role?: string;
}

export default function NewCapexRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [formData, setFormData] = useState({
    requester: session?.user?.name || '',
    unit: '',
    department: '',
    projectName: '',
    description: '',
    budgetType: '', // budget, non-budget, emergency
    amount: '', // project cost
    currency: 'USD',
    justification: '',
    paybackPeriod: '',
    npv: '',
    irr: '',
    fundingSource: '',
    category: '', // kept for consistency if needed, but not explicitly asked for in new list. Will keep as it's useful.
    startDate: '', // kept
    endDate: '', // kept
  });

  // Pre-fill requester when session loads
  useEffect(() => {
    if (session?.user?.name && !formData.requester) {
      setFormData(prev => ({ ...prev, requester: session.user.name || '' }));
    }
  }, [session]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  // Fetch users for approver selection
  useEffect(() => {
    async function fetchUsers() {
      if (status !== 'authenticated') return;
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, [status]);

  const toggleApprover = (userId: string) => {
    setSelectedApprovers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const moveApprover = (index: number, direction: 'up' | 'down') => {
    const newApprovers = [...selectedApprovers];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newApprovers.length) return;
    [newApprovers[index], newApprovers[newIndex]] = [newApprovers[newIndex], newApprovers[index]];
    setSelectedApprovers(newApprovers);
  };

  const handleSubmit = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();
    
    if (!asDraft && selectedApprovers.length === 0) {
      setError('Please select at least one approver before submitting');
      return;
    }

    if (asDraft) {
      setSavingDraft(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `CAPEX: ${formData.projectName}`,
          description: formData.description,
          priority: 'high',
          category: 'capex',
          requestType: 'capex',
          status: asDraft ? 'draft' : 'pending',
          metadata: {
            requester: formData.requester,
            unit: formData.unit,
            department: formData.department,
            projectName: formData.projectName,
            budgetType: formData.budgetType,
            amount: parseFloat(formData.amount.replace(/,/g, '')) || 0,
            currency: formData.currency,
            justification: formData.justification,
            paybackPeriod: formData.paybackPeriod,
            npv: formData.npv,
            irr: formData.irr,
            fundingSource: formData.fundingSource,
            startDate: formData.startDate,
            endDate: formData.endDate,
            approvers: selectedApprovers,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create CAPEX request');
      }

      // If not a draft, also create request_steps and publish
      if (!asDraft && data.request?.id) {
        const publishResponse = await fetch(`/api/requests/${data.request.id}/publish`, {
          method: 'POST',
        });
        if (!publishResponse.ok) {
          const publishData = await publishResponse.json();
          throw new Error(publishData.error || 'Failed to publish request');
        }
      }

      router.push('/requests/my-requests');
    } catch (err: any) {
      setError(err.message || 'Failed to create CAPEX request');
    } finally {
      setLoading(false);
      setSavingDraft(false);
    }
  };

  const formatCurrency = (value: string) => {
    const num = value.replace(/[^0-9.]/g, '');
    if (!num) return '';
    return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  if (status === 'loading') {
    return (
      <AppLayout title="CAPEX Request" showBack onBack={() => router.back()}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="CAPEX Request" showBack onBack={() => router.back()} hideNav>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto pb-28">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-text-primary font-heading">New Capex Request</h1>
          <p className="text-text-secondary mt-1">Submit a capital expenditure request for approval</p>
        </div>

        {error && (
          <Card className="bg-danger-50 border-danger-200">
            <p className="text-danger-600 text-sm">{error}</p>
          </Card>
        )}

        {/* General Information */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            General Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Requester"
              placeholder="Requester Name"
              value={formData.requester}
              onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
              required
            />
            <Input
              label="Unit"
              placeholder="e.g. Manufacturing, Sales"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
              >
                <option value="">Select department</option>
                <option value="engineering">Engineering</option>
                <option value="marketing">Marketing</option>
                <option value="sales">Sales</option>
                <option value="operations">Operations</option>
                <option value="hr">Human Resources</option>
                <option value="finance">Finance</option>
                <option value="it">IT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget Type
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                value={formData.budgetType}
                onChange={(e) => setFormData({ ...formData, budgetType: e.target.value })}
                required
              >
                <option value="">Select type</option>
                <option value="budget">Budgeted</option>
                <option value="non-budget">Non-Budgeted</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Project Details */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Project Details
          </h3>
          <div className="space-y-4">
            <Input
              label="Project Name / Description"
              placeholder="Enter short project name"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              required
            />
            {/* Keeping separate description if they want more detail, otherwise projectName covers 'Description' requested. 
                The user asked for 'Description', so combining name/short desc into one or keeping separate. 
                I will keep a detailed description box as well. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Detailed Description
              </label>
              <textarea
                className="w-full px-4 py-3 min-h-[100px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                placeholder="Describe the project scope and details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Justification
              </label>
              <textarea
                className="w-full px-4 py-3 min-h-[100px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                placeholder="Explain the business need and expected benefits..."
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                required
              />
            </div>
          </div>
        </Card>

        {/* Financials */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Financial Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Cost
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  className="w-full pl-8 pr-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: formatCurrency(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="ZAR">ZAR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Funding Source
              </label>
              <Input
                placeholder="e.g. Operating Budget, Special Fund"
                value={formData.fundingSource}
                onChange={(e) => setFormData({ ...formData, fundingSource: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payback Period
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                value={formData.paybackPeriod}
                onChange={(e) => setFormData({ ...formData, paybackPeriod: e.target.value })}
              >
                <option value="">Select period</option>
                <option value="<6m">Less than 6 months</option>
                <option value="6-12m">6-12 months</option>
                <option value="1-2y">1-2 years</option>
                <option value="2-3y">2-3 years</option>
                <option value=">3y">More than 3 years</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NPV (Net Present Value)
              </label>
              <Input
                placeholder="e.g. 50000"
                value={formData.npv}
                onChange={(e) => setFormData({ ...formData, npv: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IRR (Internal Rate of Return)
              </label>
              <Input
                placeholder="e.g. 15%"
                value={formData.irr}
                onChange={(e) => setFormData({ ...formData, irr: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Quotations / Documents */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Quotations & Support Documents
          </h3>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-primary-300 hover:bg-primary-50/20 transition-all cursor-pointer group">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white group-hover:shadow-sm">
              <svg className="w-6 h-6 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm text-gray-700 font-medium">Click to upload quotations or drag and drop</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, or Images up to 10MB</p>
          </div>
        </Card>

        {/* Approver Selection Section */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Select Approvers
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({selectedApprovers.length} selected)
            </span>
          </h3>
          
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
              <span className="ml-2 text-gray-500">Loading users...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Available Users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Approvers
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
                  {users.filter(u => !selectedApprovers.includes(u.id)).map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleApprover(user.id)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {user.display_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.display_name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  ))}
                  {users.filter(u => !selectedApprovers.includes(u.id)).length === 0 && (
                    <p className="text-sm text-gray-500 italic col-span-2 text-center py-4">All users have been selected</p>
                  )}
                </div>
              </div>

              {/* Selected Approvers (Ordered) */}
              {selectedApprovers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approval Order (drag to reorder)
                  </label>
                  <div className="space-y-2">
                    {selectedApprovers.map((approverId, index) => {
                      const user = users.find(u => u.id === approverId);
                      if (!user) return null;
                      return (
                        <div
                          key={approverId}
                          className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-xl"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-medium text-gray-600 border border-gray-200">
                            {user.display_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.display_name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveApprover(index, 'up')}
                              disabled={index === 0}
                              className="p-1 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveApprover(index, 'down')}
                              disabled={index === selectedApprovers.length - 1}
                              className="p-1 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleApprover(approverId)}
                              className="p-1 rounded hover:bg-red-100 text-red-500"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64 z-20">
          <div className="flex gap-3 max-w-5xl mx-auto">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              isLoading={savingDraft}
              disabled={!formData.projectName || !formData.amount || loading}
              onClick={(e) => handleSubmit(e as any, true)}
            >
              Save as Draft
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={loading}
              disabled={!formData.projectName || !formData.amount || !formData.budgetType || selectedApprovers.length === 0 || savingDraft}
            >
              Submit for Approval
            </Button>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
