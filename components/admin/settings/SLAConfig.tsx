import React, { useState } from 'react';
import { Card } from '../../ui';
import { ConfigTabProps, SectionHeading, CardHeading, FieldRow, ClockIcon, FormsIcon, NotificationIcon, compactInputCls } from './shared';

export function SLAConfig({ getSetting, queueChange }: ConfigTabProps) {
  const defaultApproval = getSetting('sla', 'default_approval_hours', 24);
  const urgentSLA = getSetting('sla', 'urgent_sla_hours', 4);
  const capexSLA = getSetting('sla', 'capex_sla_hours', 72);
  const travelSLA = getSetting('sla', 'travel_sla_hours', 48);
  const voucherSLA = getSetting('sla', 'voucher_sla_hours', 48);
  const hotelSLA = getSetting('sla', 'hotel_booking_sla_hours', 48);
  const templateSLA = getSetting('sla', 'template_form_sla_hours', 48);
  const reminderBefore = getSetting('sla', 'reminder_hours_before_breach', 4);
  const reminderRepeat = getSetting('sla', 'reminder_repeat_hours', 8);
  const escalationRules = getSetting('sla', 'escalation_rules', [
    { condition: 'SLA Breached by 12 Hours', action: 'Notify Manager', notifyList: 'approver,requester' },
  ]);

  const [rules, setRules] = useState(Array.isArray(escalationRules) ? escalationRules : []);

  const updateRule = (index: number, field: string, value: string) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
    queueChange('sla', 'escalation_rules', updated);
  };
  const addRule = () => {
    const updated = [...rules, { condition: 'SLA Breached by 12 Hours', action: 'Notify Manager', notifyList: 'approver' }];
    setRules(updated);
    queueChange('sla', 'escalation_rules', updated);
  };
  const removeRule = (index: number) => {
    const updated = rules.filter((_: any, i: number) => i !== index);
    setRules(updated);
    queueChange('sla', 'escalation_rules', updated);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeading title="Service Level Agreements" subtitle="Configure processing timers, deadlines, reminders, and automated escalations per form type." />

      <Card className="!p-6">
        <CardHeading icon={<ClockIcon />} iconBg="bg-orange-100" iconColor="text-orange-600" title="Global Approval SLAs" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="Default Primary Approval" unit="hrs">
            <input type="number" defaultValue={defaultApproval} onChange={(e) => queueChange('sla', 'default_approval_hours', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
          <FieldRow label="Urgent Request SLA" unit="hrs">
            <input type="number" defaultValue={urgentSLA} onChange={(e) => queueChange('sla', 'urgent_sla_hours', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
        </div>
      </Card>

      <Card className="!p-6">
        <CardHeading icon={<FormsIcon />} iconBg="bg-blue-100" iconColor="text-blue-600" title="Module-Specific SLAs" />
        <p className="text-sm text-gray-500 mb-4">Override the default SLA per form type. Each approval step uses this timer.</p>
        <div className="space-y-3">
          {[
            { key: 'capex_sla_hours', label: 'CAPEX Requests', val: capexSLA },
            { key: 'travel_sla_hours', label: 'Travel Authorization', val: travelSLA },
            { key: 'hotel_booking_sla_hours', label: 'Hotel Booking', val: hotelSLA },
            { key: 'voucher_sla_hours', label: 'Voucher Requests', val: voucherSLA },
            { key: 'template_form_sla_hours', label: 'Custom Form Templates', val: templateSLA },
          ].map(item => (
            <FieldRow key={item.key} label={item.label} unit="hrs" bg>
              <input type="number" defaultValue={item.val} onChange={(e) => queueChange('sla', item.key, Number(e.target.value))} className={compactInputCls} />
            </FieldRow>
          ))}
        </div>
      </Card>

      <Card className="!p-6">
        <CardHeading icon={<NotificationIcon />} iconBg="bg-yellow-100" iconColor="text-yellow-600" title="Auto-Reminders" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="First reminder before SLA breach" unit="hrs">
            <input type="number" defaultValue={reminderBefore} onChange={(e) => queueChange('sla', 'reminder_hours_before_breach', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
          <FieldRow label="Repeat reminder every" unit="hrs">
            <input type="number" defaultValue={reminderRepeat} onChange={(e) => queueChange('sla', 'reminder_repeat_hours', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
        </div>
      </Card>

      <Card className="!p-6 border-l-4 border-l-red-500">
        <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} iconBg="bg-red-100" iconColor="text-red-600" title="Automated Escalation Matrix" />
        <p className="text-sm text-gray-500 mb-4">Define what happens when an SLA is breached. Rules are evaluated in order.</p>
        <div className="space-y-4">
          {rules.map((rule: any, index: number) => (
            <div key={index} className="flex flex-col sm:flex-row gap-3 items-end bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <div className="w-full sm:w-auto flex-1">
                <label className="text-xs font-medium text-gray-500 uppercase">Condition</label>
                <select className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm" value={rule.condition} onChange={(e) => updateRule(index, 'condition', e.target.value)}>
                  <option>SLA Breached by 4 Hours</option>
                  <option>SLA Breached by 12 Hours</option>
                  <option>SLA Breached by 24 Hours</option>
                  <option>SLA Breached by 48 Hours</option>
                  <option>SLA Breached by 72 Hours</option>
                </select>
              </div>
              <div className="w-full sm:w-auto flex-1">
                <label className="text-xs font-medium text-gray-500 uppercase">Action</label>
                <select className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm" value={rule.action} onChange={(e) => updateRule(index, 'action', e.target.value)}>
                  <option>Notify Manager</option>
                  <option>Notify Requester</option>
                  <option>Notify Approver + Manager</option>
                  <option>Automatically Escalate to N+1</option>
                  <option>Automatically Escalate to N+2</option>
                  <option>Reassign to Backup Approver</option>
                  <option>Auto-Reject Request</option>
                </select>
              </div>
              <div className="w-full sm:w-auto flex-1">
                <label className="text-xs font-medium text-gray-500 uppercase">Also Notify</label>
                <select className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm" value={rule.notifyList || 'approver'} onChange={(e) => updateRule(index, 'notifyList', e.target.value)}>
                  <option value="approver">Current Approver Only</option>
                  <option value="approver,requester">Approver + Requester</option>
                  <option value="approver,requester,manager">All Stakeholders</option>
                  <option value="all_watchers">All Watchers</option>
                </select>
              </div>
              <button onClick={() => removeRule(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
          <button onClick={addRule} className="w-full border-2 border-dashed border-gray-300 py-3 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all">
            + Add Escalation Rule
          </button>
        </div>
      </Card>
    </div>
  );
}
