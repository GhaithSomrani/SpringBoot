import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useNotificationStore, selectUnreadCount } from '@/store/notificationStore';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/api/notifications';
import type { NotificationItem } from '@/store/notificationStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/dashboard', label: 'My Groups', Icon: Users },
];

export function AppLayout() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();

  // Connect WebSocket for live notifications
  useWebSocket();

  const notifications = useNotificationStore((s) => s.notifications);
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const unreadCount = useNotificationStore(selectUnreadCount);

  useEffect(() => {
    fetchNotifications().then(setNotifications).catch(() => {});
  }, [setNotifications]);

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  async function handleMarkRead(n: NotificationItem) {
    if (n.read) return;
    try {
      await markNotificationRead(n.id);
      markRead(n.id);
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      markAllRead();
    } catch {
      // ignore
    }
  }

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border">
        {/* Logo + bell */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="font-semibold tracking-tight text-foreground">
            XBC Expenses
          </span>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Notifications"
                  className="relative shrink-0"
                />
              }
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </PopoverTrigger>

            <PopoverContent
              className="w-80 p-0"
              side="bottom"
              align="end"
              sideOffset={6}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-sm font-medium text-foreground">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <Button
                    size="xs"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </Button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No notifications yet.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleMarkRead(n)}
                      className={cn(
                        'w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50',
                        !n.read && 'bg-primary/5',
                      )}
                    >
                      <p className="line-clamp-2 text-foreground">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {format(new Date(n.createdAt), 'MMM d, HH:mm')}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2">
          {navLinks.map(({ to, label, Icon }) => (
            <NavLink
              key={label}
              to={to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2.5">
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.username}
              </p>
              <Badge variant="secondary" className="mt-0.5 text-[10px]">
                {user?.role}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={handleLogout}
          >
            <LogOut className="size-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
