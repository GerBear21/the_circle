import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';

export default function NewCapexRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
    justification: '',
    amount: '',
    currency: 'USD',
    category: '',
    expectedROI: '',
    paybackPeriod: '',
    startDate: '',
    endDate: '',
    department: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/requests');
    } catch (err: any) {
      setError(err.message || 'Failed to create CAPEX request');
    } finally {
      setLoading(false);
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
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto pb-28">
        <div className="mb-2">
          <h1 className="text-xl font-bold text-text-primary font-heading">Capital Expenditure Request</h1>
          <p className="text-sm text-text-secondary mt-1">Submit a request for capital investment approval</p>
        </div>

        {error && (
          <Card className="bg-danger-50 border-danger-200">
            <p className="text-danger-600 text-sm">{error}</p>
          </Card>
        )}

        {/* Project Information */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Project Information
          </h3>
          <div className="space-y-4">
            <Input
              label="Project Name"
              placeholder="Enter project name"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Description
              </label>
              <textarea
                className="w-full px-4 py-3 min-h-[100px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Describe the project in detail..."
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
                className="w-full px-4 py-3 min-h-[100px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Explain why this investment is necessary..."
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                required
              />
            </div>
          </div>
        </Card>

        {/* Financial Details */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Financial Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requested Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  className="w-full pl-8 pr-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="ZAR">ZAR - South African Rand</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              >
                <option value="">Select category</option>
                <option value="equipment">Equipment</option>
                <option value="software">Software</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="vehicles">Vehicles</option>
                <option value="property">Property</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              </select>
            </div>
          </div>
        </Card>

        {/* ROI & Timeline */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            ROI & Timeline
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected ROI (%)
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g., 25%"
                value={formData.expectedROI}
                onChange={(e) => setFormData({ ...formData, expectedROI: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payback Period
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={formData.paybackPeriod}
                onChange={(e) => setFormData({ ...formData, paybackPeriod: e.target.value })}
              >
                <option value="">Select period</option>
                <option value="6months">Less than 6 months</option>
                <option value="1year">6-12 months</option>
                <option value="2years">1-2 years</option>
                <option value="3years">2-3 years</option>
                <option value="5years">3-5 years</option>
                <option value="5plus">More than 5 years</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Start Date
              </label>
              <input
                type="date"
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Completion
              </label>
              <input
                type="date"
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Attachments */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Supporting Documents
          </h3>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-warning-300 hover:bg-warning-50/30 transition-colors cursor-pointer">
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600 font-medium">Upload supporting documents</p>
            <p className="text-xs text-gray-400 mt-1">Quotes, specifications, business cases (PDF, DOC, XLS)</p>
          </div>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={loading}
              disabled={!formData.projectName || !formData.amount || !formData.category}
            >
              Submit CAPEX Request
            </Button>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
