import React, { useState } from 'react';
import { Card } from '../../ui';
import { ConfigTabProps, SectionHeading, CardHeading, ToggleSwitch, NotificationIcon, inputCls, selectCls } from './shared';

export function NotificationsConfig({ getSetting, queueChange }: ConfigTabProps) {
  const [emailOnSubmit, setEmailOnSubmit] = useState(getSetting('notifications', 'email_on_submit', true));
  const [emailOnApproval, setEmailOnApproval] = useState(getSetting('notifications', 'email_on_approval', true));
  const [emailOnRejection, setEmailOnRejection] = useState(getSetting('notifications', 'email_on_rejection', true));
  const [emailOnEscalation, setEmailOnEscalation] = useState(getSetting('notifications', 'email_on_escalation', true));
  const [emailOnWithdraw, setEmailOnWithdraw] = useState(getSetting('notifications', 'email_on_withdraw', true));
  const [emailOnComment, setEmailOnComment] = useState(getSetting('notifications', 'email_on_comment', false));
  const [emailOnDelegation, setEmailOnDelegation] = useState(getSetting('notifications', 'email_on_delegation', true));
  const [emailOnReassignment, setEmailOnReassignment] = useState(getSetting('notifications', 'email_on_reassignment', true));
  const [emailOnSLABreach, setEmailOnSLABreach] = useState(getSetting('notifications', 'email_on_sla_breach', true));
  const [inAppEnabled, setInAppEnabled] = useState(getSetting('notifications', 'in_app_enabled', true));
  const [digestEnabled, setDigestEnabled] = useState(getSetting('notifications', 'digest_enabled', false));
  const digestFrequency = getSetting('notifications', 'digest_frequency', 'daily');
  const [emailFooter, setEmailFooter] = useState(getSetting('notifications', 'email_footer_text', 'This is an automated notification from The Circle. Do not reply to this email.'));

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeading title="Notification Settings" subtitle="Configure which events trigger notifications and how they are delivered." />

      <Card className="!p-6">
        <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} iconBg="bg-blue-100" iconColor="text-blue-600" title="Email Notification Triggers" />
        <p className="text-sm text-gray-500 mb-4">Select which workflow events send email notifications.</p>
        <div className="space-y-1">
          <ToggleSwitch checked={emailOnSubmit} onChange={(v) => { setEmailOnSubmit(v); queueChange('notifications', 'email_on_submit', v); }} label="Request submitted" description="Notify approvers when a new request is submitted" />
          <ToggleSwitch checked={emailOnApproval} onChange={(v) => { setEmailOnApproval(v); queueChange('notifications', 'email_on_approval', v); }} label="Request approved" description="Notify requester and next approver" />
          <ToggleSwitch checked={emailOnRejection} onChange={(v) => { setEmailOnRejection(v); queueChange('notifications', 'email_on_rejection', v); }} label="Request rejected" description="Notify requester when request is rejected" />
          <ToggleSwitch checked={emailOnEscalation} onChange={(v) => { setEmailOnEscalation(v); queueChange('notifications', 'email_on_escalation', v); }} label="Request escalated" description="Notify when request is escalated due to SLA breach" />
          <ToggleSwitch checked={emailOnWithdraw} onChange={(v) => { setEmailOnWithdraw(v); queueChange('notifications', 'email_on_withdraw', v); }} label="Request withdrawn" description="Notify approvers when requester withdraws" />
          <ToggleSwitch checked={emailOnComment} onChange={(v) => { setEmailOnComment(v); queueChange('notifications', 'email_on_comment', v); }} label="New comment added" description="Notify participants when a comment is added" />
          <ToggleSwitch checked={emailOnDelegation} onChange={(v) => { setEmailOnDelegation(v); queueChange('notifications', 'email_on_delegation', v); }} label="Approval delegated" description="Notify delegate when approval is delegated to them" />
          <ToggleSwitch checked={emailOnReassignment} onChange={(v) => { setEmailOnReassignment(v); queueChange('notifications', 'email_on_reassignment', v); }} label="Request reassigned" description="Notify new approver on reassignment" />
          <ToggleSwitch checked={emailOnSLABreach} onChange={(v) => { setEmailOnSLABreach(v); queueChange('notifications', 'email_on_sla_breach', v); }} label="SLA breach warning" description="Notify approver and manager when SLA is about to breach" />
        </div>
      </Card>

      <Card className="!p-6">
        <CardHeading icon={<NotificationIcon />} iconBg="bg-purple-100" iconColor="text-purple-600" title="Delivery Settings" />
        <div className="space-y-3">
          <ToggleSwitch checked={inAppEnabled} onChange={(v) => { setInAppEnabled(v); queueChange('notifications', 'in_app_enabled', v); }} label="In-app notifications" description="Show notifications in the app bell icon" />
          <ToggleSwitch checked={digestEnabled} onChange={(v) => { setDigestEnabled(v); queueChange('notifications', 'digest_enabled', v); }} label="Email digest" description="Consolidate notifications into a periodic digest email" />
          {digestEnabled && (
            <div className="pl-4 border-l-2 border-purple-200">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Digest Frequency</label>
                <select defaultValue={digestFrequency} onChange={(e) => queueChange('notifications', 'digest_frequency', e.target.value)} className={selectCls}>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="!p-6">
        <CardHeading icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} iconBg="bg-gray-100" iconColor="text-gray-600" title="Email Template Settings" />
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email Footer Text</label>
            <textarea
              value={emailFooter}
              onChange={(e) => { setEmailFooter(e.target.value); queueChange('notifications', 'email_footer_text', e.target.value); }}
              rows={3}
              className={inputCls}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
