import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';
import { useToast } from '../../../components/ui/ToastProvider';

export default function NewCapexRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessUnits, setBusinessUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [users, setUsers] = useState<Array<{ id: string; display_name: string; email: string; job_title?: string }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [approverSearch, setApproverSearch] = useState('');
  const [showApproverDropdown, setShowApproverDropdown] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<File[]>([]);
  const [documentJustification, setDocumentJustification] = useState('');

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
    priority: '', // urgency/priority level
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setUploadedDocuments(prev => [...prev, ...newFiles].slice(0, 3));
    }
  };

  const handleRemoveDocument = (index: number) => {
    setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
  };

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

  useEffect(() => {
    const fetchBusinessUnits = async () => {
      try {
        const response = await fetch('/api/business-units');
        if (response.ok) {
          const data = await response.json();
          setBusinessUnits(data.businessUnits || []);
        }
      } catch (err) {
        console.error('Failed to fetch business units:', err);
      } finally {
        setLoadingUnits(false);
      }
    };

    const fetchDepartments = async () => {
      try {
        const response = await fetch('/api/departments');
        if (response.ok) {
          const data = await response.json();
          setDepartments(data.departments || []);
        }
      } catch (err) {
        console.error('Failed to fetch departments:', err);
      } finally {
        setLoadingDepartments(false);
      }
    };

    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (status === 'authenticated') {
      fetchBusinessUnits();
      fetchDepartments();
      fetchUsers();
    }
  }, [status]);

  const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
    e.preventDefault();

    if (isDraft) {
      setSavingDraft(true);
    } else {
      setLoading(true);
    }
    setError(null);

    // Only validate documents for submission, not for drafts
    if (!isDraft && uploadedDocuments.length < 3 && !documentJustification.trim()) {
      setError('Please provide a justification for uploading less than 3 documents.');
      setLoading(false);
      return;
    }

    try {
      // First, create the request to get the request ID
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `CAPEX: ${formData.projectName}`,
          description: formData.description,
          priority: formData.priority || 'medium',
          requestType: 'capex',
          status: isDraft ? 'draft' : 'pending',
          metadata: {
            requester: formData.requester,
            unit: formData.unit,
            department: formData.department,
            projectName: formData.projectName,
            budgetType: formData.budgetType,
            amount: formData.amount,
            currency: formData.currency,
            justification: formData.justification,
            paybackPeriod: formData.paybackPeriod,
            npv: formData.npv,
            irr: formData.irr,
            fundingSource: formData.fundingSource,
            startDate: formData.startDate,
            endDate: formData.endDate,
            priority: formData.priority,
            approvers: selectedApprovers,
            documents: uploadedDocuments.map(file => ({
              name: file.name,
              size: file.size,
              type: file.type,
            })),
            documentJustification: documentJustification || null,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isDraft ? 'save draft' : 'create CAPEX request'}`);
      }

      const requestId = data.request?.id;

      // Upload documents to the quotations bucket if we have any
      if (requestId && uploadedDocuments.length > 0) {
        for (const file of uploadedDocuments) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', file);

          try {
            const uploadResponse = await fetch(`/api/requests/${requestId}/documents`, {
              method: 'POST',
              body: uploadFormData,
            });

            if (!uploadResponse.ok) {
              console.error(`Failed to upload document: ${file.name}`);
            }
          } catch (uploadErr) {
            console.error(`Error uploading document ${file.name}:`, uploadErr);
          }
        }
      }

      // Show success toast
      if (isDraft) {
        addToast({
          type: 'success',
          title: 'Draft Saved',
          message: 'Your CAPEX request has been saved as a draft.',
        });
      } else {
        addToast({
          type: 'success',
          title: 'Request Submitted',
          message: 'Your CAPEX request has been submitted for approval.',
        });
      }

      router.push('/requests/my-requests');
    } catch (err: any) {
      setError(err.message || `Failed to ${isDraft ? 'save draft' : 'create CAPEX request'}`);
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

  const handleAddApprover = (userId: string) => {
    if (!selectedApprovers.includes(userId)) {
      setSelectedApprovers(prev => [...prev, userId]);
    }
    setApproverSearch('');
    setShowApproverDropdown(false);
  };

  const handleRemoveApprover = (userId: string) => {
    setSelectedApprovers(prev => prev.filter(id => id !== userId));
  };

  const filteredUsers = users.filter(user => 
    !selectedApprovers.includes(user.id) &&
    (user.display_name?.toLowerCase().includes(approverSearch.toLowerCase()) ||
     user.email?.toLowerCase().includes(approverSearch.toLowerCase()))
  );

  const handleApproverMove = (index: number, direction: 'up' | 'down') => {
    const newApprovers = [...selectedApprovers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newApprovers.length) {
      [newApprovers[index], newApprovers[targetIndex]] = [newApprovers[targetIndex], newApprovers[index]];
      setSelectedApprovers(newApprovers);
    }
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Unit
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                required
                disabled={loadingUnits}
              >
                <option value="">{loadingUnits ? 'Loading...' : 'Select business unit'}</option>
                {businessUnits.map((unit) => (
                  <option key={unit.id} value={unit.name}>{unit.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
                disabled={loadingDepartments}
              >
                <option value="">{loadingDepartments ? 'Loading...' : 'Select department'}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority / Urgency Level
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                required
              >
                <option value="">Select priority</option>
                <option value="low">Low - Can wait</option>
                <option value="medium">Medium - Standard timeline</option>
                <option value="high">High - Urgent</option>
                <option value="critical">Critical - Immediate attention</option>
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
                placeholder="Explain the business, expected benefits and why you chose the quotation you chose..."
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
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{formData.currency === 'ZIG' ? 'ZiG' : '$'}</span>
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
                <option value="ZIG">ZIG</option>
              </select>
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
            <span className="ml-auto text-sm font-normal text-gray-500">({uploadedDocuments.length}/3 required)</span>
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-medium text-danger-600">Required:</span> Please upload 3 supporting documents (quotations, specifications, etc.)
          </p>
          
          <input
            type="file"
            id="document-upload"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleFileUpload}
            disabled={uploadedDocuments.length >= 3}
          />
          
          <label
            htmlFor="document-upload"
            className={`block border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group ${
              uploadedDocuments.length >= 3
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/20'
            }`}
          >
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-white group-hover:shadow-sm">
              <svg className="w-6 h-6 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm text-gray-700 font-medium">
              {uploadedDocuments.length >= 3 ? 'Maximum documents uploaded' : 'Click to upload documents or drag and drop'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, or Images up to 10MB</p>
          </label>

          {/* Uploaded Documents List */}
          {uploadedDocuments.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Uploaded Documents:</h4>
              {uploadedDocuments.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveDocument(index)}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-danger-50 text-gray-400 hover:text-danger-500 transition-colors"
                    title="Remove document"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Justification for less than 3 documents */}
          {uploadedDocuments.length < 3 && (
            <div className="mt-4 p-4 bg-warning-50 border border-warning-200 rounded-xl">
              <div className="flex items-start gap-2 mb-2">
                <svg className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-warning-800">Justification Required</h4>
                  <p className="text-xs text-warning-700 mt-1">You have uploaded {uploadedDocuments.length} document(s). Please explain why you cannot provide all 3 required documents.</p>
                </div>
              </div>
              <textarea
                className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-warning-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-warning-500 focus:border-transparent resize-none transition-all mt-2"
                placeholder="Explain why you are submitting less than 3 documents..."
                value={documentJustification}
                onChange={(e) => setDocumentJustification(e.target.value)}
                required={uploadedDocuments.length < 3}
              />
            </div>
          )}
        </Card>

        {/* Capex Workflow Section */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Select Approvers
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            Choose users who will approve this capex request. You can reorder them by using the arrow buttons.
          </p>

          {/* Search and Add Approvers */}
          <div className="mb-6 relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Users</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Search by name or email..."
                value={approverSearch}
                onChange={(e) => {
                  setApproverSearch(e.target.value);
                  setShowApproverDropdown(true);
                }}
                onFocus={() => setShowApproverDropdown(true)}
              />
            </div>
            
            {/* Dropdown Results */}
            {showApproverDropdown && approverSearch && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No users found
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleAddApprover(user.id)}
                      className="w-full px-4 py-3 text-left hover:bg-primary-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-primary-600">
                          {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.display_name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Click outside to close dropdown */}
          {showApproverDropdown && (
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowApproverDropdown(false)}
            />
          )}

          {/* Selected Approvers Order */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Approval Order {selectedApprovers.length > 0 && `(${selectedApprovers.length})`}
            </h4>
            {selectedApprovers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm">No approvers selected</p>
                <p className="text-xs text-gray-400 mt-1">Search and add users above</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-100" />
                <div className="space-y-3">
                  {selectedApprovers.map((userId, index) => {
                    const user = users.find(u => u.id === userId);
                    if (!user) return null;
                    return (
                      <div key={userId} className="relative flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-primary-50 border-primary-200 text-primary-600 z-10 flex-shrink-0">
                          <span className="font-bold text-sm">{index + 1}</span>
                        </div>
                        <div className="flex-1 bg-white border border-gray-100 p-3 rounded-xl shadow-sm flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-text-primary text-sm truncate">{user.display_name}</h4>
                            <p className="text-xs text-text-secondary truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApproverMove(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move up"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproverMove(index, 'down')}
                            disabled={index === selectedApprovers.length - 1}
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move down"
                          >
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveApprover(userId)}
                            className="p-1.5 rounded-lg hover:bg-danger-50 text-gray-400 hover:text-danger-500 transition-colors"
                            title="Remove"
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
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64 z-20">
          <div className="flex gap-3 max-w-5xl mx-auto">
            <Button
              type="button"
              variant="secondary"
              className="flex-shrink-0"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={(e) => handleSubmit(e, true)}
              isLoading={savingDraft}
              disabled={!formData.projectName || savingDraft || loading}
            >
              Save as Draft
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={loading}
              disabled={
                !formData.projectName || 
                !formData.amount || 
                !formData.budgetType ||
                !formData.priority ||
                (uploadedDocuments.length < 3 && !documentJustification.trim()) ||
                savingDraft
              }
            >
              Submit for Approval
            </Button>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
