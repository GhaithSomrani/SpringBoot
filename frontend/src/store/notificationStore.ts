import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  groupId: string;
  referenceId?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: NotificationItem[];
  setNotifications: (ns: NotificationItem[]) => void;
  prependNotification: (n: NotificationItem) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  setNotifications: (notifications) => set({ notifications }),

  prependNotification: (n) =>
    set((s) => ({ notifications: [n, ...s.notifications] })),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
}));

export const selectUnreadCount = (s: NotificationState) =>
  s.notifications.filter((n) => !n.read).length;
