import React, { useState } from 'react';
import { Card } from '../../ui';
import { ConfigTabProps, SectionHeading, CardHeading, FieldRow, ToggleSwitch, RatesIcon, TravelIcon, inputCls, compactInputCls } from './shared';

export function FormsConfig({ getSetting, queueChange }: ConfigTabProps) {
  const formTypes = [
    { key: 'capex', label: 'CAPEX Request', description: 'Capital expenditure approval' },
    { key: 'travel_authorization', label: 'Travel Authorization', description: 'Local travel authorization form' },
    { key: 'hotel_booking', label: 'Hotel Booking', description: 'Complimentary hotel accommodation' },
    { key: 'voucher', label: 'Voucher Request', description: 'Accommodation voucher request' },
    { key: 'custom_template', label: 'Custom Form Templates', description: 'User-designed form templates' },
  ];

  const [formStates, setFormStates] = useState<Record<string, { enabled: boolean; drafts: boolean; attachments: boolean }>>(() => {
    const s: Record<string, { enabled: boolean; drafts: boolean; attachments: boolean }> = {};
    formTypes.forEach(f => {
      s[f.key] = {
        enabled: getSetting('forms', `${f.key}_enabled`, true),
        drafts: getSetting('forms', `${f.key}_drafts_enabled`, true),
        attachments: getSetting('forms', `${f.key}_attachments_required`, f.key === 'capex'),
      };
    });
    return s;
  });

  const updateFormState = (key: string, field: 'enabled' | 'drafts' | 'attachments', value: boolean) => {
    setFormStates(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    const settingKey = field === 'enabled' ? `${key}_enabled` : field === 'drafts' ? `${key}_drafts_enabled` : `${key}_attachments_required`;
    queueChange('forms', settingKey, value);
  };

  // CAPEX specific
  const minQuotations = getSetting('forms', 'capex_min_quotations', 3);
  const capexRequireJustification = getSetting('forms', 'capex_require_justification_below_min', true);
  const [reqJustification, setReqJustification] = useState(capexRequireJustification);
  const capexCurrencies = getSetting('forms', 'capex_currencies', ['USD', 'ZAR', 'ZWL', 'BWP', 'EUR', 'GBP']);
  const [currencies, setCurrencies] = useState(Array.isArray(capexCurrencies) ? capexCurrencies.join(', ') : 'USD, ZAR, ZWL');
  const capexBudgetTypes = getSetting('forms', 'capex_budget_types', ['budget', 'non-budget', 'emergency']);
  const [budgetTypes, setBudgetTypes] = useState(Array.isArray(capexBudgetTypes) ? capexBudgetTypes.join(', ') : 'budget, non-budget, emergency');

  // Voucher / Hotel
  const accommodationTypes = getSetting('forms', 'accommodation_types', ['Standard Room', 'Deluxe Room', 'Suite', 'Executive Suite', 'Presidential Suite']);
  const [accomTypes, setAccomTypes] = useState(Array.isArray(accommodationTypes) ? accommodationTypes.join(', ') : 'Standard Room, Deluxe Room, Suite');
  const roomTypes = getSetting('forms', 'room_types', ['Single', 'Double', 'Twin', 'Family']);
  const [rmTypes, setRmTypes] = useState(Array.isArray(roomTypes) ? roomTypes.join(', ') : 'Single, Double, Twin, Family');
  const voucherAllocationTypes = getSetting('forms', 'voucher_allocation_types', ['complimentary', 'percentage_discount', 'fixed_amount']);
  const [allocTypes, setAllocTypes] = useState(Array.isArray(voucherAllocationTypes) ? voucherAllocationTypes.join(', ') : 'complimentary, percentage_discount, fixed_amount');

  // Travel
  const travelModes = getSetting('forms', 'travel_modes', ['Company Vehicle', 'Personal Vehicle', 'Public Transport', 'Air Travel', 'Hired Vehicle']);
  const [modes, setModes] = useState(Array.isArray(travelModes) ? travelModes.join(', ') : 'Company Vehicle, Personal Vehicle');

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeading title="Form Configuration" subtitle="Enable/disable forms, set required fields, and configure form-specific options." />

      <Card className="!p-6">
        <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>} iconBg="bg-[#F3EADC]" iconColor="text-[#9A7545]" title="Form Availability & Features" />
        <p className="text-sm text-gray-500 mb-4">Control which forms are accessible and their core features.</p>
        <div className="space-y-3">
          {formTypes.map(f => (
            <div key={f.key} className={`p-4 rounded-xl border transition-colors ${formStates[f.key]?.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{f.label}</p>
                  <p className="text-xs text-gray-500">{f.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={formStates[f.key]?.enabled ?? true} onChange={(e) => updateFormState(f.key, 'enabled', e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9A7545]"></div>
                </label>
              </div>
              {formStates[f.key]?.enabled && (
                <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={formStates[f.key]?.drafts ?? true} onChange={(e) => updateFormState(f.key, 'drafts', e.target.checked)} className="rounded border-gray-300 text-[#9A7545] w-4 h-4" />
                    Allow Drafts
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={formStates[f.key]?.attachments ?? false} onChange={(e) => updateFormState(f.key, 'attachments', e.target.checked)} className="rounded border-gray-300 text-[#9A7545] w-4 h-4" />
                    Require Attachments
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="!p-6">
        <CardHeading icon={<RatesIcon />} iconBg="bg-amber-100" iconColor="text-amber-600" title="CAPEX Form Settings" />
        <div className="space-y-4">
          <FieldRow label="Minimum quotations required" unit="docs">
            <input type="number" defaultValue={minQuotations} onChange={(e) => queueChange('forms', 'capex_min_quotations', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
          <ToggleSwitch
            checked={reqJustification}
            onChange={(v) => { setReqJustification(v); queueChange('forms', 'capex_require_justification_below_min', v); }}
            label="Require justification when below minimum quotations"
            description="User must explain why fewer quotations were provided"
          />
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Available Currencies (comma-separated)</label>
            <input type="text" value={currencies} onChange={(e) => { setCurrencies(e.target.value); queueChange('forms', 'capex_currencies', e.target.value.split(',').map(s => s.trim()).filter(Boolean)); }} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Budget Types (comma-separated)</label>
            <input type="text" value={budgetTypes} onChange={(e) => { setBudgetTypes(e.target.value); queueChange('forms', 'capex_budget_types', e.target.value.split(',').map(s => s.trim()).filter(Boolean)); }} className={inputCls} />
          </div>
        </div>
      </Card>

      <Card className="!p-6">
        <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} iconBg="bg-[#F3EADC]" iconColor="text-[#9A7545]" title="Hotel & Voucher Form Settings" />
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Accommodation Types (comma-separated)</label>
            <input type="text" value={accomTypes} onChange={(e) => { setAccomTypes(e.target.value); queueChange('forms', 'accommodation_types', e.target.value.split(',').map(s => s.trim()).filter(Boolean)); }} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Room Types (comma-separated)</label>
            <input type="text" value={rmTypes} onChange={(e) => { setRmTypes(e.target.value); queueChange('forms', 'room_types', e.target.value.split(',').map(s => s.trim()).filter(Boolean)); }} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Voucher Allocation Types (comma-separated)</label>
            <input type="text" value={allocTypes} onChange={(e) => { setAllocTypes(e.target.value); queueChange('forms', 'voucher_allocation_types', e.target.value.split(',').map(s => s.trim()).filter(Boolean)); }} className={inputCls} />
          </div>
        </div>
      </Card>

      <Card className="!p-6">
        <CardHeading icon={<TravelIcon />} iconBg="bg-teal-100" iconColor="text-teal-600" title="Travel Form Settings" />
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Available Travel Modes (comma-separated)</label>
            <input type="text" value={modes} onChange={(e) => { setModes(e.target.value); queueChange('forms', 'travel_modes', e.target.value.split(',').map(s => s.trim()).filter(Boolean)); }} className={inputCls} />
          </div>
        </div>
      </Card>
    </div>
  );
}
