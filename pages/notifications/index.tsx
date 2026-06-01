import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { AppLayout } from '@/components/layout';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useState, useEffect } from 'react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US');
}

function TimeAgo({ dateString }: { dateString: string }) {
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeAgo(getTimeAgo(dateString));
    
    const interval = setInterval(() => {
      setTimeAgo(getTimeAgo(dateString));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [dateString]);

  if (!mounted) return null;
  
  return <>{timeAgo}</>;
}

interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
  sender: {
    display_name: string | null;
    email: string;
  } | null;
}

interface NotificationsProps {
  initialNotifications: AppNotification[];
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export const getServerSideProps: GetServerSideProps<NotificationsProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const user = session.user as any;
  const userId = user.id;

  let notifications: AppNotification[] = [];

  try {
    const { data: notificationsData, error } = await supabaseAdmin
      .from('notifications')
      .select(`
        id,
        type,
        title,
        message,
        is_read,
        metadata,
        created_at,
        sender:app_users!notifications_sender_id_fkey (
          id,
          display_name,
          email
        )
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    let rawNotifications = notificationsData || [];
    
    // Process sender to be flat object if it's an array for some reason (Supabase relation)
    notifications = rawNotifications.map((n: any) => ({
        ...n,
        sender: Array.isArray(n.sender) ? n.sender[0] : n.sender
    })) as AppNotification[];
      
  } catch (error) {
    console.error('Error fetching notifications:', error);
  }

  return {
    props: {
      initialNotifications: notifications,
    },
  };
};

export default function NotificationsPage({ initialNotifications }: NotificationsProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>(initialNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: [id], is_read: true }),
      });
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: unreadIds, is_read: true }),
      });
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
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
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    }

    if (notification.metadata?.action_url) {
      router.push(notification.metadata.action_url);
    }
  };

  const filteredNotifications = notifications.filter(n => 
    filter === 'all' ? true : !n.is_read
  );
  
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIconForType = (type: string) => {
    switch (type) {
      case 'approval':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'task':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'message':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        );
      case 'system':
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'approval': return 'bg-success-100 text-success-600';
      case 'task': return 'bg-amber-100 text-amber-600';
      case 'message': return 'bg-[#F3EADC] text-[#9A7545]';
      case 'system':
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <>
      <Head>
        <title>Notifications - The Circle</title>
      </Head>

      <AppLayout title="Notifications">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
        >
          {/* Header Section */}
          <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Notifications</h1>
              <p className="text-gray-500 mt-1 flex items-center gap-2">
                Stay updated on your tasks, approvals, and messages
                {unreadCount > 0 && (
                    <span className="bg-primary-100 text-primary-700 font-bold px-2 py-0.5 rounded-full text-xs">
                        {unreadCount} new
                    </span>
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  filter === 'all' 
                    ? "bg-gray-900 text-white shadow-md" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  filter === 'unread' 
                    ? "bg-gray-900 text-white shadow-md" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                Unread
              </button>
            </div>
          </motion.div>

          {/* Controls */}
          <motion.div variants={item} className="flex justify-end">
            <button
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Mark all as read
            </button>
          </motion.div>

          {/* Notifications List */}
          <motion.div variants={item} className="space-y-4">
            {filteredNotifications.length === 0 ? (
              <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No notifications found</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                    {filter === 'unread' 
                        ? "You're all caught up! There are no unread notifications at this time."
                        : "You don't have any notifications yet."}
                </p>
              </div>
            ) : (
                filteredNotifications.map((notification, index) => (
                    <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                            "group cursor-pointer relative overflow-hidden bg-white border shadow-sm hover:shadow-md transition-all duration-300 rounded-[1.5rem] p-5 sm:p-6",
                            notification.is_read 
                                ? "border-gray-100/80 hover:border-gray-200" 
                                : "border-primary-100 shadow-primary-500/5 ring-1 ring-primary-50"
                        )}
                    >
                        {/* Unread indicator line */}
                        {!notification.is_read && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-500 rounded-l-[1.5rem]" />
                        )}

                        <div className="flex flex-col sm:flex-row gap-5">
                            {/* Icon */}
                            <div className={cn(
                                "flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500",
                                getColorForType(notification.type)
                            )}>
                                {getIconForType(notification.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-1">
                                    <h3 className={cn(
                                        "truncate font-bold group-hover:text-primary-600 transition-colors",
                                        notification.is_read ? "text-gray-800" : "text-gray-900 text-lg"
                                    )}>
                                        {notification.title}
                                    </h3>
                                    <span className={cn(
                                        "text-xs font-medium whitespace-nowrap",
                                        notification.is_read ? "text-gray-400" : "text-primary-600 font-bold"
                                    )}>
                                        <TimeAgo dateString={notification.created_at} />
                                    </span>
                                </div>
                                
                                {notification.message && (
                                    <p className={cn(
                                        // No line-clamp on the full notifications page — the engine
                                        // composes multi-line messages with comment/reason details
                                        // and the user should see them all here.
                                        "text-sm mb-3 whitespace-pre-wrap",
                                        notification.is_read ? "text-gray-500" : "text-gray-700 font-medium"
                                    )}>
                                        {notification.message}
                                    </p>
                                )}

                                <div className="flex flex-wrap items-center gap-3 text-xs">
                                    {notification.sender && (
                                        <div className="flex items-center gap-1.5 text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <span className="font-medium">{notification.sender.display_name || notification.sender.email.split('@')[0]}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100 uppercase tracking-wider font-semibold">
                                        {notification.type}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex sm:flex-col items-center justify-end sm:justify-center gap-2 shrink-0 mt-4 sm:mt-0">
                                {notification.metadata?.action_url && (
                                    <button 
                                        className="hidden sm:flex px-4 py-2 bg-gray-50 hover:bg-primary-50 text-gray-700 hover:text-primary-700 text-sm font-semibold rounded-xl transition-colors border border-gray-200 hover:border-primary-200"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleNotificationClick(notification);
                                        }}
                                    >
                                        {notification.metadata?.action_label || 'View Details'}
                                    </button>
                                )}
                                {!notification.is_read && (
                                    <button
                                        onClick={(e) => handleMarkAsRead(e, notification.id)}
                                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors group/btn relative"
                                        aria-label="Mark as read"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {/* Tooltip */}
                                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                                            Mark as read
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))
            )}
          </motion.div>
          
        </motion.div>
      </AppLayout>
    </>
  );
}
