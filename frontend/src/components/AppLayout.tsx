import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/dashboard', label: 'My Groups',  Icon: Users },
];

export function AppLayout() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-border px-4">
          <span className="font-semibold tracking-tight text-foreground">
            XBC Expenses
          </span>
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
