import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button } from '../../ui';
import { SectionHeading } from './shared';

type DelegationTab = 'pending' | 'active' | 'history';

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending Approval' },
  approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

export function DelegationConfig() {
  const [delegations, setDelegations] = useState<any[]>([]);
  const [delegationLoading, setDelegationLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DelegationTab>('pending');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sorting & Grouping
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [groupBy, setGroupBy] = useState<'none' | 'delegator' | 'status'>('none');
  
  // History Modal
  const [selectedHistory, setSelectedHistory] = useState<any | null>(null);

  const loadDelegations = useCallback(async () => {
    try {
      const res = await fetch('/api/rbac/delegations');
      if (res.ok) {
        const data = await res.json();
        setDelegations(data || []);
      }
    } catch (err) {
      console.error('Error loading delegations:', err);
    } finally {
      setDelegationLoading(false);
    }
  }, []);

  useEffect(() => { loadDelegations(); }, [loadDelegations]);

  const pendingDelegations = delegations.filter((d: any) => d.status === 'pending');
  const activeDelegations = delegations.filter((d: any) => d.status === 'approved' && d.is_active);
  const historyDelegations = delegations.filter((d: any) => d.status === 'rejected' || (d.status === 'approved' && !d.is_active));

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/rbac/delegations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, review_comment: reviewComment }),
      });
      if (res.ok) {
        setFeedback({ type: 'success', text: `Delegation ${action === 'approve' ? 'approved' : 'rejected'} successfully.` });
        setReviewingId(null);
        setReviewComment('');
        await loadDelegations();
      } else {
        const err = await res.json();
        setFeedback({ type: 'error', text: err.error || 'Failed to process delegation.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDeactivate = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/rbac/delegations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: false }),
      });
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Delegation deactivated.' });
        await loadDelegations();
      }
    } catch {
      setFeedback({ type: 'error', text: 'Failed to deactivate delegation.' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const getVisibleDelegations = () => {
    switch (activeTab) {
      case 'pending': return pendingDelegations;
      case 'active': return activeDelegations;
      case 'history': return historyDelegations;
    }
  };

  const visibleDelegations = useMemo(() => {
     let sorted = [...getVisibleDelegations()];
     sorted.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortBy === 'date_desc' ? dateB - dateA : dateA - dateB;
     });
     return sorted;
  }, [delegations, activeTab, sortBy]);

  const groupedDelegations = useMemo(() => {
     if (groupBy === 'none') return null;
     const groups: Record<string, any[]> = {};
     visibleDelegations.forEach(d => {
        let key = 'Other';
        if (groupBy === 'status') {
           key = d.status || 'unknown';
        } else if (groupBy === 'delegator') {
           const delegatorName = (Array.isArray(d.delegator) ? d.delegator[0]?.display_name : d.delegator?.display_name);
           key = delegatorName || 'Unknown Delegator';
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
     });
     return groups;
  }, [visibleDelegations, groupBy]);

  const tabs: { id: DelegationTab; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending Requests', count: pendingDelegations.length },
    { id: 'active', label: 'Active', count: activeDelegations.length },
    { id: 'history', label: 'History', count: historyDelegations.length },
  ];

  const renderDelegationCard = (d: any) => {
    const badge = statusBadge[d.status] || statusBadge.pending;
    const isReviewing = reviewingId === d.id;
    const delegatorName = Array.isArray(d.delegator) ? d.delegator[0]?.display_name : d.delegator?.display_name;
    const delegateName = Array.isArray(d.delegate) ? d.delegate[0]?.display_name : d.delegate?.display_name;
    const initiatorName = Array.isArray(d.initiator) ? d.initiator[0]?.display_name : d.initiator?.display_name;
    const reviewerName = Array.isArray(d.reviewer) ? d.reviewer[0]?.display_name : d.reviewer?.display_name;
    
    return (
      <Card 
        key={d.id} 
        className={`!p-5 ${
          d.status === 'pending' ? 'border-l-4 border-l-yellow-400' :
          d.is_active ? 'border-l-4 border-l-green-500' : ''
        } ${activeTab === 'history' ? 'cursor-pointer hover:shadow-md transition-shadow hover:-translate-y-0.5 transform duration-200' : ''}`}
        onClick={() => {
          if (activeTab === 'history') {
            setSelectedHistory(d);
          }
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Delegation Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                Initiated by: <span className="text-gray-900">{initiatorName || 'System'}</span>
              </span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-brand-600 uppercase tracking-wider font-bold mb-1">From (Delegator)</p>
                <p className="font-semibold text-gray-900 text-sm truncate">{delegatorName || d.delegator_id}</p>
              </div>
              <svg className="w-6 h-6 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              <div className="flex-1 p-3 bg-brand-50 rounded-lg border border-brand-100 text-right">
                <p className="text-xs text-brand-600 uppercase tracking-wider font-bold mb-1">To (Delegate)</p>
                <p className="font-semibold text-gray-900 text-sm truncate">{delegateName || d.delegate_id}</p>
              </div>
            </div>

            <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <p className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wider">Reason for Delegation</p>
              <p className="text-sm text-gray-800">
                {d.reason || <span className="text-gray-400 italic">No reason provided</span>}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {formatDate(d.starts_at)} &mdash; {d.ends_at ? formatDate(d.ends_at) : 'Indefinite'}
              </div>
              {d.department?.name && <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md font-medium">{d.department.name}</span>}
              {d.business_unit?.name && <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md font-medium">{d.business_unit.name}</span>}
            </div>

            {d.status !== 'pending' && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <span className="font-semibold whitespace-nowrap">Reviewed by:</span> <span className="text-gray-900 border-b border-dashed border-gray-300">{reviewerName || d.reviewed_by || 'System'}</span>
                {d.review_comment && (
                  <span className="italic text-gray-500 ml-1">"{d.review_comment}"</span>
                )}
              </div>
            )}
            {activeTab === 'history' && (
               <div className="mt-3 text-right">
                  <span className="text-xs text-brand-600 font-medium hover:text-brand-700 underline underline-offset-2">Click to view details</span>
               </div>
            )}
          </div>

          {/* Actions */}
          {activeTab !== 'history' && (
            <div className="flex-shrink-0">
              {d.status === 'pending' && !isReviewing && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="primary"
                    className="!py-1.5 !px-3 !text-xs bg-green-600 hover:bg-green-700 shadow-sm whitespace-nowrap"
                    onClick={(e) => { e.stopPropagation(); handleReview(d.id, 'approve'); }}
                    disabled={actionLoading}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    className="!py-1.5 !px-3 !text-xs text-red-600 hover:bg-red-50 border border-red-200 shadow-sm whitespace-nowrap"
                    onClick={(e) => { e.stopPropagation(); setReviewingId(d.id); setReviewComment(''); }}
                    disabled={actionLoading}
                  >
                    Reject
                  </Button>
                </div>
              )}

              {d.status === 'approved' && d.is_active && (
                <Button
                  variant="ghost"
                  className="!py-1.5 !px-3 !text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 shadow-sm whitespace-nowrap"
                  onClick={(e) => { e.stopPropagation(); handleDeactivate(d.id); }}
                  disabled={actionLoading}
                >
                  Deactivate
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Reject Comment Input */}
        {isReviewing && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-medium text-red-700">Reason for rejection (optional)</p>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Provide a reason for rejecting this delegation request..."
              className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                className="!py-1.5 !px-3 !text-xs"
                onClick={(e) => { e.stopPropagation(); setReviewingId(null); setReviewComment(''); }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="!py-1.5 !px-3 !text-xs bg-red-600 hover:bg-red-700"
                onClick={(e) => { e.stopPropagation(); handleReview(d.id, 'reject'); }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <SectionHeading title="Approval Delegation" subtitle="Review and manage delegation requests. Users submit delegation requests which require admin approval before taking effect." />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 shadow-sm transition-transform hover:-translate-y-1">
          <p className="text-2xl font-bold text-yellow-700">{pendingDelegations.length}</p>
          <p className="text-sm text-yellow-600 font-medium">Pending Approval</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm transition-transform hover:-translate-y-1">
          <p className="text-2xl font-bold text-green-700">{activeDelegations.length}</p>
          <p className="text-sm text-green-600 font-medium">Active Delegations</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm transition-transform hover:-translate-y-1">
          <p className="text-2xl font-bold text-gray-600">{historyDelegations.length}</p>
          <p className="text-sm text-gray-500 font-medium">Past / Rejected</p>
        </div>
      </div>

      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium shadow-sm transition-all ${
          feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Tabs & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-200 pb-px">
        <nav className="-mb-px flex space-x-6 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === tab.id
                  ? tab.id === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-brand-100 text-brand-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
        
        {/* Filters and Sorting */}
        <div className="flex items-center gap-2 py-2">
          <div className="flex flex-col group relative">
            <select 
              className="text-sm border border-gray-300 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-700 cursor-pointer shadow-sm hover:border-brand-300"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
            </select>
          </div>

          <div className="flex flex-col group relative">
            <select 
              className="text-sm border border-gray-300 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-700 cursor-pointer shadow-sm hover:border-brand-300"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
            >
              <option value="none">No Grouping</option>
              <option value="status">Group by Status</option>
              <option value="delegator">Group by Delegator</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {delegationLoading ? (
        <div className="py-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto" />
          <p className="mt-4 text-gray-500 font-medium">Loading requests...</p>
        </div>
      ) : visibleDelegations.length === 0 ? (
        <Card className="!p-16 text-center bg-gray-50/50 border-dashed">
          <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-gray-500 font-medium text-lg">
            {activeTab === 'pending' ? 'No delegation requests awaiting approval.' :
             activeTab === 'active' ? 'No active delegations at the moment.' :
             'No past delegation history found.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupBy === 'none' ? (
            <div className="space-y-4">
              {visibleDelegations.map(renderDelegationCard)}
            </div>
          ) : (
            Object.entries(groupedDelegations || {}).map(([group, items]) => (
              <div key={group} className="space-y-4 bg-gray-50/30 p-4 rounded-xl border border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                  {group} 
                  <span className="text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full text-xs font-semibold">{items.length}</span>
                </h4>
                <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-brand-100/50">
                  {items.map(renderDelegationCard)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* History Detail Modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedHistory(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
              <h3 className="text-xl font-bold font-heading text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                Delegation Details
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${statusBadge[selectedHistory.status]?.bg} ${statusBadge[selectedHistory.status]?.text}`}>
                  {statusBadge[selectedHistory.status]?.label || selectedHistory.status}
                </span>
              </h3>
              <button onClick={() => setSelectedHistory(null)} className="text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-200 p-2.5 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* People involved */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <p className="text-xs text-brand-600 uppercase font-bold mb-2 tracking-wider">Initiator</p>
                  <p className="font-semibold text-gray-900 text-lg">
                    {Array.isArray(selectedHistory.initiator) ? selectedHistory.initiator[0]?.display_name : selectedHistory.initiator?.display_name || 'System'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     Requested on {formatDate(selectedHistory.created_at)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <p className="text-xs text-brand-600 uppercase font-bold mb-2 tracking-wider">Reviewer</p>
                  <p className="font-semibold text-gray-900 text-lg">
                    {Array.isArray(selectedHistory.reviewer) ? selectedHistory.reviewer[0]?.display_name : selectedHistory.reviewer?.display_name || 'Pending / System'}
                  </p>
                  {selectedHistory.reviewed_at && (
                     <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                       <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Reviewed on {formatDate(selectedHistory.reviewed_at)}
                     </p>
                  )}
                </div>
              </div>

              {/* Delegation Direction */}
              <div className="flex items-center gap-4 bg-brand-50 p-5 rounded-2xl border border-brand-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-brand-100 rounded-full opacity-50 blur-xl"></div>
                <div className="flex-1 relative z-10">
                  <p className="text-xs text-brand-600 uppercase tracking-wider font-bold mb-1">From (Delegator)</p>
                  <p className="font-semibold text-gray-900 text-lg">
                    {Array.isArray(selectedHistory.delegator) ? selectedHistory.delegator[0]?.display_name : selectedHistory.delegator?.display_name || selectedHistory.delegator_id}
                  </p>
                </div>
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm relative z-10">
                  <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </div>
                <div className="flex-1 text-right relative z-10">
                  <p className="text-xs text-brand-600 uppercase tracking-wider font-bold mb-1">To (Delegate)</p>
                  <p className="font-semibold text-gray-900 text-lg">
                    {Array.isArray(selectedHistory.delegate) ? selectedHistory.delegate[0]?.display_name : selectedHistory.delegate?.display_name || selectedHistory.delegate_id}
                  </p>
                </div>
              </div>

              {/* Justification & Timeline */}
              <div className="space-y-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-gray-300 transition-colors">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                     <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     Duration
                  </h4>
                  <div className="inline-flex items-center gap-2 font-medium text-brand-700 bg-brand-50 px-4 py-2.5 rounded-xl border border-brand-100">
                    {formatDate(selectedHistory.starts_at)} <span className="text-brand-300 mx-1">&rarr;</span> {selectedHistory.ends_at ? formatDate(selectedHistory.ends_at) : 'Indefinite'}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-gray-300 transition-colors">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                     <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     Reason for Request
                  </h4>
                  <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed">
                    {selectedHistory.reason || <span className="text-gray-400 italic">No specific reason provided.</span>}
                  </p>
                </div>

                {selectedHistory.review_comment && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-gray-300 transition-colors">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                       <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                       Reviewer Notes
                    </h4>
                    <p className="text-sm text-gray-800 bg-amber-50 p-4 rounded-xl border border-amber-100 border-l-4 border-l-amber-400 leading-relaxed">
                      {selectedHistory.review_comment}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end rounded-b-3xl">
              <Button variant="ghost" className="bg-white px-6 font-semibold shadow-sm border border-gray-200 hover:bg-gray-100" onClick={() => setSelectedHistory(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
