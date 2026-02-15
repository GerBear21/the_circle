import { useCurrentUser } from '../../../hooks/useCurrentUser';
import { useUserHrimsProfile } from '../../../hooks/useUserHrimsProfile';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/layout';
import { Card, Button, Input } from '../../../components/ui';
import { useToast } from '../../../components/ui/ToastProvider';

interface DocumentMetadata {
  file: File;
  description: string;
  supplierName: string;
  isSelectedSupplier: boolean;
  selectionReason: string;
}

export default function NewCapexRequestPage() {
  const { data: session, status } = useSession();
  const { user } = useCurrentUser();
  const { departmentName, businessUnitName } = useUserHrimsProfile();
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
  
  // Fixed approver roles in order (CAPEX approval chain)
  const approvalRoles = [
    { key: 'finance_manager', label: 'Finance Manager / Accountant', description: 'Financial Review' },
    { key: 'general_manager', label: 'General Manager (Unit)', description: 'Unit Approval' },
    { key: 'procurement_manager', label: 'Procurement Manager', description: 'Procurement Review' },
    { key: 'corporate_hod', label: 'Corporate Head of Dept', description: 'Department Approval' },
    { key: 'projects_manager', label: 'Projects Manager', description: 'Projects Review' },
    { key: 'managing_director', label: 'Managing Director', description: 'Operations Approval' },
    { key: 'finance_director', label: 'Finance Director', description: 'Final Financial Approval' },
    { key: 'ceo', label: 'Chief Executive', description: 'Final Authorization' },
  ];
  const [selectedApprovers, setSelectedApprovers] = useState<Record<string, string>>({
    finance_manager: '',
    general_manager: '',
    procurement_manager: '',
    corporate_hod: '',
    projects_manager: '',
    managing_director: '',
    finance_director: '',
    ceo: '',
  });
  const [approverSearch, setApproverSearch] = useState<Record<string, string>>({
    finance_manager: '',
    general_manager: '',
    procurement_manager: '',
    corporate_hod: '',
    projects_manager: '',
    managing_director: '',
    finance_director: '',
    ceo: '',
  });
  const [showApproverDropdown, setShowApproverDropdown] = useState<string | null>(null);
  const [useParallelApprovals, setUseParallelApprovals] = useState(false);
  const [selectedWatchers, setSelectedWatchers] = useState<Array<{ id: string; addedBy?: { id: string; name: string; isApprover: boolean }; addedAt?: string }>>([]);
  const [watcherSearch, setWatcherSearch] = useState('');
  const [showWatcherDropdown, setShowWatcherDropdown] = useState(false);
  const [quotationDocuments, setQuotationDocuments] = useState<DocumentMetadata[]>([]);
  const [quotationJustification, setQuotationJustification] = useState('');
  const [supportingDocuments, setSupportingDocuments] = useState<DocumentMetadata[]>([]);

  // Edit mode state
  const { edit: editRequestId, approver: isApproverEdit } = router.query;
  const isEditMode = !!editRequestId;
  const isApproverEditing = isApproverEdit === 'true';
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [originalFormData, setOriginalFormData] = useState<any>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string>('draft');
  const [originalWatchers, setOriginalWatchers] = useState<Array<{ id: string; addedBy?: { id: string; name: string; isApprover: boolean }; addedAt?: string }>>([]);
  const [existingQuotations, setExistingQuotations] = useState<any[]>([]);
  const [existingSupportingDocs, setExistingSupportingDocs] = useState<any[]>([]);

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
    evaluation: '',
    category: '', // kept for consistency if needed, but not explicitly asked for in new list. Will keep as it's useful.
    startDate: '', // kept
    endDate: '', // kept
    priority: '', // urgency/priority level
  });

  const handleQuotationUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newDocs: DocumentMetadata[] = Array.from(files).map(file => ({
        file,
        description: '',
        supplierName: '',
        isSelectedSupplier: false,
        selectionReason: '',
      }));
      setQuotationDocuments(prev => [...prev, ...newDocs].slice(0, 3));
    }
  };

  const handleRemoveQuotation = (index: number) => {
    setQuotationDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSupportingDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newDocs: DocumentMetadata[] = Array.from(files).map(file => ({
        file,
        description: '',
        supplierName: '',
        isSelectedSupplier: false,
        selectionReason: '',
      }));
      setSupportingDocuments(prev => [...prev, ...newDocs]);
    }
  };

  const handleRemoveSupportingDoc = (index: number) => {
    setSupportingDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddWatcher = (userId: string) => {
    if (!selectedWatchers.find(w => w.id === userId)) {
      const newWatcher = {
        id: userId,
        addedBy: isApproverEditing ? {
          id: user?.id || session?.user?.id || '',
          name: user?.display_name || session?.user?.name || 'Unknown',
          isApprover: true,
        } : undefined,
        addedAt: isApproverEditing ? new Date().toISOString() : undefined,
      };
      setSelectedWatchers(prev => [...prev, newWatcher]);
    }
    setWatcherSearch('');
    setShowWatcherDropdown(false);
  };

  const handleRemoveWatcher = (watcherId: string) => {
    // Approvers can only remove watchers they added
    if (isApproverEditing) {
      const watcher = selectedWatchers.find(w => w.id === watcherId);
      if (watcher && watcher.addedBy?.id !== (user?.id || session?.user?.id)) {
        return; // Can't remove watchers added by others
      }
    }
    setSelectedWatchers(prev => prev.filter(w => w.id !== watcherId));
  };

  const filteredWatchers = users.filter(u =>
    !selectedWatchers.find(w => w.id === u.id) &&
    (u.display_name?.toLowerCase().includes(watcherSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(watcherSearch.toLowerCase()))
  );

  const handleUpdateQuotationMetadata = (index: number, field: keyof DocumentMetadata, value: string | boolean) => {
    setQuotationDocuments(prev => prev.map((doc, i) => {
      if (i === index) {
        const updated = { ...doc, [field]: value };
        if (field === 'isSelectedSupplier' && value === true) {
          return { ...prev.map((d, j) => j === i ? updated : { ...d, isSelectedSupplier: false })[i] };
        }
        return updated;
      }
      if (field === 'isSelectedSupplier' && value === true) {
        return { ...doc, isSelectedSupplier: false, selectionReason: '' };
      }
      return doc;
    }));
  };

  const handleUpdateSupportingDocMetadata = (index: number, field: keyof DocumentMetadata, value: string | boolean) => {
    setSupportingDocuments(prev => prev.map((doc, i) => {
      if (i === index) {
        return { ...doc, [field]: value };
      }
      return doc;
    }));
  };

  // Fetch existing request data when in edit mode
  useEffect(() => {
    const fetchExistingRequest = async () => {
      if (!editRequestId || typeof editRequestId !== 'string') return;
      
      setLoadingRequest(true);
      try {
        const response = await fetch(`/api/requests/${editRequestId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch request');
        }
        const data = await response.json();
        const request = data.request;
        const metadata = request.metadata || {};
        const capexData = metadata.capex || metadata;

        // Store request status
        setRequestStatus(request.status || 'draft');

        // Store original data for comparison (for modification tracking)
        setOriginalFormData({
          requester: capexData.requester || metadata.requester || '',
          unit: capexData.unit || metadata.unit || '',
          department: capexData.department || metadata.department || '',
          projectName: capexData.projectName || metadata.projectName || '',
          description: capexData.description || request.description || '',
          budgetType: capexData.budgetType || metadata.budgetType || '',
          amount: capexData.amount || metadata.amount || '',
          currency: capexData.currency || metadata.currency || 'USD',
          justification: capexData.justification || metadata.justification || '',
          paybackPeriod: capexData.paybackPeriod || metadata.paybackPeriod || '',
          npv: capexData.npv || metadata.npv || '',
          irr: capexData.irr || metadata.irr || '',
          fundingSource: capexData.fundingSource || metadata.fundingSource || '',
          evaluation: capexData.evaluation || metadata.evaluation || '',
          startDate: capexData.startDate || metadata.startDate || '',
          endDate: capexData.endDate || metadata.endDate || '',
          priority: capexData.priority || metadata.priority || '',
        });

        // Pre-fill form with existing data
        setFormData({
          requester: capexData.requester || metadata.requester || '',
          unit: capexData.unit || metadata.unit || '',
          department: capexData.department || metadata.department || '',
          projectName: capexData.projectName || metadata.projectName || '',
          description: capexData.description || request.description || '',
          budgetType: capexData.budgetType || metadata.budgetType || '',
          amount: capexData.amount || metadata.amount || '',
          currency: capexData.currency || metadata.currency || 'USD',
          justification: capexData.justification || metadata.justification || '',
          paybackPeriod: capexData.paybackPeriod || metadata.paybackPeriod || '',
          npv: capexData.npv || metadata.npv || '',
          irr: capexData.irr || metadata.irr || '',
          fundingSource: capexData.fundingSource || metadata.fundingSource || '',
          evaluation: capexData.evaluation || metadata.evaluation || '',
          category: '',
          startDate: capexData.startDate || metadata.startDate || '',
          endDate: capexData.endDate || metadata.endDate || '',
          priority: capexData.priority || metadata.priority || '',
        });

        // Set approvers and watchers
        // Handle both new format (approverRoles object) and legacy format (array)
        // Check both root level and nested capex level
        const approverRolesData = metadata.approverRoles || capexData.approverRoles;
        const approversData = metadata.approvers || capexData.approvers;
        const watchersData = metadata.watchers || capexData.watchers;
        
        if (approverRolesData && typeof approverRolesData === 'object' && !Array.isArray(approverRolesData)) {
          // New format: approverRoles is an object with role keys
          setSelectedApprovers(prev => ({ ...prev, ...approverRolesData }));
        } else if (approversData && typeof approversData === 'object' && !Array.isArray(approversData)) {
          // Fallback: approvers was saved as an object (old bug)
          setSelectedApprovers(prev => ({ ...prev, ...approversData }));
        } else if (approversData && Array.isArray(approversData)) {
          // Legacy format: convert array to role-based object (best effort mapping)
          const approverArray = approversData as string[];
          const roleKeys = ['finance_manager', 'general_manager', 'procurement_manager', 'corporate_hod', 'projects_manager', 'managing_director', 'finance_director', 'ceo'];
          const mappedApprovers: Record<string, string> = {};
          approverArray.forEach((id, index) => {
            if (index < roleKeys.length) {
              mappedApprovers[roleKeys[index]] = id;
            }
          });
          setSelectedApprovers(prev => ({ ...prev, ...mappedApprovers }));
        }
        if (watchersData && Array.isArray(watchersData)) {
          // Convert old format (string[]) to new format if needed
          const watchersWithMetadata = watchersData.map((w: any) => {
            if (typeof w === 'string') {
              return { id: w };
            }
            return w;
          });
          setSelectedWatchers(watchersWithMetadata);
          setOriginalWatchers(watchersWithMetadata);
        }

        // Store existing document metadata (we can't re-upload existing files, but show them)
        // Check both root level and nested capex level for document arrays
        const quotationsData = metadata.quotations || capexData.quotations;
        const supportingDocsData = metadata.supportingDocuments || capexData.supportingDocuments;
        const justificationData = metadata.quotationJustification || capexData.quotationJustification;
        
        if (quotationsData && Array.isArray(quotationsData)) {
          setExistingQuotations(quotationsData);
        }
        if (supportingDocsData && Array.isArray(supportingDocsData)) {
          setExistingSupportingDocs(supportingDocsData);
        }
        if (justificationData) {
          setQuotationJustification(justificationData);
        }
        
        // Also check for documents from the documents table (actual uploaded files)
        // and match them with metadata if metadata is missing
        if (request.documents && Array.isArray(request.documents) && request.documents.length > 0) {
          // If we have documents in the table but no metadata, create metadata from documents
          if (!quotationsData && !supportingDocsData) {
            // All documents without metadata categorization - show them as existing quotations
            const docsFromTable = request.documents.map((doc: any) => ({
              name: doc.filename,
              size: doc.file_size,
              type: doc.mime_type,
              description: '',
              supplierName: '',
              isSelectedSupplier: false,
              selectionReason: '',
              documentId: doc.id, // Keep reference to actual document
            }));
            setExistingQuotations(docsFromTable);
          }
        }
      } catch (err: any) {
        console.error('Error fetching request:', err);
        setError('Failed to load request data');
      } finally {
        setLoadingRequest(false);
      }
    };

    if (status === 'authenticated' && editRequestId) {
      fetchExistingRequest();
    }
  }, [editRequestId, status]);

  // Pre-fill requester, unit, and department from user profile (only for new requests)
  useEffect(() => {
    if (isEditMode) return; // Skip for edit mode
    
    if (user) {
      setFormData(prev => ({
        ...prev,
        requester: user.display_name || user.email || session?.user?.name || prev.requester,
        unit: businessUnitName || prev.unit,
        department: departmentName || prev.department,
      }));
    } else if (session?.user?.name && !formData.requester) {
      // Fallback to session name if user profile not yet loaded/available
      setFormData(prev => ({ ...prev, requester: session.user.name || '' }));
    }
  }, [user, session, isEditMode]);

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

    // Validate required fields for submission (not for drafts)
    if (!isDraft) {
      const totalQuotations = existingQuotations.length + quotationDocuments.length;
      
      // Check all required fields
      if (!formData.requester) {
        setError('Requester is required.');
        setLoading(false);
        return;
      }
      if (!formData.budgetType) {
        setError('Budget Type is required.');
        setLoading(false);
        return;
      }
      if (!formData.projectName) {
        setError('Project Name / Description is required.');
        setLoading(false);
        return;
      }
      if (!formData.justification) {
        setError('Business Justification is required.');
        setLoading(false);
        return;
      }
      if (!formData.amount) {
        setError('Project Cost is required.');
        setLoading(false);
        return;
      }
      if (!formData.paybackPeriod) {
        setError('Payback Period is required.');
        setLoading(false);
        return;
      }
      
      // Validate all 8 approvers are selected (skip for approver editing)
      if (!isApproverEditing) {
        const selectedApproverCount = Object.values(selectedApprovers).filter(Boolean).length;
        if (selectedApproverCount < 8) {
          setError(`All 8 approvers are required. You have selected ${selectedApproverCount} of 8.`);
          setLoading(false);
          return;
        }
      }
      
      // Validate quotations
      if (totalQuotations < 3 && !quotationJustification.trim()) {
        setError('Please provide a justification for uploading less than 3 quotations.');
        setLoading(false);
        return;
      }
    }

    try {
      // Handle edit mode (approver editing)
      if (isEditMode && editRequestId && typeof editRequestId === 'string') {
        // Collect field changes for modification tracking
        const fieldChanges: { fieldName: string; oldValue: any; newValue: any }[] = [];
        
        if (originalFormData) {
          const fieldsToCompare = [
            'requester', 'unit', 'department', 'projectName', 'description',
            'budgetType', 'amount', 'currency', 'justification', 'paybackPeriod',
            'npv', 'irr', 'fundingSource', 'evaluation', 'startDate', 'endDate', 'priority'
          ];
          
          for (const field of fieldsToCompare) {
            const oldVal = originalFormData[field] || '';
            const newVal = (formData as any)[field] || '';
            if (String(oldVal) !== String(newVal)) {
              fieldChanges.push({
                fieldName: field,
                oldValue: oldVal,
                newValue: newVal,
              });
            }
          }
        }

        // Check for watcher changes (new watchers added by approver)
        const newWatcherIds = selectedWatchers.map(w => w.id);
        const originalWatcherIds = originalWatchers.map(w => w.id);
        const addedWatchers = selectedWatchers.filter(w => !originalWatcherIds.includes(w.id));
        const hasWatcherChanges = addedWatchers.length > 0;

        // Use the approver-edit endpoint if approver is editing
        if (isApproverEditing && (fieldChanges.length > 0 || hasWatcherChanges)) {
          // Track watcher additions as field changes
          if (hasWatcherChanges) {
            fieldChanges.push({
              fieldName: 'watchers',
              oldValue: originalWatcherIds.join(', ') || 'None',
              newValue: `Added: ${addedWatchers.map(w => {
                const watcherUser = users.find(u => u.id === w.id);
                return watcherUser?.display_name || w.id;
              }).join(', ')}`,
            });
          }

          const editResponse = await fetch(`/api/requests/${editRequestId}/approver-edit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              fieldChanges,
              watchers: selectedWatchers, // Include updated watchers
            }),
          });

          if (!editResponse.ok) {
            const errorData = await editResponse.json();
            throw new Error(errorData.error || 'Failed to save changes');
          }
        } else {
          // Regular update for non-approver edits (creator editing draft)
          // Always save even if no field changes detected (approvers/watchers might have changed)
          const approversArray = [
            selectedApprovers.finance_manager,
            selectedApprovers.general_manager,
            selectedApprovers.procurement_manager,
            selectedApprovers.corporate_hod,
            selectedApprovers.projects_manager,
            selectedApprovers.managing_director,
            selectedApprovers.finance_director,
            selectedApprovers.ceo,
          ].filter(Boolean);

          const updatePayload = {
            title: `CAPEX: ${formData.projectName}`,
            description: formData.description,
            metadata: {
              type: 'capex',
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
              evaluation: formData.evaluation,
              startDate: formData.startDate,
              endDate: formData.endDate,
              priority: formData.priority,
              approvers: approversArray,
              approverRoles: selectedApprovers,
              useParallelApprovals: useParallelApprovals,
              watchers: Array.isArray(selectedWatchers) ? selectedWatchers.map(w => typeof w === 'string' ? w : w.id) : [],
              quotations: [
                ...(Array.isArray(existingQuotations) ? existingQuotations : []),
                ...quotationDocuments.map(doc => ({
                  name: doc.file.name,
                  size: doc.file.size,
                  type: doc.file.type,
                  description: doc.description,
                  supplierName: doc.supplierName,
                  isSelectedSupplier: doc.isSelectedSupplier,
                  selectionReason: doc.selectionReason,
                  uploadedBy: {
                    id: user?.id || session?.user?.id,
                    name: user?.display_name || session?.user?.name || 'Unknown',
                    isApprover: isApproverEditing,
                  },
                  uploadedAt: new Date().toISOString(),
                })),
              ],
              supportingDocuments: [
                ...(Array.isArray(existingSupportingDocs) ? existingSupportingDocs : []),
                ...supportingDocuments.map(doc => ({
                  name: doc.file.name,
                  size: doc.file.size,
                  type: doc.file.type,
                  description: doc.description,
                  uploadedBy: {
                    id: user?.id || session?.user?.id,
                    name: user?.display_name || session?.user?.name || 'Unknown',
                    isApprover: isApproverEditing,
                  },
                  uploadedAt: new Date().toISOString(),
                })),
              ],
              quotationJustification: quotationJustification || null,
            },
          };

          const updateResponse = await fetch(`/api/requests/${editRequestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
          });

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error('Update response error:', errorText);
            let errorMessage = 'Failed to update request';
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error || errorMessage;
            } catch (e) {
              errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
          }
        }

        // Upload any new documents
        if (quotationDocuments.length > 0) {
          for (const doc of quotationDocuments) {
            const uploadFormData = new FormData();
            uploadFormData.append('file', doc.file);
            uploadFormData.append('documentType', 'quotation');

            try {
              const endpoint = isApproverEditing 
                ? `/api/requests/${editRequestId}/approver-documents`
                : `/api/requests/${editRequestId}/documents`;
              
              const uploadResponse = await fetch(endpoint, {
                method: 'POST',
                body: uploadFormData,
              });

              if (!uploadResponse.ok) {
                console.error(`Failed to upload quotation: ${doc.file.name}`);
              }
            } catch (uploadErr) {
              console.error(`Error uploading quotation ${doc.file.name}:`, uploadErr);
            }
          }
        }

        if (supportingDocuments.length > 0) {
          for (const doc of supportingDocuments) {
            const uploadFormData = new FormData();
            uploadFormData.append('file', doc.file);
            uploadFormData.append('documentType', 'supporting');

            try {
              const endpoint = isApproverEditing 
                ? `/api/requests/${editRequestId}/approver-documents`
                : `/api/requests/${editRequestId}/documents`;
              
              const uploadResponse = await fetch(endpoint, {
                method: 'POST',
                body: uploadFormData,
              });

              if (!uploadResponse.ok) {
                console.error(`Failed to upload supporting document: ${doc.file.name}`);
              }
            } catch (uploadErr) {
              console.error(`Error uploading supporting document ${doc.file.name}:`, uploadErr);
            }
          }
        }

        // Show success toast
        addToast({
          type: 'success',
          title: 'Changes Saved',
          message: isApproverEditing 
            ? 'Your changes have been saved and tracked.' 
            : 'Request updated successfully.',
        });

        // Navigate back to the request details page
        router.push(`/requests/${editRequestId}`);
        return;
      }

      // Create new request (original flow)
      // Convert approvers object to ordered array for sequential approval
      // Order: Finance Manager -> General Manager -> Procurement Manager -> Corporate HOD -> Projects Manager -> Operations Director -> Finance Director -> CEO
      const approversArray = [
        selectedApprovers.finance_manager,
        selectedApprovers.general_manager,
        selectedApprovers.procurement_manager,
        selectedApprovers.corporate_hod,
        selectedApprovers.projects_manager,
        selectedApprovers.managing_director,
        selectedApprovers.finance_director,
        selectedApprovers.ceo,
      ].filter(Boolean); // Remove any empty values

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
            type: 'capex',
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
            evaluation: formData.evaluation,
            startDate: formData.startDate,
            endDate: formData.endDate,
            priority: formData.priority,
            approvers: approversArray, // Sequential array of approver IDs
            approverRoles: selectedApprovers, // Keep original object for reference
            useParallelApprovals: useParallelApprovals, // Parallel or sequential approval mode
            watchers: selectedWatchers,
            quotations: quotationDocuments.map(doc => ({
              name: doc.file.name,
              size: doc.file.size,
              type: doc.file.type,
              description: doc.description,
              supplierName: doc.supplierName,
              isSelectedSupplier: doc.isSelectedSupplier,
              selectionReason: doc.selectionReason,
              uploadedBy: {
                id: user?.id || session?.user?.id,
                name: user?.display_name || session?.user?.name || 'Unknown',
                isApprover: false,
              },
              uploadedAt: new Date().toISOString(),
            })),
            supportingDocuments: supportingDocuments.map(doc => ({
              name: doc.file.name,
              size: doc.file.size,
              type: doc.file.type,
              description: doc.description,
              uploadedBy: {
                id: user?.id || session?.user?.id,
                name: user?.display_name || session?.user?.name || 'Unknown',
                isApprover: false,
              },
              uploadedAt: new Date().toISOString(),
            })),
            quotationJustification: quotationJustification || null,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isDraft ? 'save draft' : 'create CAPEX request'}`);
      }

      const requestId = data.request?.id;

      // Upload quotation documents
      if (requestId && quotationDocuments.length > 0) {
        for (const doc of quotationDocuments) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', doc.file);
          uploadFormData.append('documentType', 'quotation');

          try {
            const uploadResponse = await fetch(`/api/requests/${requestId}/documents`, {
              method: 'POST',
              body: uploadFormData,
            });

            if (!uploadResponse.ok) {
              console.error(`Failed to upload quotation: ${doc.file.name}`);
            }
          } catch (uploadErr) {
            console.error(`Error uploading quotation ${doc.file.name}:`, uploadErr);
          }
        }
      }

      // Upload supporting documents
      if (requestId && supportingDocuments.length > 0) {
        for (const doc of supportingDocuments) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', doc.file);
          uploadFormData.append('documentType', 'supporting');

          try {
            const uploadResponse = await fetch(`/api/requests/${requestId}/documents`, {
              method: 'POST',
              body: uploadFormData,
            });

            if (!uploadResponse.ok) {
              console.error(`Failed to upload supporting document: ${doc.file.name}`);
            }
          } catch (uploadErr) {
            console.error(`Error uploading supporting document ${doc.file.name}:`, uploadErr);
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

  // Filter users by search for a specific role
  const getFilteredUsersForRole = (roleKey: string) => {
    const searchTerm = approverSearch[roleKey] || '';
    const alreadySelectedIds = Object.values(selectedApprovers).filter(id => id);
    return users.filter(u => {
      const matchesSearch = searchTerm
        ? (u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;
      const notAlreadySelected = !alreadySelectedIds.includes(u.id) || selectedApprovers[roleKey] === u.id;
      return matchesSearch && notAlreadySelected;
    });
  };

  const handleSelectApprover = (roleKey: string, userId: string) => {
    setSelectedApprovers(prev => ({ ...prev, [roleKey]: userId }));
    setApproverSearch(prev => ({ ...prev, [roleKey]: '' }));
    setShowApproverDropdown(null);
  };

  const handleRemoveApprover = (roleKey: string) => {
    setSelectedApprovers(prev => ({ ...prev, [roleKey]: '' }));
  };

  const handlePublish = async () => {
    if (!editRequestId || typeof editRequestId !== 'string') return;
    
    setPublishing(true);
    setError(null);
    
    try {
      // First, save any changes to the draft
      const approversArray = [
        selectedApprovers.finance_manager,
        selectedApprovers.general_manager,
        selectedApprovers.procurement_manager,
        selectedApprovers.corporate_hod,
        selectedApprovers.projects_manager,
        selectedApprovers.managing_director,
        selectedApprovers.finance_director,
        selectedApprovers.ceo,
      ].filter(Boolean);

      // Update the request with current form data before publishing
      const updateResponse = await fetch(`/api/requests/${editRequestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `CAPEX: ${formData.projectName}`,
          description: formData.description,
          metadata: {
            type: 'capex',
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
            evaluation: formData.evaluation,
            startDate: formData.startDate,
            endDate: formData.endDate,
            priority: formData.priority,
            approvers: approversArray,
            approverRoles: selectedApprovers,
            useParallelApprovals: useParallelApprovals,
            watchers: selectedWatchers.map(w => typeof w === 'string' ? w : w.id),
            quotations: [
              ...existingQuotations,
              ...quotationDocuments.map(doc => ({
                name: doc.file.name,
                size: doc.file.size,
                type: doc.file.type,
                description: doc.description,
                supplierName: doc.supplierName,
                isSelectedSupplier: doc.isSelectedSupplier,
                selectionReason: doc.selectionReason,
                uploadedBy: {
                  id: user?.id || session?.user?.id,
                  name: user?.display_name || session?.user?.name || 'Unknown',
                  isApprover: false,
                },
                uploadedAt: new Date().toISOString(),
              })),
            ],
            supportingDocuments: [
              ...existingSupportingDocs,
              ...supportingDocuments.map(doc => ({
                name: doc.file.name,
                size: doc.file.size,
                type: doc.file.type,
                description: doc.description,
                uploadedBy: {
                  id: user?.id || session?.user?.id,
                  name: user?.display_name || session?.user?.name || 'Unknown',
                  isApprover: false,
                },
                uploadedAt: new Date().toISOString(),
              })),
            ],
            quotationJustification: quotationJustification || null,
          },
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Failed to save changes before publishing');
      }

      // Upload any new documents
      if (quotationDocuments.length > 0) {
        for (const doc of quotationDocuments) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', doc.file);
          uploadFormData.append('documentType', 'quotation');
          await fetch(`/api/requests/${editRequestId}/documents`, {
            method: 'POST',
            body: uploadFormData,
          });
        }
      }

      if (supportingDocuments.length > 0) {
        for (const doc of supportingDocuments) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', doc.file);
          uploadFormData.append('documentType', 'supporting');
          await fetch(`/api/requests/${editRequestId}/documents`, {
            method: 'POST',
            body: uploadFormData,
          });
        }
      }

      // Now publish the request
      const publishResponse = await fetch(`/api/requests/${editRequestId}/publish`, {
        method: 'POST',
      });

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json();
        throw new Error(errorData.error || 'Failed to publish request');
      }

      addToast({
        type: 'success',
        title: 'Request Published',
        message: 'Your CAPEX request has been submitted for approval.',
      });

      setShowPublishModal(false);
      router.push(`/requests/${editRequestId}`);
    } catch (err: any) {
      console.error('Error publishing request:', err);
      setError(err.message || 'Failed to publish request');
      addToast({
        type: 'error',
        title: 'Publish Failed',
        message: err.message || 'Failed to publish request',
      });
    } finally {
      setPublishing(false);
    }
  };

  if (status === 'loading' || loadingRequest) {
    return (
      <AppLayout title={isEditMode ? "Edit CAPEX Request" : "CAPEX Request"} showBack onBack={() => router.back()}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  return (
    <AppLayout title={isEditMode ? "Edit CAPEX Request" : "CAPEX Request"} showBack onBack={() => router.back()} hideNav>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto pb-28">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-text-primary font-heading">
            {isEditMode ? 'Edit Capex Request' : 'New Capex Request'}
          </h1>
          <p className="text-text-secondary mt-1">
            {isApproverEditing 
              ? 'Edit this request as an approver. Your changes will be tracked and visible to others.'
              : isEditMode 
                ? 'Update the details of this capital expenditure request'
                : 'Submit a capital expenditure request for approval'}
          </p>
          {isApproverEditing && (
            <div className="mt-3 p-3 bg-primary-50 border border-primary-200 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-primary-800 text-sm">Editing as Approver</p>
                <p className="text-xs text-primary-600">All changes you make will be recorded and visible to the requester and other viewers.</p>
              </div>
            </div>
          )}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requester <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none transition-all"
                placeholder="Requester Name"
                value={formData.requester}
                readOnly
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Unit <span className="text-red-500">*</span>
              </label>
              {user?.business_unit_id ? (
                <input
                  type="text"
                  className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none transition-all"
                  value={businessUnitName || formData.unit || 'Loading...'}
                  readOnly
                  disabled
                />
              ) : (
                <select
                  className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  required
                >
                  <option value="">{loadingUnits ? 'Loading...' : 'Select business unit'}</option>
                  {businessUnits.map((unit) => (
                    <option key={unit.id} value={unit.name}>{unit.name}</option>
                  ))}
                </select>
              )}
              {!user?.business_unit_id && (
                <p className="text-xs text-amber-600 mt-1">Please select your business unit</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              {user?.department_id ? (
                <input
                  type="text"
                  className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none transition-all"
                  value={departmentName || formData.department || 'Loading...'}
                  readOnly
                  disabled
                />
              ) : (
                <select
                  className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                >
                  <option value="">{loadingDepartments ? 'Loading...' : 'Select department'}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              )}
              {!user?.department_id && (
                <p className="text-xs text-amber-600 mt-1">Please select your department</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Budget Type <span className="text-red-500">*</span>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name / Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Enter short project name"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                required
              />
            </div>
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
                Business Justification <span className="text-red-500">*</span>
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
                Project Cost <span className="text-red-500">*</span>
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
                Payback Period <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                value={formData.paybackPeriod}
                onChange={(e) => setFormData({ ...formData, paybackPeriod: e.target.value })}
                required
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evaluation
              </label>
              <Input
                placeholder="e.g. for cost reduction"
                value={formData.evaluation}
                onChange={(e) => setFormData({ ...formData, evaluation: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Quotations Section - Required */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Quotations
            {!isEditMode && <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-danger-100 text-danger-700 rounded-full">Required</span>}
            <span className="ml-auto text-sm font-normal text-gray-500">
              ({existingQuotations.length + quotationDocuments.length}{!isEditMode ? '/3' : ' uploaded'})
            </span>
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {isEditMode 
              ? 'You can upload additional quotations if needed.'
              : 'Please upload 3 quotations from different suppliers. Each quotation should include supplier details.'}
          </p>

          {/* Existing Quotations (in edit mode) */}
          {isEditMode && existingQuotations.length > 0 && (
            <div className="mb-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Existing Quotations:</h4>
              {existingQuotations.map((quotation: any, index: number) => (
                <div key={index} className={`p-4 rounded-xl border transition-all ${quotation.isSelectedSupplier ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${quotation.isSelectedSupplier ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                      <svg className={`w-5 h-5 ${quotation.isSelectedSupplier ? 'text-emerald-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 text-sm">{quotation.name}</p>
                        {quotation.isSelectedSupplier && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Selected Supplier
                          </span>
                        )}
                      </div>
                      {quotation.supplierName && (
                        <p className="text-xs text-gray-500 mt-1">Supplier: {quotation.supplierName}</p>
                      )}
                      {quotation.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{quotation.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            id="quotation-upload"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleQuotationUpload}
            disabled={quotationDocuments.length >= 3}
          />

          <label
            htmlFor="quotation-upload"
            className={`block border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer group ${quotationDocuments.length >= 3
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-danger-200 hover:border-danger-300 hover:bg-danger-50/20'
              }`}
          >
            <div className="w-10 h-10 bg-danger-50 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-white group-hover:shadow-sm">
              <svg className="w-5 h-5 text-danger-400 group-hover:text-danger-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm text-gray-700 font-medium">
              {quotationDocuments.length >= 3 ? 'Maximum quotations uploaded' : 'Click to upload quotations'}
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, or Images up to 10MB</p>
          </label>

          {/* Uploaded Quotations List with Metadata */}
          {quotationDocuments.length > 0 && (
            <div className="mt-4 space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Uploaded Quotations:</h4>
              {quotationDocuments.map((doc, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <svg className="w-8 h-8 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.file.name}</p>
                      <p className="text-xs text-gray-500">{(doc.file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuotation(index)}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-danger-50 text-gray-400 hover:text-danger-500 transition-colors"
                      title="Remove quotation"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Quotation Description
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        placeholder="e.g., Quotation for office equipment"
                        value={doc.description}
                        onChange={(e) => handleUpdateQuotationMetadata(index, 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Supplier Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        placeholder="e.g., ABC Suppliers Ltd"
                        value={doc.supplierName}
                        onChange={(e) => handleUpdateQuotationMetadata(index, 'supplierName', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={doc.isSelectedSupplier}
                        onChange={(e) => handleUpdateQuotationMetadata(index, 'isSelectedSupplier', e.target.checked)}
                      />
                      <span className="text-sm font-medium text-gray-700">This is the selected supplier</span>
                    </label>
                  </div>

                  {doc.isSelectedSupplier && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Why was this supplier selected? <span className="text-danger-500">*</span>
                      </label>
                      <textarea
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-all"
                        placeholder="Explain why this supplier was chosen over others..."
                        rows={2}
                        value={doc.selectionReason}
                        onChange={(e) => handleUpdateQuotationMetadata(index, 'selectionReason', e.target.value)}
                        required={doc.isSelectedSupplier}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Justification for less than 3 quotations */}
          {(existingQuotations.length + quotationDocuments.length) < 3 && (
            <div className="mt-4 p-4 bg-warning-50 border border-warning-200 rounded-xl">
              <div className="flex items-start gap-2 mb-2">
                <svg className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-warning-800">Justification Required</h4>
                  <p className="text-xs text-warning-700 mt-1">You have uploaded {existingQuotations.length + quotationDocuments.length} quotation(s). Please explain why you cannot provide all 3 required quotations.</p>
                </div>
              </div>
              <textarea
                className="w-full px-4 py-3 min-h-[80px] rounded-xl border border-warning-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-warning-500 focus:border-transparent resize-none transition-all mt-2"
                placeholder="Explain why you are submitting less than 3 quotations..."
                value={quotationJustification}
                onChange={(e) => setQuotationJustification(e.target.value)}
                required={(existingQuotations.length + quotationDocuments.length) < 3}
              />
            </div>
          )}
        </Card>

        {/* Supporting Documents Section - Optional */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Supporting Documents
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Optional</span>
            {(existingSupportingDocs.length + supportingDocuments.length) > 0 && (
              <span className="ml-auto text-sm font-normal text-gray-500">({existingSupportingDocs.length + supportingDocuments.length} uploaded)</span>
            )}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload any additional supporting documents such as specifications, technical drawings, or other relevant materials.
          </p>

          {/* Existing Supporting Documents (in edit mode) */}
          {isEditMode && existingSupportingDocs.length > 0 && (
            <div className="mb-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Existing Supporting Documents:</h4>
              {existingSupportingDocs.map((doc: any, index: number) => (
                <div key={index} className="p-4 rounded-xl border transition-all bg-blue-50 border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{doc.name}</p>
                      {doc.description && (
                        <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                      )}
                      {doc.size && (
                        <p className="text-xs text-gray-400 mt-0.5">{(doc.size / 1024).toFixed(1)} KB</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            id="supporting-doc-upload"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={handleSupportingDocUpload}
          />

          <label
            htmlFor="supporting-doc-upload"
            className="block border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer group border-gray-200 hover:border-primary-300 hover:bg-primary-50/20"
          >
            <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-white group-hover:shadow-sm">
              <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm text-gray-700 font-medium">Click to upload supporting documents</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, or Images up to 10MB</p>
          </label>

          {/* Uploaded Supporting Documents List */}
          {supportingDocuments.length > 0 && (
            <div className="mt-4 space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Uploaded Supporting Documents:</h4>
              {supportingDocuments.map((doc, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.file.name}</p>
                      <p className="text-xs text-gray-500">{(doc.file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSupportingDoc(index)}
                      className="flex-shrink-0 p-1.5 rounded-lg hover:bg-danger-50 text-gray-400 hover:text-danger-500 transition-colors"
                      title="Remove document"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Document Description
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="e.g., Technical specifications, drawings, etc."
                      value={doc.description}
                      onChange={(e) => handleUpdateSupportingDocMetadata(index, 'description', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Select Watchers Section */}
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-info-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Select Watchers
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            Choose users who will be notified about this request. They cannot approve or reject.
          </p>

          {/* Search and Add Watchers */}
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
                value={watcherSearch}
                onChange={(e) => {
                  setWatcherSearch(e.target.value);
                  setShowWatcherDropdown(true);
                }}
                onFocus={() => setShowWatcherDropdown(true)}
              />
            </div>

            {/* Dropdown Results */}
            {showWatcherDropdown && watcherSearch && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                  </div>
                ) : filteredWatchers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No users found
                  </div>
                ) : (
                  filteredWatchers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleAddWatcher(user.id)}
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
          {showWatcherDropdown && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowWatcherDropdown(false)}
            />
          )}

          {/* Selected Watchers List */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Selected Watchers {selectedWatchers.length > 0 && `(${selectedWatchers.length})`}
            </h4>
            {selectedWatchers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <p className="text-sm">No watchers selected</p>
                <p className="text-xs text-gray-400 mt-1">Search and add users above</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedWatchers.map((watcher) => {
                  const watcherUser = users.find(u => u.id === watcher.id);
                  if (!watcherUser) return null;
                  const canRemove = !isApproverEditing || (watcher.addedBy?.id === (user?.id || session?.user?.id));
                  return (
                    <div key={watcher.id} className={`relative flex items-center gap-3 group bg-white border p-3 rounded-xl shadow-sm ${watcher.addedBy?.isApprover ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100'}`}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-info-50 text-info-600 flex-shrink-0">
                        <span className="font-bold text-sm">
                          {watcherUser.display_name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-text-primary text-sm truncate">{watcherUser.display_name}</h4>
                        <p className="text-xs text-text-secondary truncate">{watcherUser.email}</p>
                        {watcher.addedBy && (
                          <p className="text-xs text-primary-600 mt-0.5 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Added by {watcher.addedBy.name}
                            {watcher.addedBy.isApprover && (
                              <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-primary-100 text-primary-700">Approver</span>
                            )}
                          </p>
                        )}
                      </div>
                      {canRemove ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveWatcher(watcher.id)}
                          className="p-1.5 rounded-lg hover:bg-danger-50 text-gray-400 hover:text-danger-500 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ) : (
                        <div className="p-1.5 text-gray-300" title="Cannot remove watchers added by others">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Capex Workflow Section - Hidden for approvers editing */}
        {!isApproverEditing && (
        <Card>
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2 text-lg">
            <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Select Approvers <span className="text-red-500">*</span>
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            Select users for each approval role. <span className="text-red-500 font-medium">All 8 approvers are required.</span>
          </p>

          {/* Parallel vs Sequential Approval Toggle */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useParallelApprovals}
                onChange={(e) => setUseParallelApprovals(e.target.checked)}
                className="mt-1 w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <div>
                <span className="font-semibold text-gray-900 block">Use Parallel Approvals</span>
                <span className="text-sm text-gray-500 mt-1 block">
                  {useParallelApprovals 
                    ? 'All approvers will be notified immediately and can review the request simultaneously. Any approver can approve or reject at any time.'
                    : 'Approvals will be processed sequentially in the order shown below. Each approver must complete their review before the next approver is notified.'}
                </span>
              </div>
            </label>
          </div>

          {/* Role-based Approver Selection */}
          <div className="space-y-4">
            {approvalRoles.map((role, index) => {
              const selectedUserId = selectedApprovers[role.key];
              const selectedUser = users.find(u => u.id === selectedUserId);
              const filteredUsersForRole = getFilteredUsersForRole(role.key);

              return (
                <div key={role.key} className="relative">
                  <div className="flex items-start gap-3">
                    {/* Step Number */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 bg-primary-50 border-primary-200 text-primary-600 flex-shrink-0 mt-1">
                      <span className="font-bold text-xs">{index + 1}</span>
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        {role.label} <span className="text-red-500">*</span>
                        <span className="font-normal text-gray-400 ml-2">({role.description})</span>
                      </label>

                      {selectedUser ? (
                        <div className="flex items-center gap-3 p-3 bg-primary-50 border border-primary-200 rounded-xl">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary-600">
                              {selectedUser.display_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{selectedUser.display_name}</p>
                            <p className="text-xs text-gray-500 truncate">{selectedUser.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveApprover(role.key)}
                            className="p-1.5 rounded-lg hover:bg-danger-50 text-gray-400 hover:text-danger-500 transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              type="text"
                              className="w-full pl-9 pr-4 py-2 min-h-[44px] rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
                              placeholder={`Search for ${role.label}...`}
                              value={approverSearch[role.key] || ''}
                              onChange={(e) => {
                                setApproverSearch(prev => ({ ...prev, [role.key]: e.target.value }));
                                setShowApproverDropdown(role.key);
                              }}
                              onFocus={() => setShowApproverDropdown(role.key)}
                            />
                          </div>

                          {/* Dropdown Results */}
                          {showApproverDropdown === role.key && (
                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {loadingUsers ? (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
                                </div>
                              ) : filteredUsersForRole.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-500">
                                  No users found
                                </div>
                              ) : (
                                filteredUsersForRole.slice(0, 10).map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => handleSelectApprover(role.key, user.id)}
                                    className="w-full px-4 py-2 text-left hover:bg-primary-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-medium text-primary-600">
                                        {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">{user.display_name}</p>
                                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Connecting line between steps */}
                  {index < approvalRoles.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-gray-200 -mb-4 h-4" style={{ transform: 'translateX(-50%)' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Click outside to close dropdown */}
          {showApproverDropdown && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowApproverDropdown(null)}
            />
          )}

          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Approvers Selected</span>
              <span className="text-sm font-semibold text-primary-600">
                {Object.values(selectedApprovers).filter(Boolean).length} of {approvalRoles.length}
              </span>
            </div>
          </div>
        </Card>
        )}

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
            {/* Show Save as Draft only for new requests, not for edit mode */}
            {!isEditMode && (
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
            )}
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={loading}
              disabled={
                !formData.requester ||
                !formData.projectName ||
                !formData.amount ||
                !formData.budgetType ||
                !formData.justification ||
                !formData.paybackPeriod ||
                !formData.priority ||
                (!isApproverEditing && Object.values(selectedApprovers).filter(Boolean).length < 8) ||
                ((existingQuotations.length + quotationDocuments.length) < 3 && !quotationJustification.trim()) ||
                savingDraft
              }
            >
              {isEditMode ? 'Save Changes' : 'Submit for Approval'}
            </Button>
            {/* Show Publish button only for draft requests in edit mode */}
            {isEditMode && requestStatus === 'draft' && !isApproverEditing && (
              <Button
                type="button"
                variant="primary"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setShowPublishModal(true)}
                disabled={
                  !formData.requester ||
                  !formData.projectName ||
                  !formData.amount ||
                  !formData.budgetType ||
                  !formData.justification ||
                  !formData.paybackPeriod ||
                  !formData.priority ||
                  Object.values(selectedApprovers).filter(Boolean).length < 8 ||
                  loading ||
                  publishing
                }
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Publish
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Publish Confirmation Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !publishing && setShowPublishModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Submit for Approval?</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to submit this CAPEX request for approval? Once submitted, the approval workflow will begin and approvers will be notified.
              </p>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Request Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Project:</span>
                    <span className="font-medium text-gray-900">{formData.projectName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount:</span>
                    <span className="font-medium text-gray-900">{formData.currency === 'ZIG' ? 'ZiG' : '$'}{formData.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Approvers:</span>
                    <span className="font-medium text-gray-900">{Object.values(selectedApprovers).filter(Boolean).length} assigned</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowPublishModal(false)}
                  disabled={publishing}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handlePublish}
                  isLoading={publishing}
                  disabled={publishing}
                >
                  {publishing ? 'Publishing...' : 'Yes, Submit'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
