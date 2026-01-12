import React, { useState, useEffect, useRef, useCallback } from 'react';
import NotificationItem from './NotificationItem';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ComposeNotificationModal from './ComposeNotificationModal';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onUnreadCheck?: (hasUnread: boolean) => void;
}

interface Notification {
    id: string;
    type: 'message' | 'task' | 'approval' | 'system';
    title: string;
    message: string;
    is_read: boolean;
    metadata: {
        action_label?: string;
        action_url?: string;
        request_id?: string;
    };
    created_at: string;
    sender?: {
        id: string;
        display_name: string;
        email: string;
    };
}

function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export default function NotificationPanel({ isOpen, onClose, onUnreadCheck }: NotificationPanelProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'messages' | 'tasks'>('messages');
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({ messages: 0, tasks: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/notifications');
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.notifications || []);
                const counts = data.unreadCounts || { messages: 0, tasks: 0 };
                setUnreadCounts(counts);
                if (onUnreadCheck) {
                    onUnreadCheck(counts.messages > 0 || counts.tasks > 0);
                }
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [isOpen, fetchNotifications]);

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.is_read) {
            try {
                await fetch('/api/notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notification_ids: [notification.id], is_read: true }),
                });
                setNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
                );
                if (notification.type === 'message') {
                    setUnreadCounts(prev => {
                        const newCounts = { ...prev, messages: Math.max(0, prev.messages - 1) };
                        if (onUnreadCheck) onUnreadCheck(newCounts.messages > 0 || newCounts.tasks > 0);
                        return newCounts;
                    });
                } else {
                    setUnreadCounts(prev => {
                        const newCounts = { ...prev, tasks: Math.max(0, prev.tasks - 1) };
                        if (onUnreadCheck) onUnreadCheck(newCounts.messages > 0 || newCounts.tasks > 0);
                        return newCounts;
                    });
                }
            } catch (err) {
                console.error('Failed to mark notification as read:', err);
            }
        }

        // Navigate if there's an action URL
        if (notification.metadata?.action_url) {
            onClose();
            router.push(notification.metadata.action_url);
        }
    };

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // If compose is open, don't close the panel due to outside clicks on the modal backdrop,
            // but actually the modal backdrop is usually a portal ON TOP of everything.
            // We just need to ensure clicks inside the panel don't close it (handled by stopPropagation below).

            // If we are strictly clicking outside the panel AND the compose modal is NOT open, we close.
            if (
                isOpen &&
                !isComposeOpen &&
                panelRef.current &&
                !panelRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, isComposeOpen]);

    if (!isOpen && !isComposeOpen) return null;

    // Filter notifications by type
    const messages = notifications.filter(n => n.type === 'message');
    const tasks = notifications.filter(n => n.type === 'task' || n.type === 'approval');
    const activeList = activeTab === 'messages' ? messages : tasks;

    return (
        <>
            {isOpen && (
                <div
                    ref={panelRef}
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-[60] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header / Tabs */}
                    <div className="flex border-b border-gray-100">
                        <button
                            onClick={() => setActiveTab('messages')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'messages'
                                ? 'text-primary-600 bg-primary-50/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            Messages
                            {unreadCounts.messages > 0 && (
                                <span className="ml-2 bg-danger-100 text-danger-600 px-1.5 py-0.5 rounded-full text-xs">
                                    {unreadCounts.messages}
                                </span>
                            )}
                            {activeTab === 'messages' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"></div>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'tasks'
                                ? 'text-primary-600 bg-primary-50/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            My Tasks
                            {unreadCounts.tasks > 0 && (
                                <span className="ml-2 bg-warning-100 text-warning-700 px-1.5 py-0.5 rounded-full text-xs">
                                    {unreadCounts.tasks}
                                </span>
                            )}
                            {activeTab === 'tasks' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"></div>
                            )}
                        </button>
                    </div>

                    {/* Content List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                            </div>
                        ) : activeList.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No new {activeTab}
                            </div>
                        ) : (
                            activeList.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    id={notification.id}
                                    type={notification.type === 'task' || notification.type === 'approval' ? 'task' : 'message'}
                                    title={notification.title}
                                    description={notification.message || ''}
                                    time={formatTimeAgo(notification.created_at)}
                                    isRead={notification.is_read}
                                    actionLabel={notification.metadata?.action_label}
                                    onClick={() => handleNotificationClick(notification)}
                                    userParams={notification.sender ? {
                                        name: notification.sender.display_name || 'Unknown',
                                    } : undefined}
                                />
                            ))
                        )}
                    </div>

                    {/* Compose and View All */}
                    <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <button
                            onClick={() => setIsComposeOpen(true)}
                            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-white px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-gray-200 hover:shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Compose
                        </button>
                        <Link href={`/notifications?tab=${activeTab}`} className="text-xs font-semibold text-primary-600 hover:text-primary-700 uppercase tracking-wide">
                            View All
                        </Link>
                    </div>
                </div>
            )}

            {/* Compose Modal */}
            <ComposeNotificationModal
                isOpen={isComposeOpen}
                onClose={() => setIsComposeOpen(false)}
            />
        </>
    );
}
