import React, { useState } from 'react';
import { Card } from '../../ui';
import { ConfigTabProps, SectionHeading, ToggleSwitch, inputCls, selectCls } from './shared';

export function PreferencesConfig({ getSetting, queueChange }: ConfigTabProps) {
  const timezone = getSetting('preferences', 'timezone', 'Africa/Harare (GMT+2)');
  const currency = getSetting('preferences', 'currency', 'USD ($)');
  const sessionTimeout = getSetting('preferences', 'session_timeout_minutes', 30);
  const require2FA = getSetting('preferences', 'require_2fa', true);
  const maintenanceMode = getSetting('preferences', 'maintenance_mode', false);
  const dateFormat = getSetting('preferences', 'date_format', 'DD/MM/YYYY');
  const fiscalYearStart = getSetting('preferences', 'fiscal_year_start', 'January');
  const orgDisplayName = getSetting('preferences', 'org_display_name', 'Rainbow Tourism Group');
  const defaultCurrency = getSetting('preferences', 'default_currency_code', 'USD');

  const [is2FA, setIs2FA] = useState(require2FA);
  const [isMaintenance, setIsMaintenance] = useState(maintenanceMode);

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeading title="System Preferences" subtitle="Global configurations for localization, branding, security, and organisation identity." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="!p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            Localization
          </h3>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Default Timezone</label>
            <select defaultValue={timezone} onChange={(e) => queueChange('preferences', 'timezone', e.target.value)} className={selectCls}>
              <option>Africa/Harare (GMT+2)</option>
              <option>Africa/Johannesburg (GMT+2)</option>
              <option>Africa/Lagos (GMT+1)</option>
              <option>Africa/Nairobi (GMT+3)</option>
              <option>UTC</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Default Currency</label>
            <select defaultValue={currency} onChange={(e) => queueChange('preferences', 'currency', e.target.value)} className={selectCls}>
              <option>USD ($)</option>
              <option>ZAR (R)</option>
              <option>ZWL (ZWL$)</option>
              <option>EUR (&euro;)</option>
              <option>GBP (&pound;)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Date Format</label>
            <select defaultValue={dateFormat} onChange={(e) => queueChange('preferences', 'date_format', e.target.value)} className={selectCls}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Fiscal Year Start</label>
            <select defaultValue={fiscalYearStart} onChange={(e) => queueChange('preferences', 'fiscal_year_start', e.target.value)} className={selectCls}>
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </Card>

        <Card className="!p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </span>
            Security & Sessions
          </h3>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Session Timeout (Minutes)</label>
            <input type="number" defaultValue={sessionTimeout} onChange={(e) => queueChange('preferences', 'session_timeout_minutes', Number(e.target.value))} className={inputCls} />
          </div>
          <ToggleSwitch
            checked={is2FA}
            onChange={(v) => { setIs2FA(v); queueChange('preferences', 'require_2fa', v); }}
            label="Require 2FA"
            description="Force multi-factor auth for all admins"
          />
        </Card>

        <Card className="!p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </span>
            Organisation Identity
          </h3>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Organisation Display Name</label>
            <input type="text" defaultValue={orgDisplayName} onChange={(e) => queueChange('preferences', 'org_display_name', e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Default Currency Code</label>
            <input type="text" defaultValue={defaultCurrency} onChange={(e) => queueChange('preferences', 'default_currency_code', e.target.value)} className={inputCls} placeholder="e.g. USD" />
          </div>
        </Card>

        <Card className="!p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </span>
            Maintenance
          </h3>
          <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div>
              <h4 className="font-semibold text-yellow-900">Maintenance Mode</h4>
              <p className="text-sm text-yellow-700">Prevent non-admin users from logging in during updates.</p>
            </div>
            <button
              onClick={() => { const next = !isMaintenance; setIsMaintenance(next); queueChange('preferences', 'maintenance_mode', next); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isMaintenance ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'}`}
            >
              {isMaintenance ? 'Disable Mode' : 'Enable Mode'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
