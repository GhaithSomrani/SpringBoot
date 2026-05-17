import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format, subMonths } from 'date-fns';
import {
  ArrowRight, FolderOpen, Plus, TrendingUp, Users, Mail, Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

import {
  getMyGroups,
  createGroup,
  getExpenseSummary,
  getGroupInvitations,
  type GroupDto,
  type ExpenseSummary,
} from '@/api/groups';
import { getExpenses, type ExpenseDto } from '@/api/expenses';
import { getCategories, type CategoryDto } from '@/api/categories';
import { getAuditLogs, type AuditLogDto } from '@/api/audit';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899',
];
const OTHER_COLOR = '#94a3b8';

const ACTION_VERB: Record<string, string> = {
  CREATED:            'created',
  UPDATED:            'updated',
  DELETED:            'deleted',
  JOINED:             'joined',
  LEFT:               'left',
  PERMISSION_CHANGED: 'changed permissions for',
};
const ENTITY_LABEL: Record<string, string> = {
  EXPENSE: 'an expense', CATEGORY: 'a category',
  EVENT: 'an event', GROUP: 'the group', MEMBER: 'a member',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtExact = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

function normalizeMonth(m: string) { return m.slice(0, 7); }

function last6Months() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yy') };
  });
}

function formatAuditLine(log: AuditLogDto, groups: GroupDto[]): string {
  const actor = log.performedBy.email.split('@')[0];
  const verb   = ACTION_VERB[log.action]  ?? log.action.toLowerCase();
  const entity = ENTITY_LABEL[log.entityType] ?? log.entityType.toLowerCase();
  const group  = groups.find((g) => g.id === log.groupId);
  return `${actor} ${verb} ${entity}${group ? ` in ${group.name}` : ''}`;
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <Card className="gap-2 py-5">
      <CardContent className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ h = 220 }: { h?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height: h }} />;
}

function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3"><Skeleton className="h-4 rounded" /></td>
      ))}
    </tr>
  );
}

// ─── Create-group dialog ──────────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const mut = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-groups'] });
      onOpenChange(false);
      reset();
      toast.success('Group created');
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message
        : 'Failed to create group';
      toast.error(msg);
    },
  });
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create group</DialogTitle>
          <DialogDescription>Give your group a name and optional description.</DialogDescription>
        </DialogHeader>
        <form id="cg" onSubmit={handleSubmit((d) => mut.mutate(d))} noValidate className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cg-name">Name</Label>
            <Input id="cg-name" placeholder="Weekend trip, Apartment…" aria-invalid={!!errors.name} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-desc">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="cg-desc" placeholder="What's this group for?" {...register('description')} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
          <Button form="cg" type="submit" disabled={mut.isPending}>
            {mut.isPending ? 'Creating…' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, Icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', accent ?? 'bg-muted text-muted-foreground')}>
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export function DashboardPage() {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const navigate   = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  // ── 1. Fetch groups ────────────────────────────────────────────────────────
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['my-groups'],
    queryFn:  getMyGroups,
    staleTime: 30_000,
  });

  const groupIds = useMemo(() => groups?.map((g) => g.id) ?? [], [groups]);
  const enabled  = groupIds.length > 0;

  // ── 2. Parallel per-group queries ─────────────────────────────────────────
  const summaryResults = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ['summary', id],
      queryFn:  () => getExpenseSummary(id),
      enabled,
      staleTime: 60_000,
    })),
  });

  const expenseResults = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ['expenses', id, 'recent'],
      queryFn:  () => getExpenses(id, {}, 0, 5, 'date', 'desc'),
      enabled,
      staleTime: 60_000,
    })),
  });

  const categoryResults = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ['categories', id],
      queryFn:  () => getCategories(id),
      enabled,
      staleTime: 120_000,
    })),
  });

  const auditResults = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ['audit', id, 'recent'],
      queryFn:  () => getAuditLogs(id, {}, 0, 5),
      enabled,
      staleTime: 60_000,
    })),
  });

  const inviteResults = useQueries({
    queries: groupIds.map((id) => ({
      queryKey: ['invitations', id],
      queryFn:  () => getGroupInvitations(id).catch(() => [] as Awaited<ReturnType<typeof getGroupInvitations>>),
      enabled,
      staleTime: 60_000,
    })),
  });

  // ── 3. Aggregation ────────────────────────────────────────────────────────
  const summaries  = summaryResults.map((r) => r.data).filter(Boolean) as ExpenseSummary[];
  const allLoading = groupsLoading || (enabled && summaryResults.some((r) => r.isLoading));

  // Build a flat category id → color map from loaded categories
  const categoryColorMap = useMemo(() => {
    const map = new Map<string, string>();
    categoryResults.forEach((r) => {
      (r.data ?? []).forEach((c: CategoryDto) => { if (c.color) map.set(c.id, c.color); });
    });
    return map;
  }, [categoryResults]);

  // Build a flat category id → name map from summaries
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    summaries.forEach((s) => {
      s.byCategory.forEach((c) => map.set(c.categoryId, c.categoryName));
    });
    return map;
  }, [summaries]);

  // ── Metric: Total this month ───────────────────────────────────────────────
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const totalThisMonth = useMemo(
    () => summaries.reduce((sum, s) => {
      const m = s.byMonth.find((b) => normalizeMonth(b.month) === currentMonthKey);
      return sum + (m?.total ?? 0);
    }, 0),
    [summaries, currentMonthKey],
  );

  // ── Metric: Pending invites ───────────────────────────────────────────────
  const pendingInvites = useMemo(
    () => inviteResults.flatMap((r) => r.data ?? []).filter((inv) => inv.status === 'PENDING').length,
    [inviteResults],
  );

  // ── Metric: Most spent category (all-time) ────────────────────────────────
  const topCategory = useMemo(() => {
    const catTotals = new Map<string, { name: string; total: number }>();
    summaries.forEach((s) => {
      s.byCategory.forEach(({ categoryId, categoryName, total }) => {
        const prev = catTotals.get(categoryId);
        catTotals.set(categoryId, { name: categoryName, total: (prev?.total ?? 0) + total });
      });
    });
    if (!catTotals.size) return null;
    return [...catTotals.values()].sort((a, b) => b.total - a.total)[0];
  }, [summaries]);

  // ── Bar chart: last 6 months ──────────────────────────────────────────────
  const months6 = useMemo(() => last6Months(), []);
  const barData = useMemo(
    () => months6.map(({ key, label }) => ({
      name: label,
      amount: summaries.reduce((sum, s) => {
        const m = s.byMonth.find((b) => normalizeMonth(b.month) === key);
        return sum + (m?.total ?? 0);
      }, 0),
    })),
    [summaries, months6],
  );

  // ── Donut chart: top 5 categories + Other ────────────────────────────────
  const pieData = useMemo(() => {
    const catTotals = new Map<string, { id: string; name: string; total: number }>();
    summaries.forEach((s) => {
      s.byCategory.forEach(({ categoryId, categoryName, total }) => {
        const prev = catTotals.get(categoryId);
        catTotals.set(categoryId, { id: categoryId, name: categoryName, total: (prev?.total ?? 0) + total });
      });
    });
    const sorted = [...catTotals.values()].sort((a, b) => b.total - a.total);
    const top5   = sorted.slice(0, 5);
    const rest   = sorted.slice(5).reduce((s, c) => s + c.total, 0);
    return [
      ...top5.map((c, i) => ({
        name:  c.name,
        value: c.total,
        fill:  categoryColorMap.get(c.id) || CHART_COLORS[i],
      })),
      ...(rest > 0 ? [{ name: 'Other', value: rest, fill: OTHER_COLOR }] : []),
    ];
  }, [summaries, categoryColorMap]);

  // ── Recent expenses (last 10 across all groups) ───────────────────────────
  const recentExpenses = useMemo(() => {
    const all: (ExpenseDto & { groupName: string })[] = [];
    expenseResults.forEach((r, i) => {
      const gname = groups?.[i]?.name ?? '';
      (r.data?.content ?? []).forEach((e) => all.push({ ...e, groupName: gname }));
    });
    return all
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [expenseResults, groups]);

  // ── Activity feed (last 5 audit entries across all groups) ────────────────
  const activityFeed = useMemo(() => {
    const all: AuditLogDto[] = auditResults.flatMap((r) => r.data?.content ?? []);
    return all
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
      .slice(0, 5);
  }, [auditResults]);

  // ── No groups empty state ─────────────────────────────────────────────────
  if (!groupsLoading && groups?.length === 0) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex size-20 items-center justify-center rounded-2xl bg-muted">
          <FolderOpen className="size-9 text-muted-foreground/50" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No groups yet</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Create your first group to start tracking shared expenses and see your spending analytics here.
        </p>
        <Button size="sm" className="mt-5" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" /> Create your first group
        </Button>
        <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Welcome back{user?.username ? `, ${user.username}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Here's what's happening across your groups.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" /> New group
        </Button>
      </div>

      {/* ── Summary bar ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {allLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              label="Total this month"
              value={fmt(totalThisMonth)}
              sub={format(new Date(), 'MMMM yyyy')}
              Icon={TrendingUp}
              accent="bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
            />
            <MetricCard
              label="My groups"
              value={String(groups?.length ?? 0)}
              sub={groups?.length === 1 ? '1 group' : `${groups?.length} groups`}
              Icon={Users}
              accent="bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400"
            />
            <MetricCard
              label="Pending invites"
              value={String(pendingInvites)}
              sub={pendingInvites === 0 ? 'None sent' : 'awaiting response'}
              Icon={Mail}
              accent="bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
            />
            <MetricCard
              label="Most spent category"
              value={topCategory ? fmt(topCategory.total) : '—'}
              sub={topCategory?.name ?? 'No data yet'}
              Icon={Tag}
              accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
            />
          </>
        )}
      </div>

      {/* ── Two-column body ───────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Left (60%) */}
        <div className="space-y-6 lg:col-span-3">

          {/* Monthly bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly spending</CardTitle>
            </CardHeader>
            <CardContent>
              {allLoading ? (
                <ChartSkeleton h={220} />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                      width={48}
                    />
                    <RcTooltip
                      formatter={(v: number) => [fmtExact(v), 'Spent']}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      cursor={{ fill: 'hsl(var(--muted))' }}
                    />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Recent expenses table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent expenses</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {allLoading || expenseResults.some((r) => r.isLoading) ? (
                <table className="w-full">
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)}
                  </tbody>
                </table>
              ) : recentExpenses.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No expenses recorded yet.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Title</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Category</th>
                      <th className="hidden px-4 py-2 font-medium md:table-cell">Group</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExpenses.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => navigate(`/groups/${e.groupId}/expenses`)}
                        className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(e.date), 'MMM d')}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-3 font-medium text-foreground">
                          {e.title}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {categoryNameMap.get(e.categoryId) ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden max-w-[100px] truncate px-4 py-3 text-muted-foreground md:table-cell">
                          {e.groupName}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                          {fmtExact(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right (40%) */}
        <div className="space-y-6 lg:col-span-2">

          {/* Donut chart */}
          <Card>
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
            </CardHeader>
            <CardContent>
              {allLoading ? (
                <ChartSkeleton h={200} />
              ) : pieData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No category data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RcTooltip
                      formatter={(v: number) => [fmtExact(v)]}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ fontSize: 11, color: 'hsl(var(--foreground))' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* My groups list */}
          <Card>
            <CardHeader>
              <CardTitle>My groups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
              {groupsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-10 rounded" />
                  </div>
                ))
              ) : (
                (groups ?? []).map((group) => {
                  const myMember = group.members.find((m) => m.userId === user?.id);
                  const isOwner  = group.ownerId === user?.id;
                  const permission = isOwner ? 'OWNER' : (myMember?.permission ?? 'VIEW');
                  return (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-foreground">
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.members.length + 1} member{group.members.length !== 0 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={permission === 'OWNER' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {permission}
                        </Badge>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Activity feed */}
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 px-0 pb-1">
              {auditResults.some((r) => r.isLoading) ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <Skeleton className="mt-0.5 size-2 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))
              ) : activityFeed.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No activity yet.
                </p>
              ) : (
                activityFeed.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
                  >
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {formatAuditLine(log, groups ?? [])}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {format(new Date(log.performedAt), 'MMM d, HH:mm')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
