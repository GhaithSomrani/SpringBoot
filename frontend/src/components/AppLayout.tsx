import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PlusCircle,
  Receipt,
  Settings,
  Shield,
  User,
  UserCheck,
  Users,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useNotificationStore, selectUnreadCount } from '@/store/notificationStore';
import type { NotificationItem } from '@/store/notificationStore';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/api/notifications';
import { getMyInvitations } from '@/api/invitations';
import { getMyGroups, type GroupDto } from '@/api/groups';
import type { AuthUser } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOT_PALETTE = [
  'bg-blue-500',    'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500',    'bg-cyan-500',    'bg-orange-500', 'bg-pink-500',
];

function groupDotColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) >>> 0;
  return DOT_PALETTE[h % DOT_PALETTE.length];
}

// ─── Notification meta ────────────────────────────────────────────────────────

const N_ICON: Record<string, React.ElementType> = {
  EXPENSE_ADDED:      PlusCircle,
  EXPENSE_UPDATED:    Pencil,
  MEMBER_JOINED:      UserCheck,
  INVITE_RECEIVED:    Mail,
  PERMISSION_CHANGED: Shield,
  INVITATION_ACCEPTED: UserCheck,
  INVITATION_DECLINED: Mail,
  UPGRADE_REQUEST_RECEIVED: Shield,
  UPGRADE_REQUEST_APPROVED: Shield,
  UPGRADE_REQUEST_DENIED: Shield,
};

const N_ICON_STYLE: Record<string, string> = {
  EXPENSE_ADDED:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  EXPENSE_UPDATED:
    'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  MEMBER_JOINED:
    'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400',
  INVITE_RECEIVED:
    'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
  PERMISSION_CHANGED:
    'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400',
  INVITATION_ACCEPTED:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  INVITATION_DECLINED:
    'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400',
  UPGRADE_REQUEST_RECEIVED:
    'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400',
  UPGRADE_REQUEST_APPROVED:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  UPGRADE_REQUEST_DENIED:
    'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400',
};

const N_ACCENT: Record<string, string> = {
  EXPENSE_ADDED:      'border-emerald-400',
  EXPENSE_UPDATED:    'border-blue-400',
  MEMBER_JOINED:      'border-violet-400',
  INVITE_RECEIVED:    'border-amber-400',
  PERMISSION_CHANGED: 'border-rose-400',
  INVITATION_ACCEPTED: 'border-emerald-400',
  INVITATION_DECLINED: 'border-rose-400',
  UPGRADE_REQUEST_RECEIVED: 'border-violet-400',
  UPGRADE_REQUEST_APPROVED: 'border-emerald-400',
  UPGRADE_REQUEST_DENIED: 'border-rose-400',
};

// ─── Sub-page definitions ─────────────────────────────────────────────────────

const SUB_PAGES = [
  { suffix: '/expenses', label: 'Expenses',  Icon: Receipt,       end: false },
  { suffix: '/events',   label: 'Events',    Icon: CalendarDays,  end: false },
  { suffix: '',          label: 'Members',   Icon: Users,         end: true  },
  { suffix: '/audit',    label: 'Audit Log', Icon: ClipboardList, end: false },
  { suffix: '/settings', label: 'Settings',  Icon: Settings,      end: false },
] as const;

// ─── GroupNavItem ─────────────────────────────────────────────────────────────

function GroupNavItem({
  group,
  collapsed,
  isOpen,
  onToggle,
  activeGroupId,
}: {
  group: GroupDto;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  activeGroupId?: string;
}) {
  const isActive = group.id === activeGroupId;

  return (
    <div>
      <button
        title={collapsed ? group.name : undefined}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          collapsed && 'justify-center px-2',
        )}
      >
        <span className={cn('size-2 shrink-0 rounded-full', groupDotColor(group.id))} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{group.name}</span>
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 transition-transform duration-150',
                isOpen && 'rotate-180',
              )}
            />
          </>
        )}
      </button>

      {!collapsed && isOpen && (
        <div className="mt-0.5 space-y-0.5 pl-6">
          {SUB_PAGES.map(({ suffix, label, Icon, end }) => (
            <NavLink
              key={label}
              to={`/groups/${group.id}${suffix}`}
              end={end}
              className={({ isActive: active }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )
              }
            >
              <Icon className="size-3.5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ groups }: { groups?: GroupDto[] }) {
  const { pathname } = useLocation();
  const groupMatch = pathname.match(/\/groups\/([^/]+)/);
  const groupId = groupMatch?.[1];

  const crumbs: string[] = [];
  if (!groupId) {
    if (pathname === '/invitations') crumbs.push('Invitations');
    else crumbs.push('Dashboard');
  } else {
    crumbs.push('My Groups');
    const group = groups?.find((g) => g.id === groupId);
    if (group) crumbs.push(group.name);
    if (pathname.endsWith('/expenses'))      crumbs.push('Expenses');
    else if (pathname.endsWith('/events'))  crumbs.push('Events');
    else if (pathname.endsWith('/audit'))   crumbs.push('Audit Log');
    else if (pathname.endsWith('/settings')) crumbs.push('Settings');
    else                                    crumbs.push('Members');
  }

  return (
    <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.map((label, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span
            className={cn(
              'truncate',
              i === crumbs.length - 1
                ? 'font-medium text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
}

// ─── Notification list (shared between desktop popover & mobile popover) ──────

function NotificationList({
  notifications,
  unreadCount,
  onRead,
  onReadAll,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  onRead: (n: NotificationItem) => Promise<void>;
  onReadAll: () => Promise<void>;
}) {
  const recent = notifications.slice(0, 10);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-medium text-foreground">Notifications</span>
        {unreadCount > 0 && (
          <Button
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            onClick={onReadAll}
          >
            Mark all read
          </Button>
        )}
      </div>

      <div className="max-h-[380px] overflow-y-auto">
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          recent.map((n) => {
            const Icon      = N_ICON[n.type] ?? Bell;
            const iconStyle = N_ICON_STYLE[n.type] ?? 'bg-muted text-muted-foreground';
            const accent    = N_ACCENT[n.type]     ?? 'border-muted-foreground/20';
            return (
              <button
                key={n.id}
                onClick={() => onRead(n)}
                className={cn(
                  'flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                  n.read ? 'border-transparent' : accent,
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                    iconStyle,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm text-foreground">{n.message}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

// ─── NotificationPopover (desktop header) ─────────────────────────────────────

function NotificationPopover() {
  const notifications  = useNotificationStore((s) => s.notifications);
  const markReadLocal  = useNotificationStore((s) => s.markRead);
  const markAllLocal   = useNotificationStore((s) => s.markAllRead);
  const unreadCount    = useNotificationStore(selectUnreadCount);

  async function onRead(n: NotificationItem) {
    if (n.read) return;
    try { await markNotificationRead(n.id); markReadLocal(n.id); } catch {}
  }

  async function onReadAll() {
    try { await markAllNotificationsRead(); markAllLocal(); } catch {}
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Notifications"
            className="relative"
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

      <PopoverContent className="flex w-80 flex-col p-0" side="bottom" align="end" sideOffset={6}>
        <NotificationList
          notifications={notifications}
          unreadCount={unreadCount}
          onRead={onRead}
          onReadAll={onReadAll}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Mobile notification tab ─────────────────────────────────────────────────

function MobileNotifTab() {
  const notifications  = useNotificationStore((s) => s.notifications);
  const markReadLocal  = useNotificationStore((s) => s.markRead);
  const markAllLocal   = useNotificationStore((s) => s.markAllRead);
  const unreadCount    = useNotificationStore(selectUnreadCount);

  async function onRead(n: NotificationItem) {
    if (n.read) return;
    try { await markNotificationRead(n.id); markReadLocal(n.id); } catch {}
  }

  async function onReadAll() {
    try { await markAllNotificationsRead(); markAllLocal(); } catch {}
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground" />
        }
      >
        <div className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        Alerts
      </PopoverTrigger>

      <PopoverContent className="flex w-80 flex-col p-0" side="top" align="center" sideOffset={8}>
        <NotificationList
          notifications={notifications}
          unreadCount={unreadCount}
          onRead={onRead}
          onReadAll={onReadAll}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── UserMenu ─────────────────────────────────────────────────────────────────

function UserMenu({
  user,
  onLogout,
}: {
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '??';

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[96px] truncate sm:block">{user?.username}</span>
        <ChevronDown className="size-3.5 shrink-0" />
      </PopoverTrigger>

      <PopoverContent className="w-44 p-1.5" side="bottom" align="end" sideOffset={6}>
        <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted">
          <User className="size-3.5" />
          Profile
        </button>
        <div className="my-1 h-px bg-border" />
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

export function AppLayout() {
  const { user, clearAuth } = useAuth();
  const navigate            = useNavigate();

  // Live notifications via WebSocket
  useWebSocket();

  // Load notifications on mount
  const setNotifications = useNotificationStore((s) => s.setNotifications);
  useEffect(() => {
    fetchNotifications().then(setNotifications).catch(() => {});
  }, [setNotifications]);

  // Sidebar collapse — persisted
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true',
  );
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

  // Groups from API
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['my-groups'],
    queryFn:  getMyGroups,
    staleTime: 30_000,
  });
  const { data: invitations = [] } = useQuery({
    queryKey: ['my-invitations'],
    queryFn: getMyInvitations,
    staleTime: 30_000,
  });
  const pendingInvitations = invitations.filter((item) => item.status === 'PENDING').length;

  // Detect active group from URL
  const { pathname } = useLocation();
  const groupMatch   = pathname.match(/\/groups\/([^/]+)/);
  const activeGroupId = groupMatch?.[1];

  // Which groups are expanded in the sidebar
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroupId ? [activeGroupId] : []),
  );
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => new Set([...prev, activeGroupId]));
    }
  }, [activeGroupId]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-background">

      {/* ── Desktop Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border transition-all duration-200 md:flex',
          collapsed ? 'md:w-16' : 'md:w-60',
        )}
      >
        {/* Logo row */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
          {!collapsed && (
            <span className="select-none font-semibold tracking-tight text-foreground">
              XBC Expenses
            </span>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleCollapsed}
            className={cn('shrink-0 text-muted-foreground', collapsed && 'mx-auto')}
          >
            {collapsed
              ? <PanelLeftOpen  className="size-4" />
              : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 space-y-5 overflow-y-auto p-2 py-3">

          {/* Overview */}
          <div>
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </p>
            )}
            <NavLink
              to="/dashboard"
              end
              title={collapsed ? 'Dashboard' : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  collapsed && 'justify-center px-2',
                )
              }
            >
              <LayoutDashboard className="size-4 shrink-0" />
              {!collapsed && 'Dashboard'}
            </NavLink>
            <NavLink
              to="/invitations"
              title={collapsed ? 'Invitations' : undefined}
              className={({ isActive }) =>
                cn(
                  'relative mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  collapsed && 'justify-center px-2',
                )
              }
            >
              <Mail className="size-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">Invitations</span>
                  {pendingInvitations > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {pendingInvitations}
                    </span>
                  )}
                </>
              )}
              {collapsed && pendingInvitations > 0 && (
                <span className="absolute ml-4 -mt-4 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-semibold text-white">
                  {pendingInvitations > 9 ? '9+' : pendingInvitations}
                </span>
              )}
            </NavLink>
          </div>

          {/* My Groups */}
          <div>
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                My Groups
              </p>
            )}
            <div className="space-y-0.5">
              {groupsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <Skeleton className="h-3.5 rounded" />
                  </div>
                ))
              ) : !groups?.length ? (
                !collapsed && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No groups yet.
                  </p>
                )
              ) : (
                groups.map((group) => (
                  <GroupNavItem
                    key={group.id}
                    group={group}
                    collapsed={collapsed}
                    isOpen={openGroups.has(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    activeGroupId={activeGroupId}
                  />
                ))
              )}
            </div>
          </div>
        </nav>

        {/* Settings / bottom */}
        <div className="shrink-0 border-t border-border p-2">
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Settings
            </p>
          )}
          <button
            title={collapsed ? 'Profile' : undefined}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
              collapsed && 'justify-center px-2',
            )}
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed && 'Profile'}
          </button>
          <button
            title={collapsed ? 'Sign out' : undefined}
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive',
              collapsed && 'justify-center px-2',
            )}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ── Right column ─────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
          <Breadcrumb groups={groups} />

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationPopover />
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom bar ─────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )
          }
        >
          <LayoutDashboard className="size-5" />
          Home
        </NavLink>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )
          }
        >
          <FolderOpen className="size-5" />
          Groups
        </NavLink>

        <MobileNotifTab />

        <button
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <User className="size-5" />
          Profile
        </button>
      </nav>
    </div>
  );
}
