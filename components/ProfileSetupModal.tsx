import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface BusinessUnit {
  id: string;
  name: string;
}

interface HrimsEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department_id: string | null;
  business_unit_id: string;
}

interface HrimsDepartment {
  id: string;
  name: string;
  code: string;
}

interface HrimsBusinessUnit {
  id: string;
  name: string;
  code: string;
}

interface ProfileSetupModalProps {
  isOpen: boolean;
  userId: string;
  currentOrganizationId?: string;
  currentDepartmentId?: string;
  currentBusinessUnitId?: string;
  onComplete: () => void;
}

export default function ProfileSetupModal({
  isOpen,
  currentDepartmentId,
  currentBusinessUnitId,
  onComplete
}: ProfileSetupModalProps) {
  const { data: session } = useSession();
  
  // HRIMS lookup state
  const [hrimsLoading, setHrimsLoading] = useState(true);
  const [hrimsFound, setHrimsFound] = useState(false);
  const [hrimsEmployee, setHrimsEmployee] = useState<HrimsEmployee | null>(null);
  const [hrimsDepartment, setHrimsDepartment] = useState<HrimsDepartment | null>(null);
  const [hrimsBusinessUnit, setHrimsBusinessUnit] = useState<HrimsBusinessUnit | null>(null);
  
  // Manual selection state (only used if not found in HRIMS)
  const [departments, setDepartments] = useState<Department[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState(currentDepartmentId || '');
  const [selectedBuId, setSelectedBuId] = useState(currentBusinessUnitId || '');
  const [manualDataLoading, setManualDataLoading] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // First, check HRIMS for user data by email
  useEffect(() => {
    async function checkHrims() {
      if (!isOpen || !session?.user?.email) return;
      
      setHrimsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/hrims/employee-by-email?email=${encodeURIComponent(session.user.email)}`);
        const data = await response.json();
        
        if (response.ok && data.found) {
          setHrimsFound(true);
          setHrimsEmployee(data.employee);
          setHrimsDepartment(data.department);
          setHrimsBusinessUnit(data.businessUnit);
        } else {
          setHrimsFound(false);
          // Load manual selection data from HRIMS
          await loadManualSelectionData();
        }
      } catch (err) {
        console.error('Error checking HRIMS:', err);
        setHrimsFound(false);
        await loadManualSelectionData();
      } finally {
        setHrimsLoading(false);
      }
    }

    checkHrims();
  }, [isOpen, session?.user?.email]);

  // Load departments and business units from HRIMS for manual selection
  async function loadManualSelectionData() {
    setManualDataLoading(true);
    try {
      const [deptResponse, buResponse] = await Promise.all([
        fetch('/api/hrims/departments'),
        fetch('/api/hrims/business-units')
      ]);

      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        setDepartments(deptData.departments || []);
      }
      
      if (buResponse.ok) {
        const buData = await buResponse.json();
        setBusinessUnits(buData.businessUnits || []);
      }
    } catch (err) {
      setError('Failed to load organization data');
    } finally {
      setManualDataLoading(false);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      let payload: Record<string, any>;
      
      if (hrimsFound && hrimsEmployee) {
        // Use HRIMS data
        payload = {
          department_id: hrimsEmployee.department_id,
          business_unit_id: hrimsEmployee.business_unit_id,
          hrims_employee_id: hrimsEmployee.id,
          job_title: hrimsEmployee.job_title,
          first_name: hrimsEmployee.first_name,
          last_name: hrimsEmployee.last_name,
        };
      } else {
        // Use manual selection
        if (!selectedDeptId || !selectedBuId) {
          setError('Please select all required fields');
          setSaving(false);
          return;
        }
        payload = {
          department_id: selectedDeptId,
          business_unit_id: selectedBuId,
        };
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      onComplete();
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const loading = hrimsLoading || manualDataLoading;
  const isComplete = hrimsFound || (selectedDeptId && selectedBuId);

  const modalContent = (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop - no click handler since modal is undismissable */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5">
          {/* Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Complete Your Profile</h2>
                <p className="text-sm text-gray-500">Please select your organization details</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500">Looking up your profile in HRIMS...</p>
              </div>
            ) : hrimsFound && hrimsEmployee ? (
              <>
                {/* HRIMS Data Found - Display read-only info */}
                <div className="p-4 bg-success-50 border border-success-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-success-700">Profile found in HRIMS</span>
                  </div>
                  <p className="text-sm text-success-600">Your details have been automatically retrieved from the HR system.</p>
                </div>

                {/* Display HRIMS employee info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                      <p className="text-sm font-medium text-gray-900">{hrimsEmployee.first_name}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                      <p className="text-sm font-medium text-gray-900">{hrimsEmployee.last_name}</p>
                    </div>
                  </div>
                  
                  {hrimsEmployee.job_title && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Job Title</label>
                      <p className="text-sm font-medium text-gray-900">{hrimsEmployee.job_title}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Business Unit</label>
                    <p className="text-sm font-medium text-gray-900">
                      {hrimsBusinessUnit?.name || 'Not assigned'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                    <p className="text-sm font-medium text-gray-900">
                      {hrimsDepartment?.name || 'Not assigned'}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* HRIMS Not Found - Show warning and manual selection */}
                <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm font-medium text-warning-700">Profile not found in HRIMS</span>
                  </div>
                  <p className="text-sm text-warning-600">
                    Your email ({session?.user?.email}) was not found in the HR system. 
                    Please select your business unit and department manually.
                  </p>
                </div>

                {/* Business Unit Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Business Unit <span className="text-danger">*</span>
                  </label>
                  <select
                    value={selectedBuId}
                    onChange={(e) => setSelectedBuId(e.target.value)}
                    disabled={businessUnits.length === 0}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {businessUnits.length === 0 
                        ? 'No business units available' 
                        : 'Select business unit...'}
                    </option>
                    {businessUnits.map((bu) => (
                      <option key={bu.id} value={bu.id}>
                        {bu.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Department <span className="text-danger">*</span>
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    disabled={departments.length === 0}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {departments.length === 0 
                        ? 'No departments available' 
                        : 'Select department...'}
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              onClick={handleSave}
              disabled={!isComplete || saving}
              className="w-full py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;

  return createPortal(modalContent, document.body);
}
