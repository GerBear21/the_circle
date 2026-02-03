import React from 'react';

export type NotificationType = 'message' | 'task' | 'approval' | 'system';

export interface NotificationItemProps {
    id: string;
    type: NotificationType;
    title: string;
    description: string;
    time: string;
    isRead?: boolean;
    onClick?: () => void;
    actionLabel?: string;
    userParams?: {
        name: string;
        avatar?: string; // URL or valid content for avatar
    };
}

export default function NotificationItem({
    type,
    title,
    description,
    time,
    isRead = false,
    onClick,
    actionLabel,
    userParams,
}: NotificationItemProps) {
    return (
        <div
            onClick={onClick}
            className={`p-4 border-b border-gray-50 flex gap-4 hover:bg-gray-50 transition-colors cursor-pointer ${!isRead ? 'bg-blue-50/30' : ''
                }`}
        >
            {/* Icon / Avatar */}
            <div className="flex-shrink-0">
                {type === 'message' && userParams ? (
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                        {userParams.avatar ? (
                            // If it's a real image URL in a real app, we'd use <img />
                            // For now, let's assume it might be a char string or URL.
                            // If it's a long string (URL), show image, else char.
                            userParams.avatar.length > 2 ? (
                                <img src={userParams.avatar} alt={userParams.name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                                userParams.avatar
                            )
                        ) : (
                            userParams.name.charAt(0)
                        )}
                    </div>
                ) : type === 'task' ? (
                    <div className="w-10 h-10 rounded-full bg-warning-50 flex items-center justify-center text-warning-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                    </div>
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm font-medium ${!isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                        {title}
                    </h4>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{time}</span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                    {description}
                </p>

                {actionLabel && (
                    <button className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors">
                        {actionLabel}
                    </button>
                )}
            </div>

            {/* Read indicator */}
            {!isRead && (
                <div className="self-center">
                    <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                </div>
            )}
        </div>
    );
}
