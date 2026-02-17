import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';
import { useUserContext } from '../../../contexts/UserContext';
import { useHrimsDepartments, useHrimsBusinessUnits } from '../../../hooks/useHrimsOrganogram';

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  category: string | null;
  icon: string;
  color: string;
  requestor_fields: string[];
  form_fields: any[];
  workflow_definition_id: string | null;
  workflow_mode?: string;
  signatory_email?: string | null;
  signatory_name?: string | null;
  inline_workflow_steps: any[] | null;
  inline_workflow_settings: any | null;
  creator?: { display_name: string; email: string };
}

const REQUESTOR_FIELD_LABELS: Record<string, string> = {
  full_name: 'Full Name',
  email: 'Email Address',
  department: 'Department',
  business_unit: 'Business Unit',
  job_title: 'Job Title',
  employee_id: 'Employee ID',
  phone: 'Phone Number',
  date: 'Request Date',
};

export default function FormTemplateFillPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUserContext();
  const { departments } = useHrimsDepartments();
  const { businessUnits } = useHrimsBusinessUnits();

  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [userSignature, setUserSignature] = useState<string | null>(null);

  // Form data state
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  // Fetch template
  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    fetch(`/api/form-templates/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Form template not found');
        return res.json();
      })
      .then(data => {
        setTemplate(data.template);
        // Initialize form data with defaults
        const initial: Record<string, any> = {};
        (data.template.form_fields || []).forEach((f: any) => {
          if (f.type === 'checkbox') {
            initial[f.id] = false;
          } else if (f.type === 'multiselect') {
            initial[f.id] = [];
          } else {
            initial[f.id] = f.defaultValue || '';
          }
        });
        // Auto-fill requestor fields from user context and HRIMS
        if (user) {
          initial['__full_name'] = user.display_name || '';
          initial['__email'] = user.email || '';
          initial['__job_title'] = user.job_title || '';
          initial['__employee_id'] = user.hrims_employee_id || '';
          initial['__phone'] = '';
          initial['__date'] = new Date().toISOString().split('T')[0];
          
          // Look up department name from HRIMS
          if (user.department_id && departments.length > 0) {
            const dept = departments.find(d => d.id === user.department_id);
            initial['__department'] = dept?.name || '';
          }
          
          // Look up business unit name from HRIMS
          if (user.business_unit_id && businessUnits.length > 0) {
            const bu = businessUnits.find(b => b.id === user.business_unit_id);
            initial['__business_unit'] = bu?.name || '';
          }
        }
        setFormData(initial);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, user, departments, businessUnits]);

  // Fetch user's signature if they have one
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/user/signature`)
      .then(res => res.json())
      .then(data => {
        if (data.signature_url) {
          setUserSignature(data.signature_url);
        }
      })
      .catch(err => console.error('Failed to fetch signature:', err));
  }, [user]);

  const updateField = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    if (!template) return;

    // Validate required fields
    for (const field of template.form_fields) {
      if (field.required && !formData[field.id]) {
        setError(`"${field.label}" is required`);
        return;
      }
    }

    // Check workflow configuration based on workflow mode
    const workflowMode = template.workflow_mode || 'select';
    
    // For self_sign mode, show signature confirmation modal
    if (workflowMode === 'self_sign') {
      if (!userSignature) {
        setError('You need to set up your signature in your profile before you can sign forms.');
        return;
      }
      setShowSignatureModal(true);
      return;
    }
    
    // Only require workflow for 'select' and 'create' modes
    if (['select', 'create'].includes(workflowMode)) {
      if (!template.workflow_definition_id && !template.inline_workflow_steps) {
        setError('This form template does not have a workflow configured. Please contact an administrator to set up the approval workflow for this form.');
        return;
      }
    }
    
    // For 'none' mode, no workflow is needed
    // For 'individual_signatory' mode, it goes to the specified signatory

    await submitForm();
  };

  const submitForm = async () => {
    if (!template) return;

    setSubmitting(true);
    setError(null);
    setShowSignatureModal(false);

    try {
      // Build the request payload
      const requestorInfo: Record<string, any> = {};
      (template.requestor_fields || []).forEach(f => {
        requestorInfo[f] = formData[`__${f}`] || '';
      });

      const payload = {
        templateId: template.id,
        templateName: template.name,
        requestorInfo,
        formData: Object.fromEntries(
          Object.entries(formData).filter(([k]) => !k.startsWith('__'))
        ),
        workflowDefinitionId: template.workflow_definition_id,
        inlineWorkflowSteps: template.inline_workflow_steps,
        inlineWorkflowSettings: template.inline_workflow_settings,
      };

      const workflowMode = template.workflow_mode || 'select';

      const res = await fetch('/api/requests/from-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_definition_id: template.workflow_definition_id || null,
          workflow_mode: workflowMode,
          signatory_email: template.signatory_email || null,
          signatory_name: template.signatory_name || null,
          inline_workflow_steps: template.inline_workflow_steps || null,
          inline_workflow_settings: template.inline_workflow_settings || null,
          title: `${template.name} - ${formData['__full_name'] || 'Request'}`,
          description: template.description || '',
          form_data: payload.formData,
          requestor_info: payload.requestorInfo,
          template_id: template.id,
          signature_url: workflowMode === 'self_sign' ? userSignature : null,
          submitImmediately: true, // Submit immediately for approval
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit request');
      }

      setSuccessMsg('Request submitted successfully!');
      setTimeout(() => {
        router.push('/requests/my-requests');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
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

  if (error && !template) {
    return (
      <AppLayout title="Error" showBack onBack={() => router.back()}>
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
          <Card className="bg-danger-50 border-danger-200 text-center py-12">
            <svg className="w-16 h-16 mx-auto text-danger-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-lg font-bold text-danger-700 mb-2">Form Template Not Found</h2>
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

  const renderField = (field: any) => {
    const value = formData[field.id];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );

      case 'textarea':
        return (
          <textarea
            className="w-full px-4 py-3 min-h-[100px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );

      case 'number':
      case 'currency':
        return (
          <input
            type="number"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );

      case 'time':
        return (
          <input
            type="time"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );

      case 'select':
        return (
          <select
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          >
            <option value="">{field.placeholder || 'Select...'}</option>
            {(field.options || []).map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="space-y-1.5">
            {(field.options || []).map((opt: string) => (
              <label key={opt} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(value || []).includes(opt)}
                  onChange={(e) => {
                    const current = value || [];
                    if (e.target.checked) {
                      updateField(field.id, [...current, opt]);
                    } else {
                      updateField(field.id, current.filter((v: string) => v !== opt));
                    }
                  }}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateField(field.id, e.target.checked)}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-500 w-5 h-5"
            />
            <span className="text-sm text-gray-700">{field.placeholder || 'Yes'}</span>
          </label>
        );

      case 'radio':
        return (
          <div className="space-y-1.5">
            {(field.options || []).map((opt: string) => (
              <label key={opt} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  checked={value === opt}
                  onChange={() => updateField(field.id, opt)}
                  className="border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
        );

      case 'file':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary-400 transition-colors">
            <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
            <input
              type="file"
              className="hidden"
              onChange={(e) => updateField(field.id, e.target.files?.[0]?.name || '')}
            />
          </div>
        );

      case 'signature':
        return (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <p className="text-sm text-gray-500">Signature pad (click to sign)</p>
          </div>
        );

      case 'section':
        return null; // Section headers are rendered differently

      case 'divider':
        return <hr className="border-gray-200 my-2" />;

      default:
        return (
          <input
            type="text"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={(e) => updateField(field.id, e.target.value)}
          />
        );
    }
  };

  return (
    <AppLayout title={template.name} showBack onBack={() => router.back()} hideNav>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-32 sm:pb-36">
        {/* Form Header with RTG Logo */}
        <Card className="!p-0 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 flex items-center gap-4">
            <img src="/images/RTG_LOGO.png" alt="RTG Logo" className="h-12 w-auto brightness-0 invert" />
            <div>
              <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Rainbow Tourism Group</p>
              <h1 className="text-white text-xl font-bold">{template.name}</h1>
              {template.description && (
                <p className="text-white/70 text-sm mt-0.5">{template.description}</p>
              )}
            </div>
          </div>
        </Card>

        {error && (
          <Card className="mb-4 bg-danger-50 border-danger-200">
            <div className="flex items-center justify-between">
              <p className="text-danger-600 text-sm">{error}</p>
              <button type="button" onClick={() => setError(null)} className="text-danger-400 hover:text-danger-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </Card>
        )}

        {successMsg && (
          <Card className="mb-4 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-emerald-700 font-medium">{successMsg}</p>
            </div>
          </Card>
        )}

        {/* Requestor Information */}
        {template.requestor_fields && template.requestor_fields.length > 0 && (
          <Card className="mb-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Requestor Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {template.requestor_fields.map(fieldKey => (
                <div key={fieldKey}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {REQUESTOR_FIELD_LABELS[fieldKey] || fieldKey}
                  </label>
                  <input
                    type={fieldKey === 'email' ? 'email' : fieldKey === 'date' ? 'date' : fieldKey === 'phone' ? 'tel' : 'text'}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    value={formData[`__${fieldKey}`] || ''}
                    onChange={(e) => updateField(`__${fieldKey}`, e.target.value)}
                    readOnly={fieldKey === 'full_name' || fieldKey === 'email'}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Form Fields */}
        <Card className="mb-4">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Form Details
          </h2>
          <div className="space-y-5">
            {(template.form_fields || []).map((field: any) => {
              // Divider
              if (field.type === 'divider') {
                return <hr key={field.id} className="border-gray-200 my-6" />;
              }

              // Heading
              if (field.type === 'heading') {
                const HeadingTag = (field.headingLevel || 'h2') as 'h2' | 'h3' | 'h4';
                const sizeClasses = {
                  h2: 'text-xl font-bold text-gray-900',
                  h3: 'text-lg font-semibold text-gray-800',
                  h4: 'text-base font-semibold text-gray-700'
                };
                return (
                  <HeadingTag key={field.id} className={`${sizeClasses[HeadingTag]} mt-6 mb-3`}>
                    {field.label}
                  </HeadingTag>
                );
              }

              // Section
              if (field.type === 'section') {
                return (
                  <div key={field.id} className="pt-6 pb-3 border-t-2 border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">{field.sectionHeader || field.label}</h3>
                    {field.subheading && (
                      <p className="text-sm text-gray-600 mt-1">{field.subheading}</p>
                    )}
                    {field.sectionHelperText && (
                      <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                        {field.sectionHelperText}
                      </p>
                    )}
                  </div>
                );
              }

              // Information box
              if (field.type === 'information') {
                const typeStyles = {
                  info: 'bg-blue-50 border-blue-200 text-blue-800',
                  warning: 'bg-amber-50 border-amber-200 text-amber-800',
                  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                  error: 'bg-red-50 border-red-200 text-red-800'
                };
                const iconPaths = {
                  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
                  success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
                  error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
                };
                const infoType = field.informationType || 'info';
                return (
                  <div key={field.id} className={`flex items-start gap-3 p-4 rounded-xl border ${typeStyles[infoType as keyof typeof typeStyles]}`}>
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPaths[infoType as keyof typeof iconPaths]} />
                    </svg>
                    <div className="flex-1">
                      {field.label && <p className="font-semibold mb-1">{field.label}</p>}
                      <p className="text-sm">{field.informationText || 'No information provided'}</p>
                    </div>
                  </div>
                );
              }

              // Regular input fields
              return (
                <div key={field.id} className={field.width === 'half' ? 'sm:w-1/2' : 'w-full'}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.helpText && (
                    <p className="text-xs text-gray-400 mb-1.5">{field.helpText}</p>
                  )}
                  {renderField(field)}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Submit Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-safe lg:left-64 z-20">
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
              type="button"
              variant="primary"
              className="flex-1"
              disabled={submitting || !!successMsg}
              onClick={handleSubmit}
              isLoading={submitting}
            >
              {successMsg ? 'Submitted!' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </div>

      {/* Signature Confirmation Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Sign This Form</h3>
              <p className="text-sm text-gray-600 mb-4">
                By signing, you confirm that all information provided is accurate and complete.
              </p>
            </div>

            {/* Signature Preview */}
            {userSignature && (
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Your Signature</p>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <img 
                    src={userSignature} 
                    alt="Your signature" 
                    className="max-h-20 mx-auto"
                  />
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <div className="flex gap-2">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-amber-800">
                  This action cannot be undone. Once signed, the form will be submitted and archived.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowSignatureModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={submitForm}
                disabled={submitting}
                isLoading={submitting}
              >
                Sign & Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
