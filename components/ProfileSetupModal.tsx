import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface BusinessUnit {
  id: string;
  name: string;
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  
  const [selectedDeptId, setSelectedDeptId] = useState(currentDepartmentId || '');
  const [selectedBuId, setSelectedBuId] = useState(currentBusinessUnitId || '');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch departments and business units on mount
  useEffect(() => {
    async function fetchData() {
      if (!isOpen) return;
      
      setLoading(true);
      try {
        const [deptResponse, buResponse] = await Promise.all([
          fetch('/api/departments'),
          fetch('/api/business-units')
        ]);

        if (!deptResponse.ok || !buResponse.ok) {
          setError('Failed to load departments or business units');
          return;
        }

        const deptData = await deptResponse.json();
        const buData = await buResponse.json();

        setDepartments(deptData.departments || []);
        setBusinessUnits(buData.businessUnits || []);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isOpen]);

  const handleSave = async () => {
    if (!selectedDeptId || !selectedBuId) {
      setError('Please select all required fields');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          department_id: selectedDeptId,
          business_unit_id: selectedBuId
        }),
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

  const isComplete = selectedDeptId && selectedBuId;

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
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
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
