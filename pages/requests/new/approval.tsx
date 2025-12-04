import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

export default function NewApprovalRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'normal',
    category: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSupabaseConfigured) {
      setError('Database not configured. Please contact your administrator.');
      return;
    }

    const user = session?.user as any;
    if (!user?.id || !user?.org_id) {
      setError('User session not found');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('requests')
        .insert({
          organization_id: user.org_id,
          creator_id: user.id,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          category: formData.category,
          status: 'draft',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      router.push(`/requests/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <AppLayout title="New Approval Request" showBack onBack={() => router.back()}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title="New Approval Request" showBack onBack={() => router.back()} hideNav>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-w-3xl mx-auto pb-28">
        <div className="mb-2">
          <h1 className="text-xl font-bold text-text-primary font-heading">Create Approval Request</h1>
          <p className="text-sm text-text-secondary mt-1">Fill in the details below to submit your request</p>
        </div>

        {error && (
          <Card className="bg-danger-50 border-danger-200">
            <p className="text-danger-600 text-sm">{error}</p>
          </Card>
        )}

        <Card>
          <div className="space-y-4">
            <Input
              label="Title"
              placeholder="Enter request title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-4 py-3 min-h-[120px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Describe your request in detail..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
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
                >
                  <option value="">Select category</option>
                  <option value="budget">Budget</option>
                  <option value="leave">Leave</option>
                  <option value="purchase">Purchase</option>
                  <option value="travel">Travel</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="font-medium text-gray-900 mb-3">Attachments</h3>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary-300 hover:bg-primary-50/30 transition-colors cursor-pointer">
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600 font-medium">Click to upload files</p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOC, images up to 10MB</p>
          </div>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64">
          <div className="flex gap-3 max-w-3xl mx-auto">
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
              disabled={!formData.title}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
