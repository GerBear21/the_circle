import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type TableName = 'requests' | 'approvals' | 'request_steps' | 'documents';
type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions {
  table: TableName;
  event?: EventType;
  filter?: string;
  onInsert?: (payload: Record<string, unknown>) => void;
  onUpdate?: (payload: Record<string, unknown>) => void;
  onDelete?: (payload: Record<string, unknown>) => void;
}

export function useRealtime({
  table,
  event = '*',
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const channelName = `realtime:${table}:${filter || 'all'}`;

    const newChannel = supabase
      .channel(channelName)
      .on<Record<string, unknown>>(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload.new);
              break;
            case 'UPDATE':
              onUpdate?.(payload.new);
              break;
            case 'DELETE':
              onDelete?.(payload.old);
              break;
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    setChannel(newChannel);

    return () => {
      newChannel.unsubscribe();
    };
  }, [table, event, filter, onInsert, onUpdate, onDelete]);

  return { channel, isConnected };
}

// Hook for subscribing to approval notifications
export function useApprovalNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<any[]>([]);

  useRealtime({
    table: 'request_steps',
    event: 'UPDATE',
    filter: userId ? `approver_user_id=eq.${userId}` : undefined,
    onUpdate: (step) => {
      if (step.status === 'pending') {
        setNotifications((prev) => [...prev, step]);
      }
    },
  });

  const clearNotification = (stepId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== stepId));
  };

  return { notifications, clearNotification };
}
