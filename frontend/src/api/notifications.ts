import api from './axios';
import type { NotificationItem } from '@/store/notificationStore';

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await api.get<{ data: NotificationItem[] }>('/api/notifications');
  return res.data.data;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await api.put<{ data: NotificationItem }>(`/api/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.put('/api/notifications/read-all');
}
