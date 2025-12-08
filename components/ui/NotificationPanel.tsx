import React, { useState, useEffect, useRef } from 'react';
import NotificationItem, { NotificationType } from './NotificationItem';
import Link from 'next/link';
import ComposeNotificationModal from './ComposeNotificationModal';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

// Mock Data
const MOCK_MESSAGES = [
    {
        id: '1',
        type: 'message' as NotificationType,
        title: 'Sarah Jenkins',
        description: 'Hey, I reviewed the budget proposal. Can we discuss the marketing allocation for Q3?',
        time: '5m ago',
        isRead: false,
        userParams: { name: 'Sarah Jenkins' },
    },
    {
        id: '2',
        type: 'message' as NotificationType,
        title: 'David Miller',
        description: 'The updated assets are in the shared drive. Let me know if you need anything else.',
        time: '1h ago',
        isRead: true,
        userParams: { name: 'David Miller' },
    },
    {
        id: '3',
        type: 'message' as NotificationType,
        title: 'Team Update',
        description: 'Weekly sync has been rescheduled to Thursday at 2 PM as per supervisor request.',
        time: '2h ago',
        isRead: true,
        userParams: { name: 'Admin', avatar: 'https://ui-avatars.com/api/?name=Admin&background=random' }, // using ui-avatars for mock logic if needed, but simple char is default
    },
];

const MOCK_TASKS = [
    {
        id: 't1',
        type: 'task' as NotificationType,
        title: 'Purchase Request #402',
        description: 'Waiting for your approval: Office Supplies replenishment for Sales Dept.',
        time: '20m ago',
        isRead: false,
        actionLabel: 'Review Request',
    },
    {
        id: 't2',
        type: 'task' as NotificationType,
        title: 'Capex Justification',
        description: 'Please provide additional details for the new server rack procurement.',
        time: '3h ago',
        isRead: true,
        actionLabel: 'Update Form',
    },
    {
        id: 't3',
        type: 'task' as NotificationType,
        title: 'Travel Authorization',
        description: 'Your travel request to Johannesburg has been approved by Finance.',
        time: '1d ago',
        isRead: true,
        actionLabel: 'View Details',
    },
];

export default function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
    const [activeTab, setActiveTab] = useState<'messages' | 'tasks'>('messages');
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

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

    if (!isOpen && !isComposeOpen) return null; // Keep rendered if compose is open? Or just depend on isOpen.
    // Actually, if isComposeOpen is true, we might want to keep this mounted or let the modal handle itself.
    // Integrating ComposeModal: We can render it here.

    const activeList = activeTab === 'messages' ? MOCK_MESSAGES : MOCK_TASKS;

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
                            <span className="ml-2 bg-danger-100 text-danger-600 px-1.5 py-0.5 rounded-full text-xs">3</span>
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
                            <span className="ml-2 bg-warning-100 text-warning-700 px-1.5 py-0.5 rounded-full text-xs">1</span>
                            {activeTab === 'tasks' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"></div>
                            )}
                        </button>
                    </div>

                    {/* Content List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {activeList.map((item) => (
                            <NotificationItem
                                key={item.id}
                                {...item}
                            />
                        ))}
                        {activeList.length === 0 && (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No new {activeTab}
                            </div>
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
