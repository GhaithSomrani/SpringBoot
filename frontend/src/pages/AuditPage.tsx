import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import {
  getAuditLogs,
  type AuditLogDto,
  type AuditAction,
  type AuditEntityType,
  type AuditFilters,
} from '@/api/audit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

const ENTITY_TYPES: AuditEntityType[] = ['EXPENSE', 'CATEGORY', 'EVENT', 'GROUP', 'MEMBER'];
const ACTIONS: AuditAction[] = ['CREATED', 'UPDATED', 'DELETED', 'JOINED', 'LEFT', 'PERMISSION_CHANGED'];

const ACTION_STYLE: Record<AuditAction, string> = {
  CREATED:            'text-emerald-600 dark:text-emerald-400',
  UPDATED:            'text-blue-600 dark:text-blue-400',
  DELETED:            'text-red-600 dark:text-red-400',
  JOINED:             'text-violet-600 dark:text-violet-400',
  LEFT:               'text-orange-600 dark:text-orange-400',
  PERMISSION_CHANGED: 'text-amber-600 dark:text-amber-400',
};

const PAGE_SIZE = 20;

const columns: ColumnDef<AuditLogDto>[] = [
  {
    accessorKey: 'entityType',
    header: 'Entity',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ getValue }) => {
      const action = getValue<AuditAction>();
      return (
        <span className={cn('text-xs font-semibold', ACTION_STYLE[action])}>
          {action.replace('_', ' ')}
        </span>
      );
    },
  },
  {
    accessorKey: 'entityId',
    header: 'Entity ID',
    cell: ({ getValue }) => (
      <span className="max-w-[120px] truncate font-mono text-[11px] text-muted-foreground">
        {getValue<string>()}
      </span>
    ),
  },
  {
    id: 'performedBy',
    header: 'Performed by',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.performedBy.email}</span>
    ),
  },
  {
    accessorKey: 'performedAt',
    header: 'Date',
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">
        {format(new Date(getValue<string>()), 'MMM d, yyyy HH:mm')}
      </span>
    ),
  },
];

export function AuditPage() {
  const { groupId } = useParams<{ groupId: string }>();

  const [entityType, setEntityType] = useState<AuditEntityType | ''>('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [userId, setUserId] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(0);

  const filters: AuditFilters = {
    entityType: entityType || undefined,
    action: action || undefined,
    userId: userId.trim() || undefined,
    dateFrom: dateRange?.from ? dateRange.from.toISOString() : undefined,
    dateTo: dateRange?.to ? dateRange.to.toISOString() : undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['audit', groupId, filters, page],
    queryFn: () => getAuditLogs(groupId!, filters, page, PAGE_SIZE),
    enabled: !!groupId,
    placeholderData: (prev) => prev,
  });

  const table = useReactTable({
    data: data?.content ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data?.totalPages ?? -1,
    state: { pagination: { pageIndex: page, pageSize: PAGE_SIZE } },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex: page, pageSize: PAGE_SIZE })
        : updater;
      setPage(next.pageIndex);
    },
  });

  function resetFilters() {
    setEntityType('');
    setAction('');
    setUserId('');
    setDateRange(undefined);
    setPage(0);
  }

  const hasFilters = !!(entityType || action || userId.trim() || dateRange?.from);

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d, yyyy')}`
      : format(dateRange.from, 'MMM d, yyyy')
    : 'Date range';

  return (
    <div className="p-6">
      <h1 className="mb-5 text-xl font-semibold text-foreground">Audit Log</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Entity type */}
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value as AuditEntityType | ''); setPage(0); }}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All entities</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Action */}
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value as AuditAction | ''); setPage(0); }}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
        </select>

        {/* User ID / email search */}
        <Input
          placeholder="User ID"
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setPage(0); }}
          className="h-8 w-44 text-sm"
        />

        {/* Date range */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 gap-1.5 font-normal',
                  dateRange?.from && 'text-foreground',
                )}
              />
            }
          >
            <CalendarIcon className="size-3.5" />
            {dateLabel}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(r) => { setDateRange(r); setPage(0); }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" onClick={resetFilters}>
            <X className="size-3.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No audit records found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, data.totalElements)} of{' '}
            {data.totalElements} records
          </p>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[60px] text-center text-xs text-muted-foreground">
              {page + 1} / {data.totalPages}
            </span>
            <Button
              size="icon-sm"
              variant="outline"
              disabled={data.last}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
