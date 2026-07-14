import React from 'react';
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
  const reminderMaxCount = getSetting('sla', 'reminder_max_count', 5);
  const draftReminderHours = getSetting('sla', 'draft_reminder_hours', 48);

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeading title="Service Level Agreements" subtitle="Configure processing timers, deadlines, and reminder timing per form type." />

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
        <CardHeading icon={<FormsIcon />} iconBg="bg-[#F3EADC]" iconColor="text-[#9A7545]" title="Module-Specific SLAs" />
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
        <CardHeading icon={<NotificationIcon />} iconBg="bg-yellow-100" iconColor="text-yellow-600" title="Reminders" />
        <p className="text-sm text-gray-500 mb-4">
          Standard timing for reminding approvers about pending requests and requesters about stale drafts. Each user chooses their
          own reminder channel and frequency in My Settings; these are the system defaults for when reminders start.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="First reminder before SLA breach" unit="hrs">
            <input type="number" defaultValue={reminderBefore} onChange={(e) => queueChange('sla', 'reminder_hours_before_breach', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
          <FieldRow label="Repeat reminder every" unit="hrs">
            <input type="number" defaultValue={reminderRepeat} onChange={(e) => queueChange('sla', 'reminder_repeat_hours', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
          <FieldRow label="Maximum reminders per request" unit="max">
            <input type="number" min={1} defaultValue={reminderMaxCount} onChange={(e) => queueChange('sla', 'reminder_max_count', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
          <FieldRow label="Remind about unsubmitted drafts after" unit="hrs">
            <input type="number" min={1} defaultValue={draftReminderHours} onChange={(e) => queueChange('sla', 'draft_reminder_hours', Number(e.target.value))} className={compactInputCls} />
          </FieldRow>
        </div>
      </Card>
    </div>
  );
}
