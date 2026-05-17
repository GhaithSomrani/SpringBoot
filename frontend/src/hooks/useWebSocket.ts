import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import type { NotificationItem } from '@/store/notificationStore';

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const prependNotification = useNotificationStore((s) => s.prependNotification);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    if (!token) {
      clientRef.current?.deactivate();
      clientRef.current = null;
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws') as WebSocket,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe('/user/queue/notifications', (frame) => {
          try {
            const notification = JSON.parse(frame.body) as NotificationItem;
            prependNotification(notification);
            toast(notification.message, { duration: 4000 });
          } catch {
            // ignore malformed frames
          }
        });
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [token, prependNotification]);
}
