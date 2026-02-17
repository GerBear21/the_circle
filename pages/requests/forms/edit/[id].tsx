import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../../components/layout';
import { Card, Button, Modal } from '../../../../components/ui';

export default function EditFormTemplate() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [auditLog, setAuditLog] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  // Fetch template data
  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    
    const fetchTemplate = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/form-templates/${id}`);
        if (!res.ok) throw new Error('Failed to load form template');
        
        const data = await res.json();
        
        // Check if it's a custom form (not built-in)
        if (data.template.created_by) {
          setTemplate(data.template);
          
          // Fetch audit log
          const auditRes = await fetch(`/api/form-templates/${id}/audit-log`);
          if (auditRes.ok) {
            const auditData = await auditRes.json();
            setAuditLog(auditData.logs || []);
          }
        } else {
          setError('Built-in forms cannot be edited. Only custom forms can be modified.');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [id]);

  const handleEdit = () => {
    setShowReasonModal(true);
  };

  const proceedToEdit = () => {
    if (!editReason.trim()) {
      alert('Please provide a reason for editing this form');
      return;
    }
    
    // Navigate to form builder with edit mode and reason
    router.push({
      pathname: '/requests/new/form',
      query: { 
        edit: id,
        reason: editReason
      }
    });
  };

  if (status === 'loading' || loading) {
    return (
      <AppLayout title="Loading...">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Error" showBack onBack={() => router.back()}>
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <Card className="bg-danger-50 border-danger-200 text-center py-12">
            <svg className="w-16 h-16 mx-auto text-danger-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-lg font-bold text-danger-700 mb-2">Cannot Edit Form</h2>
            <p className="text-danger-600 mb-4">{error}</p>
            <Button variant="secondary" onClick={() => router.push('/requests/forms')}>
              Back to Forms
            </Button>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!template) return null;

  return (
    <AppLayout title={`Edit: ${template.name}`} showBack onBack={() => router.back()}>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {/* Form Info Card */}
        <Card className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={template.icon} />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
                <p className="text-gray-500 mt-1">{template.description || 'No description'}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-gray-400">
                    Created by: <span className="font-medium text-gray-600">{template.creator?.display_name || 'Unknown'}</span>
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-400">
                    {new Date(template.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="primary" onClick={handleEdit}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Form
            </Button>
          </div>

          {/* Last Edit Info */}
          {template.last_edited_by && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Last edited by:</span> {template.last_editor?.display_name || 'Unknown'}
                {' • '}
                {new Date(template.last_edited_at).toLocaleString()}
              </p>
              {template.edit_reason && (
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium">Reason:</span> {template.edit_reason}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Audit Trail */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Change History
          </h2>

          {auditLog.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No edit history available</p>
          ) : (
            <div className="space-y-3">
              {auditLog.map((log, index) => (
                <div key={log.id} className="flex gap-4 pb-3 border-b border-gray-100 last:border-0">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary-500" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {log.change_type === 'created' ? 'Form Created' : 'Form Updated'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          by {log.editor?.display_name || 'Unknown'} • {new Date(log.edited_at).toLocaleString()}
                        </p>
                      </div>
                      {log.change_type === 'updated' && log.changes_made && (
                        <div className="flex flex-wrap gap-1">
                          {log.changes_made.name_changed && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-medium rounded">Name</span>
                          )}
                          {log.changes_made.fields_changed && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-medium rounded">Fields</span>
                          )}
                          {log.changes_made.workflow_changed && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-medium rounded">Workflow</span>
                          )}
                        </div>
                      )}
                    </div>
                    {log.edit_reason && (
                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 px-2 py-1 rounded">
                        <span className="font-medium">Reason:</span> {log.edit_reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Edit Reason Modal */}
      {showReasonModal && (
        <Modal
          isOpen={showReasonModal}
          onClose={() => setShowReasonModal(false)}
          title="Provide Edit Reason"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Please provide a reason for editing this form. This will be recorded in the audit trail.
            </p>
            <textarea
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
              placeholder="e.g., Updated approval workflow, Added new required fields, Fixed typo in field label..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowReasonModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={proceedToEdit}>
                Continue to Edit
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
