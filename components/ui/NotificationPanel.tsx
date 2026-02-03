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
    type: 'message' | 'task' | 'approval' | 'system' | 'info';
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
    return date.toLocaleDateString('en-US');
}

export default function NotificationPanel({ isOpen, onClose, onUnreadCheck }: NotificationPanelProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'tasks'>('tasks');
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCounts, setUnreadCounts] = useState({ tasks: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/notifications');
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.notifications || []);
                const counts = data.unreadCounts || { tasks: 0 };
                setUnreadCounts({ tasks: counts.tasks || 0 });
                if (onUnreadCheck) {
                    onUnreadCheck(counts.tasks > 0);
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
                setUnreadCounts(prev => {
                    const newCounts = { ...prev, tasks: Math.max(0, prev.tasks - 1) };
                    if (onUnreadCheck) onUnreadCheck(newCounts.tasks > 0);
                    return newCounts;
                });
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

    // Filter notifications - show tasks and approvals
    const tasks = notifications.filter(n => n.type === 'task' || n.type === 'approval' || n.type === 'info');
    const activeList = tasks;

    return (
        <>
            {isOpen && (
                <div
                    ref={panelRef}
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-[60] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                        {unreadCounts.tasks > 0 && (
                            <span className="bg-warning-100 text-warning-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                {unreadCounts.tasks} unread
                            </span>
                        )}
                    </div>

                    {/* Content List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                            </div>
                        ) : activeList.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No new notifications
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

                    {/* View All */}
                    <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
                        <Link href="/notifications" className="text-xs font-semibold text-primary-600 hover:text-primary-700 uppercase tracking-wide">
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
