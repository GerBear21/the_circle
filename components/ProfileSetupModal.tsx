import { useState, useEffect, useRef } from 'react';
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
  requirePinSetup?: boolean;
  onComplete: () => void;
}

export default function ProfileSetupModal({
  isOpen,
  currentDepartmentId,
  currentBusinessUnitId,
  requirePinSetup = true,
  onComplete
}: ProfileSetupModalProps) {
  const { data: session } = useSession();
  
  // Setup step: 'profile' or 'pin'
  const [setupStep, setSetupStep] = useState<'profile' | 'pin'>('profile');
  
  // PIN setup state
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
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

      // If PIN setup is required, move to PIN step; otherwise complete
      if (requirePinSetup) {
        setSetupStep('pin');
        // Focus first PIN input after transition
        setTimeout(() => {
          pinInputRefs.current[0]?.focus();
        }, 100);
      } else {
        onComplete();
      }
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle PIN digit input
  const handlePinChange = (index: number, value: string, isConfirm: boolean = false) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newPin = isConfirm ? [...confirmPin] : [...pin];
    newPin[index] = value.slice(-1); // Only take last digit
    
    if (isConfirm) {
      setConfirmPin(newPin);
    } else {
      setPin(newPin);
    }
    
    setPinError(null);
    
    // Auto-focus next input
    if (value && index < 3) {
      const refs = isConfirm ? confirmPinInputRefs : pinInputRefs;
      refs.current[index + 1]?.focus();
    }
  };

  // Handle backspace in PIN inputs
  const handlePinKeyDown = (index: number, e: React.KeyboardEvent, isConfirm: boolean = false) => {
    if (e.key === 'Backspace') {
      const currentPin = isConfirm ? confirmPin : pin;
      if (!currentPin[index] && index > 0) {
        const refs = isConfirm ? confirmPinInputRefs : pinInputRefs;
        refs.current[index - 1]?.focus();
      }
    }
  };

  // Save PIN
  const handleSavePin = async () => {
    const pinString = pin.join('');
    const confirmPinString = confirmPin.join('');
    
    if (pinString.length !== 4) {
      setPinError('Please enter all 4 digits');
      return;
    }
    
    if (pinString !== confirmPinString) {
      setPinError('PINs do not match');
      return;
    }
    
    setSavingPin(true);
    setPinError(null);
    
    try {
      const response = await fetch('/api/user/pin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinString }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to set up PIN');
      }
      
      onComplete();
    } catch (err: any) {
      setPinError(err.message || 'Failed to set up PIN. Please try again.');
    } finally {
      setSavingPin(false);
    }
  };

  if (!isOpen) return null;

  const loading = hrimsLoading || manualDataLoading;
  const isComplete = hrimsFound || (selectedDeptId && selectedBuId);

  // PIN setup step content
  const renderPinSetupStep = () => (
    <>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Set Up Security PIN</h2>
            <p className="text-sm text-gray-500">Create a 4-digit PIN to sign approvals</p>
          </div>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-success-500 text-white flex items-center justify-center text-xs font-medium">✓</div>
            <span className="text-xs text-gray-500">Profile</span>
          </div>
          <div className="flex-1 h-0.5 bg-primary-500"></div>
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-medium">2</div>
            <span className="text-xs text-primary-600 font-medium">Security PIN</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-primary-700">Why do I need a PIN?</p>
              <p className="text-sm text-primary-600 mt-1">
                Your PIN adds an extra layer of security when approving documents. 
                Even if someone gains access to your account, they cannot approve requests without your PIN.
              </p>
            </div>
          </div>
        </div>

        {pinError && (
          <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700">
            {pinError}
          </div>
        )}

        {/* Enter PIN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Enter 4-digit PIN</label>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={`pin-${index}`}
                ref={(el) => { pinInputRefs.current[index] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={pin[index]}
                onChange={(e) => handlePinChange(index, e.target.value, false)}
                onKeyDown={(e) => handlePinKeyDown(index, e, false)}
                className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
              />
            ))}
          </div>
        </div>

        {/* Confirm PIN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Confirm PIN</label>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={`confirm-pin-${index}`}
                ref={(el) => { confirmPinInputRefs.current[index] = el; }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={confirmPin[index]}
                onChange={(e) => handlePinChange(index, e.target.value, true)}
                onKeyDown={(e) => handlePinKeyDown(index, e, true)}
                className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
        <button
          onClick={handleSavePin}
          disabled={pin.join('').length !== 4 || confirmPin.join('').length !== 4 || savingPin}
          className="w-full py-2.5 px-4 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {savingPin ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Setting up PIN...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Complete Setup
            </>
          )}
        </button>
      </div>
    </>
  );

  const modalContent = (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop - no click handler since modal is undismissable */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 ring-1 ring-black/5">
          {setupStep === 'pin' ? renderPinSetupStep() : (
          <>
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
            {/* Step indicator */}
            {requirePinSetup && (
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-medium">1</div>
                  <span className="text-xs text-primary-600 font-medium">Profile</span>
                </div>
                <div className="flex-1 h-0.5 bg-gray-200"></div>
                <div className="flex items-center gap-1">
                  <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-medium">2</div>
                  <span className="text-xs text-gray-500">Security PIN</span>
                </div>
              </div>
            )}
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
                requirePinSetup ? 'Continue to PIN Setup' : 'Continue'
              )}
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;

  return createPortal(modalContent, document.body);
}
